import { Redis } from '@upstash/redis';
import { ChatStore } from './chat-store.js';
import type { ChatStoreApi } from './chat-store-api';
import { readRedisEnvironment } from './redis-environment.js';
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
  const redisEnvironment = readRedisEnvironment(process.env);
  if (redisEnvironment) {
    return new RedisChatStore(
      createRedisChatClient(
        new Redis({
          url: redisEnvironment.url,
          token: redisEnvironment.token,
        }),
      ),
      adminPassword,
      () => Date.now(),
      redisEnvironment.prefix,
    );
  }
  return new ChatStore(adminPassword);
}
