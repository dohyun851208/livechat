import { describe, expect, it } from 'vitest';
import { shouldPollChat } from './chat-polling';

describe('shouldPollChat', () => {
  it('does not poll before a user enters a live view', () => {
    expect(shouldPollChat('idle', true)).toBe(false);
    expect(shouldPollChat('idle', false)).toBe(false);
  });

  it('keeps polling in the participant chat so unlocks can be observed', () => {
    expect(shouldPollChat('chat', true)).toBe(true);
    expect(shouldPollChat('chat', false)).toBe(true);
  });

  it('keeps polling in the admin panel so lock state stays visible', () => {
    expect(shouldPollChat('admin', true)).toBe(true);
    expect(shouldPollChat('admin', false)).toBe(true);
  });
});
