import { randomUUID } from 'node:crypto';
import { CHAT_PALETTE } from './chat-palette';
import type { ChatMessage, ChatSnapshot, CommandResult } from './types';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const ADMIN_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HISTORY = 300;

type ParticipantSession = {
  readonly id: string;
  nickname: string;
  lastSeen: number;
};

type AdminSession = {
  readonly token: string;
  lastSeen: number;
};

type JoinResult =
  | { readonly ok: true; readonly sessionId: string; readonly error?: undefined }
  | { readonly ok: false; readonly error: string };

type AdminLoginResult =
  | { readonly ok: true; readonly adminToken: string; readonly error?: undefined }
  | { readonly ok: false; readonly error: string };

type SendMessageInput = {
  readonly sessionId: string;
  readonly content: string;
};

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
    if (this.isNicknameInUse(cleanNickname)) {
      return {
        ok: false,
        error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.',
      };
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

    this.messages = [
      ...this.messages.slice(Math.max(0, this.messages.length - MAX_HISTORY + 1)),
      {
        id: randomUUID(),
        nickname: session.nickname,
        content,
        color: this.getColor(session.nickname),
        createdAt: this.now(),
      },
    ];
    session.lastSeen = this.now();
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

  private bumpVersion(): void {
    this.version += 1;
  }
}
