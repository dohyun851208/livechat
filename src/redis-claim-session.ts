import type { ParticipantSession } from './chat-store-types.js';
import { MAX_ACTIVE_PARTICIPANTS, SESSION_TTL_MS } from './chat-store-types.js';
import { SESSION_TTL_SECONDS } from './redis-chat-rules.js';

export type SessionClaim = {
  readonly sessionsKey: string;
  readonly versionKey: string;
  readonly sessionKeyPrefix: string;
  readonly session: ParticipantSession;
  readonly mustExist: boolean;
};

export type SessionClaimResult = 'ok' | 'duplicate' | 'full' | 'expired';

// Checking nicknames and capacity separately lets concurrent serverless requests
// reserve the same name or exceed forty participants. Redis executes this atomically.
export const CLAIM_SESSION_SCRIPT = `
local sessionsKey = KEYS[1]
local versionKey = KEYS[2]
local sessionKey = KEYS[3]
local sessionId = ARGV[1]
local normalizedNickname = ARGV[2]
local encodedSession = ARGV[3]
local now = tonumber(ARGV[4])
local ttlSeconds = tonumber(ARGV[5])
local ttlMs = tonumber(ARGV[6])
local limit = tonumber(ARGV[7])
local sessionKeyPrefix = ARGV[8]
local mustExist = ARGV[9] == 'true'

if mustExist and not redis.call('GET', sessionKey) then
  return 'expired'
end
redis.call('ZREMRANGEBYSCORE', sessionsKey, '-inf', now - ttlMs - 1)
local ids = redis.call('ZRANGE', sessionsKey, 0, -1)
local activeCount = 0
for _, id in ipairs(ids) do
  local raw = redis.call('GET', sessionKeyPrefix .. id)
  if raw then
    local participant = cjson.decode(raw)
    activeCount = activeCount + 1
    local normalized = participant.normalizedNickname or string.lower(participant.nickname)
    if id ~= sessionId and normalized == normalizedNickname then
      return 'duplicate'
    end
  else
    redis.call('ZREM', sessionsKey, id)
  end
end
if not mustExist and activeCount >= limit then
  return 'full'
end
redis.call('SET', sessionKey, encodedSession, 'EX', ttlSeconds)
redis.call('ZADD', sessionsKey, now, sessionId)
redis.call('INCR', versionKey)
return 'ok'
`;

export function sessionClaimArguments(claim: SessionClaim) {
  return [
    claim.session.id,
    claim.session.nickname.toLowerCase(),
    JSON.stringify({
      ...claim.session,
      normalizedNickname: claim.session.nickname.toLowerCase(),
    }),
    claim.session.lastSeen,
    SESSION_TTL_SECONDS,
    SESSION_TTL_MS,
    MAX_ACTIVE_PARTICIPANTS,
    claim.sessionKeyPrefix,
    String(claim.mustExist),
  ];
}
