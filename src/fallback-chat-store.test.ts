import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatStore } from './chat-store';
import { FallbackChatStore } from './fallback-chat-store';
import type { ChatStoreApi } from './chat-store-api';

afterEach(() => vi.restoreAllMocks());

describe('temporary storage fallback', () => {
  it('shares one fallback across simultaneous Redis failures', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const primary: ChatStoreApi = new ChatStore('admin');
    vi.spyOn(primary, 'join').mockImplementation(async () => { throw new Error('Redis unavailable'); });
    const createFallback = vi.fn(() => new ChatStore('admin'));
    const store = new FallbackChatStore(primary, createFallback);
    const results = await Promise.all([store.join('alice'), store.join('bob')]);
    expect(createFallback).toHaveBeenCalledTimes(1);
    for (const participant of results) {
      if (!participant.ok) throw new Error('Join failed');
      expect(await store.sendMessage({ sessionId: participant.sessionId, content: 'hello' })).toEqual({ ok: true });
    }
    expect((await store.snapshot()).messages).toHaveLength(2);
  });

  it('keeps authentication failures in the primary store', async () => {
    const primary = new ChatStore('admin');
    const createFallback = vi.fn(() => new ChatStore('admin'));
    const store = new FallbackChatStore(primary, createFallback);
    expect(await store.clearChat('forged')).toMatchObject({ ok: false, code: 'ADMIN_SESSION_EXPIRED' });
    expect(createFallback).not.toHaveBeenCalled();
  });
});
