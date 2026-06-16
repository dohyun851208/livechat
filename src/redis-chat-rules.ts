import {
  ADMIN_TTL_MS,
  SESSION_TTL_MS,
  type ParticipantSession,
} from './chat-store-types';

export const SESSION_TTL_SECONDS = Math.ceil(SESSION_TTL_MS / 1000);
export const ADMIN_TTL_SECONDS = Math.ceil(ADMIN_TTL_MS / 1000);

export function isNicknameInUse(
  sessions: readonly ParticipantSession[],
  nickname: string,
): boolean {
  const normalized = nickname.toLowerCase();
  return sessions.some((session) => session.nickname.toLowerCase() === normalized);
}
