import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { Redis } from '@upstash/redis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RedisChatStore, createRedisChatClient } from './redis-chat-store';
import { createRedisChatKeys } from './redis-chat-keys';
import { readRedisEnvironment } from './redis-environment';

const enabled = process.env.LIVECHAT_TEST_REDIS === '1';
if (enabled && existsSync('.env.local')) loadEnvFile('.env.local');

describe.skipIf(!enabled)('Redis concurrent requests (isolated test namespace)', () => {
  let redis: Redis;
  let keys: ReturnType<typeof createRedisChatKeys>;
  let first: RedisChatStore;
  let second: RedisChatStore;

  beforeEach(() => {
    const environment = readRedisEnvironment(process.env);
    if (!environment) throw new Error('Redis test credentials are missing');
    redis = new Redis({ url: environment.url, token: environment.token });
    const prefix = `livechat:test:${randomUUID()}`;
    keys = createRedisChatKeys(prefix);
    first = new RedisChatStore(createRedisChatClient(redis), 'test-admin', Date.now, prefix);
    second = new RedisChatStore(createRedisChatClient(redis), 'test-admin', Date.now, prefix);
  });

  afterEach(async () => {
    if (!redis || !keys) return;
    const [sessions, admins] = await Promise.all([
      redis.zrange<string[]>(keys.sessions, 0, -1),
      redis.zrange<string[]>(keys.admins, 0, -1),
    ]);
    await redis.del(
      keys.messages, keys.state, keys.sessions, keys.admins, keys.version,
      ...sessions.map(keys.session), ...admins.map(keys.admin),
    );
  });

  it('allows only one owner of a nickname during concurrent joins', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      (index % 2 ? first : second).join(index % 2 ? 'Alice' : 'alice'),
    ));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  }, 30000);

  it('enforces forty participants across concurrent store instances', async () => {
    const results = await Promise.all(Array.from({ length: 48 }, (_, index) =>
      (index % 2 ? first : second).join(`participant-${index}`),
    ));
    expect(results.filter((result) => result.ok)).toHaveLength(40);
    expect(results.filter((result) => !result.ok)).toHaveLength(8);
  }, 30000);

  it('allows only one concurrent nickname change to the same name', async () => {
    const alice = await first.join('alice');
    const bob = await second.join('bob');
    if (!alice.ok || !bob.ok) throw new Error('Test setup failed');
    const results = await Promise.all([
      first.changeNickname(alice.sessionId, 'shared'),
      second.changeNickname(bob.sessionId, 'SHARED'),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  }, 30000);

  it('shares messages and administrator settings across store instances', async () => {
    const participant = await first.join('student');
    const admin = await second.adminLogin('test-admin');
    if (!participant.ok || !admin.ok) throw new Error('Test setup failed');
    expect(await first.sendMessage({ sessionId: participant.sessionId, content: 'hello' })).toEqual({ ok: true });
    let snapshot = await second.snapshot();
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]).toMatchObject({ nickname: 'student', content: 'hello' });
    await second.pinNotice(admin.adminToken, snapshot.messages[0].id);
    await second.toggleAnonymous(admin.adminToken, true);
    await second.toggleChatActive(admin.adminToken, false);
    snapshot = await first.snapshot();
    expect(snapshot).toMatchObject({ anonymousMode: true, chatActive: false });
    expect(snapshot.pinnedNotice?.content).toBe('hello');
  }, 30000);
});
