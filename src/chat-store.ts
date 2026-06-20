import { randomUUID } from 'node:crypto';
import { CHAT_PALETTE } from './chat-palette.js';
import {
  ADMIN_COLOR,
  ADMIN_NICKNAME,
  ADMIN_TTL_MS,
  MAX_ACTIVE_PARTICIPANTS,
  MAX_HISTORY,
  MESSAGE_RETENTION_MS,
  SESSION_TTL_MS,
  type AdminLoginResult,
  type AdminSession,
  type JoinResult,
  type ParticipantSession,
  type SendMessageInput,
} from './chat-store-types.js';
import type { ChatMessage, ChatSnapshot, CommandResult } from './types';

export class ChatStore {
  private readonly adminPassword: string;
  private readonly now: () => number;
  private readonly sessions = new Map<string, ParticipantSession>();
  private readonly adminSessions = new Map<string, AdminSession>();
  private readonly nicknameColors = new Map<string, string>();
  private messages: ChatMessage[] = [];
  private anonymousMode = false;
  private pinnedNoticeId: string | null = null;
  private chatActive = true;
  private version = 0;

  constructor(adminPassword = '8624', now: () => number = () => Date.now()) {
    this.adminPassword = adminPassword;
    this.now = now;
  }

  snapshot(): ChatSnapshot {
    this.cleanupExpiredSessions();
    this.cleanupExpiredMessages();
    return {
      messages: [...this.messages],
      anonymousMode: this.anonymousMode,
      pinnedNotice: this.getPinnedNotice(),
      chatActive: this.chatActive,
      version: this.version,
    };
  }

  join(nickname: string): JoinResult {
    const cleanNickname = nickname.trim();
    if (!cleanNickname) {
      return { ok: false, error: '이름을 입력해주세요.' };
    }
    if (cleanNickname === ADMIN_NICKNAME) {
      return { ok: false, error: '사용할 수 없는 이름입니다.' };
    }
    if (this.isNicknameInUse(cleanNickname)) {
      return {
        ok: false,
        error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.',
      };
    }
    if (this.sessions.size >= MAX_ACTIVE_PARTICIPANTS) {
      return { ok: false, error: '참여 인원이 40명에 도달했습니다.' };
    }

    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      id: sessionId,
      nickname: cleanNickname,
      lastSeen: this.now(),
    });
    this.getColor(cleanNickname);
    this.bumpVersion();
    return { ok: true, sessionId };
  }

  changeNickname(sessionId: string, nickname: string): CommandResult {
    const session = this.getSession(sessionId);
    if (!session) {
      return { ok: false, error: '입장 정보가 만료되었습니다. 다시 입장해주세요.' };
    }

    const cleanNickname = nickname.trim();
    if (!cleanNickname) {
      return { ok: false, error: '이름을 입력해주세요.' };
    }
    if (cleanNickname === ADMIN_NICKNAME) {
      return { ok: false, error: '사용할 수 없는 이름입니다.' };
    }
    if (
      cleanNickname.toLowerCase() !== session.nickname.toLowerCase() &&
      this.isNicknameInUse(cleanNickname)
    ) {
      return {
        ok: false,
        error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.',
      };
    }

    session.nickname = cleanNickname;
    session.lastSeen = this.now();
    this.getColor(cleanNickname);
    this.bumpVersion();
    return { ok: true };
  }

  sendMessage(input: SendMessageInput): CommandResult {
    const session = this.getSession(input.sessionId);
    if (!session) {
      return { ok: false, error: '입장 정보가 만료되었습니다. 다시 입장해주세요.' };
    }
    if (!this.chatActive) {
      return { ok: false, error: '관리자에 의해 채팅이 일시적으로 제한되었습니다.' };
    }

    const content = input.content.trim();
    if (!content) {
      return { ok: false, error: '메시지를 입력해주세요.' };
    }

    this.cleanupExpiredMessages();
    this.addMessage({
      nickname: session.nickname,
      content,
      color: this.getColor(session.nickname),
    });
    session.lastSeen = this.now();
    this.bumpVersion();
    return { ok: true };
  }

  sendAdminMessage(adminToken: string, content: string): CommandResult {
    const auth = this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }

    const cleanContent = content.trim();
    if (!cleanContent) {
      return { ok: false, error: '메시지를 입력해주세요.' };
    }

    this.cleanupExpiredMessages();
    this.addMessage({
      nickname: ADMIN_NICKNAME,
      content: cleanContent,
      color: ADMIN_COLOR,
    });
    this.bumpVersion();
    return { ok: true };
  }

  adminLogin(password: string): AdminLoginResult {
    if (password !== this.adminPassword) {
      return { ok: false, error: '비밀번호가 틀렸습니다.' };
    }
    const adminToken = randomUUID();
    this.adminSessions.set(adminToken, {
      token: adminToken,
      lastSeen: this.now(),
    });
    return { ok: true, adminToken };
  }

  clearChat(adminToken: string): CommandResult {
    const auth = this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    this.messages = [];
    this.pinnedNoticeId = null;
    this.bumpVersion();
    return { ok: true };
  }

  toggleAnonymous(adminToken: string, enabled: boolean): CommandResult {
    const auth = this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    this.anonymousMode = enabled;
    this.bumpVersion();
    return { ok: true };
  }

  pinNotice(adminToken: string, messageId: string): CommandResult {
    const auth = this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    const found = this.messages.some((message) => message.id === messageId);
    if (!found) {
      return { ok: false, error: '공지로 지정할 메시지를 찾을 수 없습니다.' };
    }
    this.pinnedNoticeId = messageId;
    this.bumpVersion();
    return { ok: true };
  }

  unpinNotice(adminToken: string): CommandResult {
    const auth = this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    this.pinnedNoticeId = null;
    this.bumpVersion();
    return { ok: true };
  }

  toggleChatActive(adminToken: string, active: boolean): CommandResult {
    const auth = this.touchAdmin(adminToken);
    if (!auth.ok) {
      return auth;
    }
    this.chatActive = active;
    this.bumpVersion();
    return { ok: true };
  }

  private getPinnedNotice(): ChatMessage | null {
    if (!this.pinnedNoticeId) {
      return null;
    }
    return this.messages.find((message) => message.id === this.pinnedNoticeId) ?? null;
  }

  private getSession(sessionId: string): ParticipantSession | null {
    this.cleanupExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    session.lastSeen = this.now();
    return session;
  }

  private isNicknameInUse(nickname: string): boolean {
    this.cleanupExpiredSessions();
    const normalized = nickname.toLowerCase();
    return [...this.sessions.values()].some(
      (session) => session.nickname.toLowerCase() === normalized,
    );
  }

  private getColor(nickname: string): string {
    const existing = this.nicknameColors.get(nickname);
    if (existing) {
      return existing;
    }
    const color =
      CHAT_PALETTE[this.nicknameColors.size % CHAT_PALETTE.length] ?? CHAT_PALETTE[0];
    this.nicknameColors.set(nickname, color);
    return color;
  }

  private addMessage(input: {
    readonly nickname: string;
    readonly content: string;
    readonly color: string;
  }): void {
    this.messages = [
      ...this.messages,
      {
        id: randomUUID(),
        nickname: input.nickname,
        content: input.content,
        color: input.color,
        createdAt: this.now(),
      },
    ].slice(Math.max(0, this.messages.length + 1 - MAX_HISTORY));
  }

  private touchAdmin(adminToken: string): CommandResult {
    this.cleanupExpiredSessions();
    const admin = this.adminSessions.get(adminToken);
    if (!admin) {
      return { ok: false, error: '관리자 로그인이 만료되었습니다. 다시 로그인해주세요.' };
    }
    admin.lastSeen = this.now();
    return { ok: true };
  }

  private cleanupExpiredSessions(): void {
    const currentTime = this.now();
    for (const [sessionId, session] of this.sessions) {
      if (currentTime - session.lastSeen > SESSION_TTL_MS) {
        this.sessions.delete(sessionId);
      }
    }
    for (const [adminToken, admin] of this.adminSessions) {
      if (currentTime - admin.lastSeen > ADMIN_TTL_MS) {
        this.adminSessions.delete(adminToken);
      }
    }
  }

  private cleanupExpiredMessages(): void {
    const currentTime = this.now();
    const nextMessages = this.messages.filter(
      (message) => currentTime - message.createdAt <= MESSAGE_RETENTION_MS,
    );
    if (nextMessages.length === this.messages.length) {
      return;
    }
    this.messages = nextMessages;
    if (this.pinnedNoticeId && !this.messages.some((message) => message.id === this.pinnedNoticeId)) {
      this.pinnedNoticeId = null;
    }
    this.bumpVersion();
  }

  private bumpVersion(): void {
    this.version += 1;
  }
}
