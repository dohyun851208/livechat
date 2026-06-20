import { Redis } from '@upstash/redis';
import { ChatStore } from './chat-store.js';
import type {
  AdminLoginResult,
  JoinResult,
  SendMessageInput,
} from './chat-store-types.js';
import type { ChatStoreApi } from './chat-store-api';
import { readRedisEnvironment } from './redis-environment.js';
import { createRedisChatClient, RedisChatStore } from './redis-chat-store.js';
import type { ChatSnapshot, CommandResult } from './types.js';

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
    return new FallbackChatStore(
      new RedisChatStore(
        createRedisChatClient(
          new Redis({
            url: redisEnvironment.url,
            token: redisEnvironment.token,
          }),
        ),
        adminPassword,
        () => Date.now(),
        redisEnvironment.prefix,
      ),
      () => new ChatStore(adminPassword),
    );
  }
  return new ChatStore(adminPassword);
}

class FallbackChatStore implements ChatStoreApi {
  private fallbackStore: ChatStoreApi | null = null;

  constructor(
    private readonly primaryStore: ChatStoreApi,
    private readonly createFallbackStore: () => ChatStoreApi,
  ) {}

  snapshot(): Promise<ChatSnapshot> {
    return this.run((store) => store.snapshot());
  }

  join(nickname: string): Promise<JoinResult> {
    return this.run((store) => store.join(nickname));
  }

  changeNickname(sessionId: string, nickname: string): Promise<CommandResult> {
    return this.run((store) => store.changeNickname(sessionId, nickname));
  }

  sendMessage(input: SendMessageInput): Promise<CommandResult> {
    return this.run((store) => store.sendMessage(input));
  }

  sendAdminMessage(adminToken: string, content: string): Promise<CommandResult> {
    return this.run((store) => store.sendAdminMessage(adminToken, content));
  }

  adminLogin(password: string): Promise<AdminLoginResult> {
    return this.run((store) => store.adminLogin(password));
  }

  clearChat(adminToken: string): Promise<CommandResult> {
    return this.run((store) => store.clearChat(adminToken));
  }

  toggleAnonymous(adminToken: string, enabled: boolean): Promise<CommandResult> {
    return this.run((store) => store.toggleAnonymous(adminToken, enabled));
  }

  pinNotice(adminToken: string, messageId: string): Promise<CommandResult> {
    return this.run((store) => store.pinNotice(adminToken, messageId));
  }

  unpinNotice(adminToken: string): Promise<CommandResult> {
    return this.run((store) => store.unpinNotice(adminToken));
  }

  toggleChatActive(adminToken: string, active: boolean): Promise<CommandResult> {
    return this.run((store) => store.toggleChatActive(adminToken, active));
  }

  private async run<T>(
    operation: (store: ChatStoreApi) => T | Promise<T>,
  ): Promise<T> {
    if (this.fallbackStore) {
      return operation(this.fallbackStore);
    }

    try {
      return await operation(this.primaryStore);
    } catch (error) {
      console.warn('Redis chat store failed; falling back to in-memory chat store.', error);
      this.fallbackStore = this.createFallbackStore();
      return operation(this.fallbackStore);
    }
  }
}
