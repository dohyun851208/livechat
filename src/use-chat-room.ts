import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChatState, postChatAction } from './chat-api-client';
import {
  CHAT_POLL_INTERVAL_MS,
  shouldPollChat,
  type ChatPollingMode,
} from './chat-polling';
import type { ChatMessage, ChatSnapshot, CommandResult } from './types';

const EMPTY_SNAPSHOT: ChatSnapshot = {
  messages: [],
  anonymousMode: false,
  pinnedNotice: null,
  chatActive: true,
  version: 0,
};

const PARTICIPANT_SESSION_STORAGE_KEY = 'livechat:participant-session:v1';

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
  readonly sendAdminMessage: (content: string) => Promise<CommandResult>;
  readonly adminLogin: (password: string) => Promise<CommandResult>;
  readonly clearChat: () => Promise<CommandResult>;
  readonly resetNicknames: () => Promise<CommandResult>;
  readonly toggleAnonymous: (enabled: boolean) => Promise<CommandResult>;
  readonly pinNotice: (messageId: string) => Promise<CommandResult>;
  readonly unpinNotice: () => Promise<CommandResult>;
  readonly toggleChatActive: (active: boolean) => Promise<CommandResult>;
};

export function useChatRoom(pollingMode: ChatPollingMode): ChatRoom {
  const [snapshot, setSnapshot] = useState<ChatSnapshot>(EMPTY_SNAPSHOT);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState('');
  const sessionIdRef = useRef<string | null>(null);
  const adminTokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef(false);

  const applySuccessfulResponse = useCallback((response: SuccessfulApiResponse) => {
    setSnapshot(response.state);
    setIsConnected(true);
    setLastError('');
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }
    refreshInFlightRef.current = true;
    try {
      const response = await fetchChatState();
      if (response.ok === true) {
        applySuccessfulResponse(response);
      } else {
        setIsConnected(false);
        setLastError(response.error);
      }
    } catch (error) {
      setIsConnected(false);
      setLastError(toErrorMessage(error));
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [applySuccessfulResponse]);

  const pollingEnabled = shouldPollChat(pollingMode, snapshot.chatActive);

  useEffect(() => {
    if (!pollingEnabled) {
      setIsConnected(false);
      setLastError('');
      return undefined;
    }

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, CHAT_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [pollingEnabled, refresh]);

  const join = useCallback(
    async (nickname: string): Promise<CommandResult> => {
      const storedSession = readStoredParticipantSession();
      if (
        storedSession &&
        storedSession.nickname.toLowerCase() === nickname.trim().toLowerCase()
      ) {
        const resumed = await safePost({
          action: 'change_nickname',
          sessionId: storedSession.sessionId,
          nickname,
        });
        if (resumed.ok === true) {
          sessionIdRef.current = storedSession.sessionId;
          writeStoredParticipantSession(storedSession.sessionId, nickname);
          applySuccessfulResponse(resumed);
          return { ok: true };
        }
        clearStoredParticipantSession();
      }

      const response = await safePost({ action: 'join', nickname });
      if (response.ok === false) {
        return response;
      }
      if (!response.sessionId) {
        return { ok: false, error: '채팅 서버가 입장 정보를 보내지 않았습니다.' };
      }
      sessionIdRef.current = response.sessionId;
      writeStoredParticipantSession(response.sessionId, nickname);
      applySuccessfulResponse(response);
      return { ok: true };
    },
    [applySuccessfulResponse],
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
        writeStoredParticipantSession(sessionId, nickname);
        applySuccessfulResponse(response);
      }
      return toCommandResult(response);
    },
    [applySuccessfulResponse],
  );

  const sendMessage = useCallback(
    async (content: string): Promise<CommandResult> => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return { ok: false, error: '입장 정보가 없습니다. 다시 입장해주세요.' };
      }
      const response = await safePost({ action: 'send_message', sessionId, content });
      if (response.ok === true) {
        applySuccessfulResponse(response);
      }
      return toCommandResult(response);
    },
    [applySuccessfulResponse],
  );

  const sendAdminMessage = useCallback(
    async (content: string): Promise<CommandResult> => {
      const adminToken = adminTokenRef.current;
      if (!adminToken) {
        return { ok: false, error: '관리자 로그인이 필요합니다.' };
      }
      return postAdminAction(
        { action: 'admin_send_message', adminToken, content },
        applySuccessfulResponse,
      );
    },
    [applySuccessfulResponse],
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
      applySuccessfulResponse(response);
      return { ok: true };
    },
    [applySuccessfulResponse],
  );

  const clearChat = useCallback(async (): Promise<CommandResult> => {
    const adminToken = adminTokenRef.current;
    if (!adminToken) {
      return { ok: false, error: '관리자 로그인이 필요합니다.' };
    }
    return postAdminAction({ action: 'clear_chat', adminToken }, applySuccessfulResponse);
  }, [applySuccessfulResponse]);

  const resetNicknames = useCallback(async (): Promise<CommandResult> => {
    const adminToken = adminTokenRef.current;
    if (!adminToken) {
      return { ok: false, error: '관리자 로그인이 필요합니다.' };
    }
    const result = await postAdminAction(
      { action: 'reset_nicknames', adminToken },
      applySuccessfulResponse,
    );
    if (result.ok === true) {
      sessionIdRef.current = null;
      clearStoredParticipantSession();
    }
    return result;
  }, [applySuccessfulResponse]);

  const toggleAnonymous = useCallback(
    async (enabled: boolean): Promise<CommandResult> => {
      const adminToken = adminTokenRef.current;
      if (!adminToken) {
        return { ok: false, error: '관리자 로그인이 필요합니다.' };
      }
      return postAdminAction(
        { action: 'toggle_anonymous', adminToken, enabled },
        applySuccessfulResponse,
      );
    },
    [applySuccessfulResponse],
  );

  const pinNotice = useCallback(
    async (messageId: string): Promise<CommandResult> => {
      const adminToken = adminTokenRef.current;
      if (!adminToken) {
        return { ok: false, error: '관리자 로그인이 필요합니다.' };
      }
      return postAdminAction(
        { action: 'pin_notice', adminToken, messageId },
        applySuccessfulResponse,
      );
    },
    [applySuccessfulResponse],
  );

  const unpinNotice = useCallback(async (): Promise<CommandResult> => {
    const adminToken = adminTokenRef.current;
    if (!adminToken) {
      return { ok: false, error: '관리자 로그인이 필요합니다.' };
    }
    return postAdminAction({ action: 'unpin_notice', adminToken }, applySuccessfulResponse);
  }, [applySuccessfulResponse]);

  const toggleChatActive = useCallback(
    async (active: boolean): Promise<CommandResult> => {
      const adminToken = adminTokenRef.current;
      if (!adminToken) {
        return { ok: false, error: '관리자 로그인이 필요합니다.' };
      }
      return postAdminAction(
        { action: 'toggle_chat_active', adminToken, active },
        applySuccessfulResponse,
      );
    },
    [applySuccessfulResponse],
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
    sendAdminMessage,
    adminLogin,
    clearChat,
    resetNicknames,
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
    return await postChatAction(action);
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

async function postAdminAction(
  action: Parameters<typeof postChatAction>[0],
  applySuccessfulResponse: (response: SuccessfulApiResponse) => void,
): Promise<CommandResult> {
  const response = await safePost(action);
  if (response.ok === true) {
    applySuccessfulResponse(response);
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

type StoredParticipantSession = {
  readonly sessionId: string;
  readonly nickname: string;
};

function readStoredParticipantSession(): StoredParticipantSession | null {
  try {
    const raw = window.localStorage.getItem(PARTICIPANT_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('sessionId' in parsed) ||
      !('nickname' in parsed) ||
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.nickname !== 'string'
    ) {
      clearStoredParticipantSession();
      return null;
    }
    return { sessionId: parsed.sessionId, nickname: parsed.nickname };
  } catch {
    return null;
  }
}

function writeStoredParticipantSession(sessionId: string, nickname: string): void {
  try {
    window.localStorage.setItem(
      PARTICIPANT_SESSION_STORAGE_KEY,
      JSON.stringify({ sessionId, nickname }),
    );
  } catch {
    // Storage can be unavailable in private browsing; chat still works for this page.
  }
}

function clearStoredParticipantSession(): void {
  try {
    window.localStorage.removeItem(PARTICIPANT_SESSION_STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}
