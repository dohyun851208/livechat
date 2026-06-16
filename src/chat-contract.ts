import { z } from 'zod';
import type { ChatMessage, ChatSnapshot } from './types';

export const ChatMessageSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  content: z.string(),
  color: z.string(),
  createdAt: z.number(),
});

export const ChatSnapshotSchema = z.object({
  messages: z.array(ChatMessageSchema),
  anonymousMode: z.boolean(),
  pinnedNotice: ChatMessageSchema.nullable(),
  chatActive: z.boolean(),
  version: z.number(),
});

const NicknameSchema = z.string().trim().min(1).max(20);
const MessageContentSchema = z.string().trim().min(1).max(300);
const TokenSchema = z.string().min(1);

export const ChatActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('join'),
    nickname: NicknameSchema,
  }),
  z.object({
    action: z.literal('change_nickname'),
    sessionId: TokenSchema,
    nickname: NicknameSchema,
  }),
  z.object({
    action: z.literal('send_message'),
    sessionId: TokenSchema,
    content: MessageContentSchema,
  }),
  z.object({
    action: z.literal('admin_login'),
    password: z.string(),
  }),
  z.object({
    action: z.literal('clear_chat'),
    adminToken: TokenSchema,
  }),
  z.object({
    action: z.literal('toggle_anonymous'),
    adminToken: TokenSchema,
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal('pin_notice'),
    adminToken: TokenSchema,
    messageId: TokenSchema,
  }),
  z.object({
    action: z.literal('unpin_notice'),
    adminToken: TokenSchema,
  }),
  z.object({
    action: z.literal('toggle_chat_active'),
    adminToken: TokenSchema,
    active: z.boolean(),
  }),
]);

export const ChatApiResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    state: ChatSnapshotSchema,
    sessionId: z.string().optional(),
    adminToken: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    state: ChatSnapshotSchema.optional(),
  }),
]);

export type ChatAction = z.infer<typeof ChatActionSchema>;
type ParsedChatMessage = z.infer<typeof ChatMessageSchema>;
type ParsedChatSnapshot = z.infer<typeof ChatSnapshotSchema>;
type ParsedChatApiResponse = z.infer<typeof ChatApiResponseSchema>;

export type ChatApiResponse =
  | {
      readonly ok: true;
      readonly state: ChatSnapshot;
      readonly sessionId?: string;
      readonly adminToken?: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly state?: ChatSnapshot;
    };

export function toChatApiResponse(response: ParsedChatApiResponse): ChatApiResponse {
  if (response.ok === true) {
    return {
      ok: true,
      state: toChatSnapshot(response.state),
      sessionId: response.sessionId,
      adminToken: response.adminToken,
    };
  }
  return {
    ok: false,
    error: response.error,
    state: response.state ? toChatSnapshot(response.state) : undefined,
  };
}

function toChatSnapshot(snapshot: ParsedChatSnapshot): ChatSnapshot {
  return {
    messages: snapshot.messages.map(toChatMessage),
    anonymousMode: snapshot.anonymousMode,
    pinnedNotice: snapshot.pinnedNotice ? toChatMessage(snapshot.pinnedNotice) : null,
    chatActive: snapshot.chatActive,
    version: snapshot.version,
  };
}

function toChatMessage(message: ParsedChatMessage): ChatMessage {
  return {
    id: message.id,
    nickname: message.nickname,
    content: message.content,
    color: message.color,
    createdAt: message.createdAt,
  };
}
