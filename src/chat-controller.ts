import {
  ChatActionSchema,
  type ChatAction,
  type ChatApiResponse,
} from './chat-contract';
import type { ChatStore } from './chat-store';
import { assertNever } from './assert-never';

export function getChatStateResponse(store: ChatStore): ChatApiResponse {
  return {
    ok: true,
    state: store.snapshot(),
  };
}

export function handleChatAction(store: ChatStore, input: unknown): ChatApiResponse {
  const parsed = ChatActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: '요청 형식이 올바르지 않습니다.',
      state: store.snapshot(),
    };
  }

  return executeAction(store, parsed.data);
}

function executeAction(store: ChatStore, action: ChatAction): ChatApiResponse {
  switch (action.action) {
    case 'join': {
      const result = store.join(action.nickname);
      if (result.ok === false) {
        return failure(store, result.error);
      }
      return {
        ok: true,
        sessionId: result.sessionId,
        state: store.snapshot(),
      };
    }
    case 'change_nickname': {
      const result = store.changeNickname(action.sessionId, action.nickname);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'send_message': {
      const result = store.sendMessage({
        sessionId: action.sessionId,
        content: action.content,
      });
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'admin_login': {
      const result = store.adminLogin(action.password);
      if (result.ok === false) {
        return failure(store, result.error);
      }
      return {
        ok: true,
        adminToken: result.adminToken,
        state: store.snapshot(),
      };
    }
    case 'clear_chat': {
      const result = store.clearChat(action.adminToken);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'toggle_anonymous': {
      const result = store.toggleAnonymous(action.adminToken, action.enabled);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'pin_notice': {
      const result = store.pinNotice(action.adminToken, action.messageId);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'unpin_notice': {
      const result = store.unpinNotice(action.adminToken);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'toggle_chat_active': {
      const result = store.toggleChatActive(action.adminToken, action.active);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    default:
      return assertNever(action);
  }
}

function success(store: ChatStore): ChatApiResponse {
  return {
    ok: true,
    state: store.snapshot(),
  };
}

function failure(store: ChatStore, error: string): ChatApiResponse {
  return {
    ok: false,
    error,
    state: store.snapshot(),
  };
}
