import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGlobalChatStore } from './global-chat-store';

beforeEach(() => {
  globalThis.__livechatStore = undefined;
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis-test.invalid');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-only');
  vi.stubEnv('ADMIN_PASSWORD', 'test-admin');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  globalThis.__livechatStore = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Redis connection failure during entry', () => {
  it('enters using temporary storage without retrying a failed connection', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetch);
    const store = getGlobalChatStore();
    const joined = await store.join('student');
    expect(joined).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(await store.join('second')).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('accepts the requested default admin password in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_PASSWORD', '');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const store = getGlobalChatStore();
    expect(await store.adminLogin('8624')).toMatchObject({ ok: true });
    expect(await store.adminLogin('incorrect')).toMatchObject({ ok: false });
  });
});
