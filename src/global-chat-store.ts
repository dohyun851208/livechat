import { Redis } from '@upstash/redis';
import { ChatStore } from './chat-store.js';
import type { ChatStoreApi } from './chat-store-api';
import { createRedisChatClient, RedisChatStore } from './redis-chat-store.js';

declare global {
  var __livechatStore: ChatStoreApi | undefined;
}

export function getGlobalChatStore(): ChatStoreApi {
  globalThis.__livechatStore ??= createChatStore();
  return globalThis.__livechatStore;
}

function createChatStore(): ChatStoreApi {
  const adminPassword = process.env.ADMIN_PASSWORD ?? '8624';
  if (hasRedisEnvironment()) {
    return new RedisChatStore(
      createRedisChatClient(Redis.fromEnv()),
      adminPassword,
      () => Date.now(),
      process.env.LIVECHAT_REDIS_PREFIX ?? 'livechat',
    );
  }
  return new ChatStore(adminPassword);
}

function hasRedisEnvironment(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}
