export const NINETY_MINUTES_MS = 90 * 60 * 1000;
export const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
export const SESSION_TTL_MS = THREE_HOURS_MS;
export const MESSAGE_RETENTION_MS = NINETY_MINUTES_MS;
export const ADMIN_TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_HISTORY = 2_000;
export const MAX_ACTIVE_PARTICIPANTS = 40;
export const ADMIN_NICKNAME = '관리자';
export const ADMIN_COLOR = '#111827';

export type ParticipantSession = {
  readonly id: string;
  nickname: string;
  lastSeen: number;
};

export type AdminSession = {
  readonly token: string;
  lastSeen: number;
};

export type JoinResult =
  | { readonly ok: true; readonly sessionId: string; readonly error?: undefined }
  | { readonly ok: false; readonly error: string };

export type AdminLoginResult =
  | { readonly ok: true; readonly adminToken: string; readonly error?: undefined }
  | { readonly ok: false; readonly error: string };

export type SendMessageInput = {
  readonly sessionId: string;
  readonly content: string;
};
