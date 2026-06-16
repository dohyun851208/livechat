import {
  ADMIN_TTL_MS,
  type AdminSession,
  type ParticipantSession,
  SESSION_TTL_MS,
} from './chat-store-types';
import type { RedisChatClient } from './redis-chat-client';
import { encodeRedisJson } from './redis-chat-codec';
import type { RedisChatKeys } from './redis-chat-keys';
import { ADMIN_TTL_SECONDS, SESSION_TTL_SECONDS } from './redis-chat-rules';

export async function saveRedisSession(
  redis: RedisChatClient,
  keys: RedisChatKeys,
  session: ParticipantSession,
): Promise<void> {
  await Promise.all([
    redis.set(keys.session(session.id), encodeRedisJson(session), {
      ex: SESSION_TTL_SECONDS,
    }),
    redis.zadd(keys.sessions, { score: session.lastSeen, member: session.id }),
  ]);
}

export async function saveRedisAdmin(
  redis: RedisChatClient,
  keys: RedisChatKeys,
  admin: AdminSession,
): Promise<void> {
  await Promise.all([
    redis.set(keys.admin(admin.token), encodeRedisJson(admin), {
      ex: ADMIN_TTL_SECONDS,
    }),
    redis.zadd(keys.admins, { score: admin.lastSeen, member: admin.token }),
  ]);
}

export async function cleanupExpiredRedisSessions(
  redis: RedisChatClient,
  keys: RedisChatKeys,
  currentTime: number,
): Promise<void> {
  await Promise.all([
    redis.zremrangebyscore(keys.sessions, 0, currentTime - SESSION_TTL_MS - 1),
    redis.zremrangebyscore(keys.admins, 0, currentTime - ADMIN_TTL_MS - 1),
  ]);
}
