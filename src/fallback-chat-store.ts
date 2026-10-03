import type { AdminLoginResult, JoinResult, SendMessageInput } from './chat-store-types.js';
import type { ChatStoreApi } from './chat-store-api.js';
import type { ChatSnapshot, CommandResult } from './types.js';

// Compatibility for installations whose configured Redis is unavailable.
// The fallback is temporary state scoped to this server process.
export class FallbackChatStore implements ChatStoreApi {
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
  resetNicknames(adminToken: string): Promise<CommandResult> {
    return this.run((store) => store.resetNicknames(adminToken));
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

  private async run<T>(operation: (store: ChatStoreApi) => T | Promise<T>): Promise<T> {
    if (this.fallbackStore) return operation(this.fallbackStore);
    try {
      return await operation(this.primaryStore);
    } catch (error) {
      // Concurrent failures must use one store; replacing it loses other users.
      if (!this.fallbackStore) {
        console.warn('Redis unavailable; using temporary in-memory chat. Configure Redis for shared production state.', error);
        this.fallbackStore = this.createFallbackStore();
      }
      return operation(this.fallbackStore);
    }
  }
}
