import type {
  AdminLoginResult,
  JoinResult,
  SendMessageInput,
} from './chat-store-types';
import type { ChatSnapshot, CommandResult } from './types';

export type StoreResult<T> = T | Promise<T>;

export interface ChatStoreApi {
  snapshot(): StoreResult<ChatSnapshot>;
  join(nickname: string): StoreResult<JoinResult>;
  changeNickname(sessionId: string, nickname: string): StoreResult<CommandResult>;
  sendMessage(input: SendMessageInput): StoreResult<CommandResult>;
  adminLogin(password: string): StoreResult<AdminLoginResult>;
  clearChat(adminToken: string): StoreResult<CommandResult>;
  toggleAnonymous(adminToken: string, enabled: boolean): StoreResult<CommandResult>;
  pinNotice(adminToken: string, messageId: string): StoreResult<CommandResult>;
  unpinNotice(adminToken: string): StoreResult<CommandResult>;
  toggleChatActive(adminToken: string, active: boolean): StoreResult<CommandResult>;
}
