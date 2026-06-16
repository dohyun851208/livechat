export const CHAT_POLL_INTERVAL_MS = 1_000;

export type ChatPollingMode = 'idle' | 'chat' | 'admin';

export function shouldPollChat(
  mode: ChatPollingMode,
  chatActive: boolean,
): boolean {
  switch (mode) {
    case 'idle':
      return false;
    case 'chat':
      return true;
    case 'admin':
      return chatActive;
  }
}
