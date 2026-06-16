import { ChatStore } from './chat-store.js';

declare global {
  var __livechatStore: ChatStore | undefined;
}

export function getGlobalChatStore(): ChatStore {
  globalThis.__livechatStore ??= new ChatStore(process.env.ADMIN_PASSWORD ?? '8624');
  return globalThis.__livechatStore;
}
