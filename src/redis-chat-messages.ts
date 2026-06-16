import { MAX_HISTORY, MESSAGE_RETENTION_MS } from './chat-store-types.js';
import type { RedisChatClient } from './redis-chat-client.js';
import { decodeChatMessage } from './redis-chat-codec.js';
import type { ChatMessage } from './types.js';

export async function getRedisMessages(
  redis: RedisChatClient,
  messagesKey: string,
): Promise<readonly ChatMessage[]> {
  const rawMessages = await redis.zrange(messagesKey, 0, -1);
  return rawMessages.flatMap((rawMessage) => {
    const message = decodeChatMessage(rawMessage);
    return message ? [message] : [];
  });
}

export async function cleanupExpiredRedisMessages(
  redis: RedisChatClient,
  messagesKey: string,
  currentTime: number,
): Promise<void> {
  await redis.zremrangebyscore(messagesKey, 0, currentTime - MESSAGE_RETENTION_MS - 1);
}

export async function trimRedisHistory(
  redis: RedisChatClient,
  messagesKey: string,
): Promise<void> {
  const count = await redis.zcard(messagesKey);
  const overflow = count - MAX_HISTORY;
  if (overflow > 0) {
    await redis.zremrangebyrank(messagesKey, 0, overflow - 1);
  }
}
