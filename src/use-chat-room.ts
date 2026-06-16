import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChatState, postChatAction } from './chat-api-client';
import type { ChatMessage, ChatSnapshot, CommandResult } from './types';

const EMPTY_SNAPSHOT: ChatSnapshot = {
  messages: [],
  anonymousMode: false,
  pinnedNotice: null,
  chatActive: true,
  version: 0,
};

export type ChatRoom = {
  readonly messages: readonly ChatMessage[];
  readonly anonymousMode: boolean;
  readonly isConnected: boolean;
  readonly pinnedNotice: ChatMessage | null;
  readonly chatActive: boolean;
  readonly lastError: string;
  readonly join: (nickname: string) => Promise<CommandResult>;
  readonly changeNickname: (nickname: string) => Promise<CommandResult>;
  readonly sendMessage: (content: string) => Promise<CommandResult>;
  readonly adminLogin: (password: string) => Promise<CommandResult>;
  readonly clearChat: () => Promise<CommandResult>;
  readonly toggleAnonymous: (enabled: boolean) => Promise<CommandResult>;
  readonly pinNotice: (messageId: string) => Promise<CommandResult>;
  readonly unpinNotice: () => Promise<CommandResult>;
  readonly toggleChatActive: (active: boolean) => Promise<CommandResult>;
};

export function useChatRoom(): ChatRoom {
  const [snapshot, setSnapshot] = useState<ChatSnapshot>(EMPTY_SNAPSHOT);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState('');
  const sessionIdRef = useRef<string | null>(null);
  const adminTokenRef = useRef<string | null>(null);

  const applySnapshot = useCallback((nextSnapshot: ChatSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetchChatState();
      if (response.ok === true) {
        applySnapshot(response.state);
        setIsConnected(true);
        setLastError('');
      } else {
        setIsConnected(false);
        setLastError(response.error);
      }
    } catch (error) {
      setIsConnected(false);
      setLastError(toErrorMessage(error));
    }
  }, [applySnapshot]);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const join = useCallback(
    async (nickname: string): Promise<CommandResult> => {
      const response = await safePost({ action: 'join', nickname });
      if (response.ok === false) {
        return response;
      }
      if (!response.sessionId) {
        return { ok: false, error: '채팅 서버가 입장 정보를 보내지 않았습니다.' };
      }
      sessionIdRef.current = response.sessionId;
      applySnapshot(response.state);
      return { ok: true };
    },
    [applySnapshot],
  );

  const changeNickname = useCallback(
    async (nickname: string): Promise<CommandResult> => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return { ok: false, error: '입장 정보가 없습니다. 다시 입장해주세요.' };
      }
      const response = await safePost({
        action: 'change_nickname',
        sessionId,
        nickname,
      });
      if (response.ok === true) {
        applySnapshot(response.state);
      }
      return toCommandResult(response);
    },
    [applySnapshot],
  );

  const sendMessage = useCallback(
    async (content: string): Promise<CommandResult> => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return { ok: false, error: '입장 정보가 없습니다. 다시 입장해주세요.' };
      }
      const response = await safePost({ action: 'send_message', sessionId, content });
      if (response.ok === true) {
        applySnapshot(response.state);
      }
      return toCommandResult(response);
    },
    [applySnapshot],
  );

  const adminLogin = useCallback(
    async (password: string): Promise<CommandResult> => {
      const response = await safePost({ action: 'admin_login', password });
      if (response.ok === false) {
        return response;
      }
      if (!response.adminToken) {
        return { ok: false, error: '채팅 서버가 관리자 정보를 보내지 않았습니다.' };
      }
      adminTokenRef.current = response.adminToken;
      applySnapshot(response.state);
      return { ok: true };
    },
    [applySnapshot],
  );

  const clearChat = useCallback(async (): Promise<CommandResult> => {
    const adminToken = adminTokenRef.current;
    if (!adminToken) {
      return { ok: false, error: '관리자 로그인이 필요합니다.' };
    }
    return postAdminAction({ action: 'clear_chat', adminToken }, applySnapshot);
  }, [applySnapshot]);

  const toggleAnonymous = useCallback(
    async (enabled: boolean): Promise<CommandResult> => {
      const adminToken = adminTokenRef.current;
      if (!adminToken) {
        return { ok: false, error: '관리자 로그인이 필요합니다.' };
      }
      return postAdminAction(
        { action: 'toggle_anonymous', adminToken, enabled },
        applySnapshot,
      );
    },
    [applySnapshot],
  );

  const pinNotice = useCallback(
    async (messageId: string): Promise<CommandResult> => {
      const adminToken = adminTokenRef.current;
      if (!adminToken) {
        return { ok: false, error: '관리자 로그인이 필요합니다.' };
      }
      return postAdminAction(
        { action: 'pin_notice', adminToken, messageId },
        applySnapshot,
      );
    },
    [applySnapshot],
  );

  const unpinNotice = useCallback(async (): Promise<CommandResult> => {
    const adminToken = adminTokenRef.current;
    if (!adminToken) {
      return { ok: false, error: '관리자 로그인이 필요합니다.' };
    }
    return postAdminAction({ action: 'unpin_notice', adminToken }, applySnapshot);
  }, [applySnapshot]);

  const toggleChatActive = useCallback(
    async (active: boolean): Promise<CommandResult> => {
      const adminToken = adminTokenRef.current;
      if (!adminToken) {
        return { ok: false, error: '관리자 로그인이 필요합니다.' };
      }
      return postAdminAction(
        { action: 'toggle_chat_active', adminToken, active },
        applySnapshot,
      );
    },
    [applySnapshot],
  );

  return {
    messages: snapshot.messages,
    anonymousMode: snapshot.anonymousMode,
    isConnected,
    pinnedNotice: snapshot.pinnedNotice,
    chatActive: snapshot.chatActive,
    lastError,
    join,
    changeNickname,
    sendMessage,
    adminLogin,
    clearChat,
    toggleAnonymous,
    pinNotice,
    unpinNotice,
    toggleChatActive,
  };
}

type SuccessfulApiResponse = {
  readonly ok: true;
  readonly state: ChatSnapshot;
  readonly sessionId?: string;
  readonly adminToken?: string;
};

type FailedApiResponse = {
  readonly ok: false;
  readonly error: string;
  readonly state?: ChatSnapshot;
};

type SafeApiResponse = SuccessfulApiResponse | FailedApiResponse;

async function safePost(
  action: Parameters<typeof postChatAction>[0],
): Promise<SafeApiResponse> {
  try {
    const response = await postChatAction(action);
    return response;
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

async function postAdminAction(
  action: Parameters<typeof postChatAction>[0],
  applySnapshot: (snapshot: ChatSnapshot) => void,
): Promise<CommandResult> {
  const response = await safePost(action);
  if (response.ok === true) {
    applySnapshot(response.state);
  }
  return toCommandResult(response);
}

function toCommandResult(response: SafeApiResponse): CommandResult {
  return response.ok === true ? { ok: true } : { ok: false, error: response.error };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return '채팅 서버에 연결할 수 없습니다.';
}
