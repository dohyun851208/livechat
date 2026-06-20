import { assertNever } from './assert-never.js';
import {
  ChatActionSchema,
  type ChatAction,
  type ChatApiResponse,
} from './chat-contract.js';
import type { ChatStoreApi } from './chat-store-api';

export async function getChatStateResponse(
  store: ChatStoreApi,
): Promise<ChatApiResponse> {
  return {
    ok: true,
    state: await store.snapshot(),
  };
}

export async function handleChatAction(
  store: ChatStoreApi,
  input: unknown,
): Promise<ChatApiResponse> {
  const parsed = ChatActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: '요청 형식이 올바르지 않습니다.',
      state: await store.snapshot(),
    };
  }

  return executeAction(store, parsed.data);
}

async function executeAction(
  store: ChatStoreApi,
  action: ChatAction,
): Promise<ChatApiResponse> {
  switch (action.action) {
    case 'join': {
      const result = await store.join(action.nickname);
      if (result.ok === false) {
        return failure(store, result.error);
      }
      return {
        ok: true,
        sessionId: result.sessionId,
        state: await store.snapshot(),
      };
    }
    case 'change_nickname': {
      const result = await store.changeNickname(action.sessionId, action.nickname);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'send_message': {
      const result = await store.sendMessage({
        sessionId: action.sessionId,
        content: action.content,
      });
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'admin_send_message': {
      const result = await store.sendAdminMessage(action.adminToken, action.content);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'admin_login': {
      const result = await store.adminLogin(action.password);
      if (result.ok === false) {
        return failure(store, result.error);
      }
      return {
        ok: true,
        adminToken: result.adminToken,
        state: await store.snapshot(),
      };
    }
    case 'clear_chat': {
      const result = await store.clearChat(action.adminToken);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'toggle_anonymous': {
      const result = await store.toggleAnonymous(action.adminToken, action.enabled);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'pin_notice': {
      const result = await store.pinNotice(action.adminToken, action.messageId);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'unpin_notice': {
      const result = await store.unpinNotice(action.adminToken);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    case 'toggle_chat_active': {
      const result = await store.toggleChatActive(action.adminToken, action.active);
      return result.ok === true ? success(store) : failure(store, result.error);
    }
    default:
      return assertNever(action);
  }
}

async function success(store: ChatStoreApi): Promise<ChatApiResponse> {
  return {
    ok: true,
    state: await store.snapshot(),
  };
}

async function failure(
  store: ChatStoreApi,
  error: string,
): Promise<ChatApiResponse> {
  return {
    ok: false,
    error,
    state: await store.snapshot(),
  };
}
