import { z } from 'zod';
import { CHAT_PALETTE } from './chat-palette.js';
import type { AdminSession, ParticipantSession } from './chat-store-types.js';
import type { ChatMessage } from './types.js';

const ParticipantSessionSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  lastSeen: z.number(),
});

const AdminSessionSchema = z.object({
  token: z.string(),
  lastSeen: z.number(),
});

const ChatMessageSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  content: z.string(),
  color: z.string(),
  createdAt: z.number(),
});

export type RedisChatState = {
  readonly anonymousMode: boolean;
  readonly pinnedNoticeId: string | null;
  readonly chatActive: boolean;
};

export function encodeRedisJson(value: unknown): string {
  return JSON.stringify(value);
}

export function decodeParticipantSession(raw: string | null): ParticipantSession | null {
  return decodeJson(raw, ParticipantSessionSchema);
}

export function decodeAdminSession(raw: string | null): AdminSession | null {
  return decodeJson(raw, AdminSessionSchema);
}

export function decodeChatMessage(raw: string): ChatMessage | null {
  return decodeJson(raw, ChatMessageSchema);
}

export function decodeChatState(record: Record<string, string> | null): RedisChatState {
  return {
    anonymousMode: record?.anonymousMode === 'true',
    pinnedNoticeId: record?.pinnedNoticeId ? record.pinnedNoticeId : null,
    chatActive: record?.chatActive !== 'false',
  };
}

export function redisBoolean(value: boolean): string {
  return value ? 'true' : 'false';
}

export function deterministicNicknameColor(nickname: string): string {
  let hash = 0;
  for (const char of nickname) {
    hash = (hash * 31 + char.charCodeAt(0)) % CHAT_PALETTE.length;
  }
  return CHAT_PALETTE[hash] ?? CHAT_PALETTE[0];
}

function decodeJson<T>(raw: string | null, schema: z.ZodType<T>): T | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}
