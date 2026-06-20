import { describe, expect, it } from 'vitest';
import { MESSAGE_RETENTION_MS } from './chat-store-types';
import { RedisChatStore, type RedisChatClient, type RedisSortedSetMember } from './redis-chat-store';

describe('RedisChatStore', () => {
  it('keeps messages available across store instances', async () => {
    let currentTime = 1_000;
    const redis = new FakeRedisClient(() => currentTime);
    const firstStore = new RedisChatStore(redis, '8624', () => currentTime);
    const secondStore = new RedisChatStore(redis, '8624', () => currentTime);

    const join = await firstStore.join('민수');
    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }

    expect(
      await firstStore.sendMessage({
        sessionId: join.sessionId,
        content: '질문 있습니다',
      }),
    ).toEqual({ ok: true });

    currentTime += 500;

    expect((await secondStore.snapshot()).messages).toMatchObject([
      {
        nickname: '민수',
        content: '질문 있습니다',
      },
    ]);
  });

  it('reserves the admin nickname for admin messages', async () => {
    const store = new RedisChatStore(new FakeRedisClient(() => 1_000));

    expect(await store.join('관리자')).toEqual({
      ok: false,
      error: '사용할 수 없는 이름입니다.',
    });
  });

  it('lets an admin send messages from the admin panel', async () => {
    const store = new RedisChatStore(new FakeRedisClient(() => 1_000));
    const login = await store.adminLogin('8624');
    expect(login.ok).toBe(true);
    if (!login.ok) {
      return;
    }

    expect(await store.sendAdminMessage(login.adminToken, '관리자 안내입니다')).toEqual({
      ok: true,
    });
    expect((await store.snapshot()).messages).toMatchObject([
      {
        nickname: '관리자',
        content: '관리자 안내입니다',
        color: '#111827',
      },
    ]);
  });

  it('removes chat history after ninety minutes', async () => {
    let currentTime = 1_000;
    const store = new RedisChatStore(new FakeRedisClient(() => currentTime), '8624', () => currentTime);

    const join = await store.join('시간확인');
    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }

    expect(
      await store.sendMessage({
        sessionId: join.sessionId,
        content: '90분 보존 메시지',
      }),
    ).toEqual({ ok: true });

    currentTime += MESSAGE_RETENTION_MS;
    expect((await store.snapshot()).messages).toHaveLength(1);

    currentTime += 1;
    expect((await store.snapshot()).messages).toEqual([]);
  });
});

class FakeRedisClient implements RedisChatClient {
  private readonly strings = new Map<string, StoredString>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly sortedSets = new Map<string, Map<string, number>>();

  constructor(private readonly now: () => number) {}

  async get(key: string): Promise<string | null> {
    const stored = this.strings.get(key);
    if (!stored) {
      return null;
    }
    if (stored.expiresAt !== null && this.now() > stored.expiresAt) {
      this.strings.delete(key);
      return null;
    }
    return stored.value;
  }

  async set(key: string, value: string, options?: { readonly ex?: number }): Promise<void> {
    this.strings.set(key, {
      value,
      expiresAt: options?.ex ? this.now() + options.ex * 1000 : null,
    });
  }

  async del(...keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      this.strings.delete(key);
      this.hashes.delete(key);
      this.sortedSets.delete(key);
    }
  }

  async incr(key: string): Promise<number> {
    const current = Number((await this.get(key)) ?? '0') + 1;
    await this.set(key, String(current));
    return current;
  }

  async zadd(key: string, member: RedisSortedSetMember): Promise<void> {
    const sortedSet = this.getSortedSet(key);
    sortedSet.set(member.member, member.score);
  }

  async zrange(key: string, start: number, stop: number): Promise<readonly string[]> {
    const sorted = [...this.getSortedSet(key).entries()]
      .sort((left, right) => left[1] - right[1])
      .map(([member]) => member);
    const normalizedStop = stop < 0 ? sorted.length + stop : stop;
    return sorted.slice(start, normalizedStop + 1);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    const sortedSet = this.getSortedSet(key);
    for (const [member, score] of sortedSet) {
      if (score >= min && score <= max) {
        sortedSet.delete(member);
      }
    }
  }

  async zcard(key: string): Promise<number> {
    return this.getSortedSet(key).size;
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<void> {
    const members = await this.zrange(key, start, stop);
    for (const member of members) {
      this.getSortedSet(key).delete(member);
    }
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    const hash = this.hashes.get(key);
    return hash ? Object.fromEntries(hash.entries()) : null;
  }

  async hset(key: string, values: Record<string, string>): Promise<void> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    for (const [field, value] of Object.entries(values)) {
      hash.set(field, value);
    }
    this.hashes.set(key, hash);
  }

  private getSortedSet(key: string): Map<string, number> {
    const existing = this.sortedSets.get(key);
    if (existing) {
      return existing;
    }
    const sortedSet = new Map<string, number>();
    this.sortedSets.set(key, sortedSet);
    return sortedSet;
  }
}

type StoredString = {
  readonly value: string;
  readonly expiresAt: number | null;
};
