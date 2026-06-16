import { randomUUID } from 'node:crypto';
import {
  ADMIN_TTL_MS,
  MAX_ACTIVE_PARTICIPANTS,
  SESSION_TTL_MS,
  type AdminLoginResult,
  type JoinResult,
  type ParticipantSession,
  type SendMessageInput,
} from './chat-store-types.js';
import type { ChatStoreApi } from './chat-store-api.js';
import {
  decodeAdminSession,
  decodeChatState,
  decodeParticipantSession,
  deterministicNicknameColor,
  encodeRedisJson,
  redisBoolean,
} from './redis-chat-codec.js';
import {
  createRedisChatClient,
  type RedisChatClient,
  type RedisSortedSetMember,
} from './redis-chat-client.js';
import { createRedisChatKeys, type RedisChatKeys } from './redis-chat-keys.js';
import {
  cleanupExpiredRedisMessages,
  getRedisMessages,
  trimRedisHistory,
} from './redis-chat-messages.js';
import {
  cleanupExpiredRedisSessions,
  saveRedisAdmin,
  saveRedisSession,
} from './redis-chat-sessions.js';
import {
  isNicknameInUse,
} from './redis-chat-rules.js';
import type { ChatMessage, ChatSnapshot, CommandResult } from './types.js';

export { createRedisChatClient, type RedisChatClient, type RedisSortedSetMember };

export class RedisChatStore implements ChatStoreApi {
  private readonly keys: RedisChatKeys;

  constructor(
    private readonly redis: RedisChatClient,
    private readonly adminPassword = '8624',
    private readonly now: () => number = () => Date.now(),
    prefix = 'livechat',
  ) {
    this.keys = createRedisChatKeys(prefix);
  }

  async snapshot(): Promise<ChatSnapshot> {
    await this.cleanupExpiredSessions();
    await this.cleanupExpiredMessages();
    const [messages, stateRecord, versionRaw] = await Promise.all([
      getRedisMessages(this.redis, this.keys.messages),
      this.redis.hgetall(this.keys.state),
      this.redis.get(this.keys.version),
    ]);
    const state = decodeChatState(stateRecord);
    const pinnedNotice = state.pinnedNoticeId
      ? messages.find((message) => message.id === state.pinnedNoticeId) ?? null
      : null;
    return {
      messages,
      anonymousMode: state.anonymousMode,
      pinnedNotice,
      chatActive: state.chatActive,
      version: Number(versionRaw ?? '0'),
    };
  }

  async join(nickname: string): Promise<JoinResult> {
    const cleanNickname = nickname.trim();
    if (!cleanNickname) {
      return { ok: false, error: '이름을 입력해주세요.' };
    }
    const activeSessions = await this.getActiveSessions();
    if (isNicknameInUse(activeSessions, cleanNickname)) {
      return { ok: false, error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.' };
    }
    if (activeSessions.length >= MAX_ACTIVE_PARTICIPANTS) {
      return { ok: false, error: '참여 인원이 30명에 도달했습니다.' };
    }

    const sessionId = randomUUID();
    await saveRedisSession(this.redis, this.keys, {
      id: sessionId,
      nickname: cleanNickname,
      lastSeen: this.now(),
    });
    await this.bumpVersion();
    return { ok: true, sessionId };
  }

  async changeNickname(sessionId: string, nickname: string): Promise<CommandResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return { ok: false, error: '입장 정보가 만료되었습니다. 다시 입장해주세요.' };
    }

    const cleanNickname = nickname.trim();
    if (!cleanNickname) {
      return { ok: false, error: '이름을 입력해주세요.' };
    }
    const activeSessions = await this.getActiveSessions();
    if (
      cleanNickname.toLowerCase() !== session.nickname.toLowerCase() &&
      isNicknameInUse(activeSessions, cleanNickname)
    ) {
      return { ok: false, error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.' };
    }

    await saveRedisSession(this.redis, this.keys, {
      ...session,
      nickname: cleanNickname,
      lastSeen: this.now(),
    });
    await this.bumpVersion();
    return { ok: true };
  }

  async sendMessage(input: SendMessageInput): Promise<CommandResult> {
    const session = await this.getSession(input.sessionId);
    if (!session) {
      return { ok: false, error: '입장 정보가 만료되었습니다. 다시 입장해주세요.' };
    }
    const state = decodeChatState(await this.redis.hgetall(this.keys.state));
    if (!state.chatActive) {
      return { ok: false, error: '관리자에 의해 채팅이 일시적으로 제한되었습니다.' };
    }

    const content = input.content.trim();
    if (!content) {
      return { ok: false, error: '메시지를 입력해주세요.' };
    }

    await this.cleanupExpiredMessages();
    const message: ChatMessage = {
      id: randomUUID(),
      nickname: session.nickname,
      content,
      color: deterministicNicknameColor(session.nickname),
      createdAt: this.now(),
    };
    await this.redis.zadd(this.keys.messages, {
      score: message.createdAt,
      member: encodeRedisJson(message),
    });
    await Promise.all([
      this.trimHistory(),
      saveRedisSession(this.redis, this.keys, { ...session, lastSeen: this.now() }),
    ]);
    await this.bumpVersion();
    return { ok: true };
  }

  async adminLogin(password: string): Promise<AdminLoginResult> {
    if (password !== this.adminPassword) {
      return { ok: false, error: '비밀번호가 틀렸습니다.' };
    }
    const adminToken = randomUUID();
    await saveRedisAdmin(this.redis, this.keys, { token: adminToken, lastSeen: this.now() });
    return { ok: true, adminToken };
  }

  async clearChat(adminToken: string): Promise<CommandResult> {
    const auth = await this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    await Promise.all([
      this.redis.del(this.keys.messages),
      this.redis.hset(this.keys.state, { pinnedNoticeId: '' }),
    ]);
    await this.bumpVersion();
    return { ok: true };
  }

  async toggleAnonymous(adminToken: string, enabled: boolean): Promise<CommandResult> {
    const auth = await this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    await this.redis.hset(this.keys.state, { anonymousMode: redisBoolean(enabled) });
    await this.bumpVersion();
    return { ok: true };
  }

  async pinNotice(adminToken: string, messageId: string): Promise<CommandResult> {
    const auth = await this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    const found = (await getRedisMessages(this.redis, this.keys.messages)).some(
      (message) => message.id === messageId,
    );
    if (!found) {
      return { ok: false, error: '공지로 지정할 메시지를 찾을 수 없습니다.' };
    }
    await this.redis.hset(this.keys.state, { pinnedNoticeId: messageId });
    await this.bumpVersion();
    return { ok: true };
  }

  async unpinNotice(adminToken: string): Promise<CommandResult> {
    const auth = await this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    await this.redis.hset(this.keys.state, { pinnedNoticeId: '' });
    await this.bumpVersion();
    return { ok: true };
  }

  async toggleChatActive(adminToken: string, active: boolean): Promise<CommandResult> {
    const auth = await this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    await this.redis.hset(this.keys.state, { chatActive: redisBoolean(active) });
    await this.bumpVersion();
    return { ok: true };
  }

  private async getSession(sessionId: string): Promise<ParticipantSession | null> {
    const session = decodeParticipantSession(await this.redis.get(this.keys.session(sessionId)));
    if (!session) {
      return null;
    }
    await saveRedisSession(this.redis, this.keys, { ...session, lastSeen: this.now() });
    return session;
  }

  private async getActiveSessions(): Promise<readonly ParticipantSession[]> {
    await this.cleanupExpiredSessions();
    const sessionIds = await this.redis.zrange(this.keys.sessions, 0, -1);
    const sessions = await Promise.all(
      sessionIds.map(async (sessionId) =>
        decodeParticipantSession(await this.redis.get(this.keys.session(sessionId))),
      ),
    );
    return sessions.filter((session) => session !== null);
  }

  private async touchAdmin(adminToken: string): Promise<CommandResult> {
    await this.cleanupExpiredSessions();
    const admin = decodeAdminSession(await this.redis.get(this.keys.admin(adminToken)));
    if (!admin) {
      return { ok: false, error: '관리자 로그인이 만료되었습니다. 다시 로그인해주세요.' };
    }
    await saveRedisAdmin(this.redis, this.keys, { ...admin, lastSeen: this.now() });
    return { ok: true };
  }

  private async cleanupExpiredSessions(): Promise<void> {
    await cleanupExpiredRedisSessions(this.redis, this.keys, this.now());
  }

  private async cleanupExpiredMessages(): Promise<void> {
    await cleanupExpiredRedisMessages(this.redis, this.keys.messages, this.now());
  }

  private async trimHistory(): Promise<void> {
    await trimRedisHistory(this.redis, this.keys.messages);
  }

  private async bumpVersion(): Promise<void> {
    await this.redis.incr(this.keys.version);
  }
}
