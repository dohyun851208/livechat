import { Redis } from '@upstash/redis';

export type RedisSortedSetMember = {
  readonly score: number;
  readonly member: string;
};

export type RedisSetOptions = {
  readonly ex?: number;
};

export interface RedisChatClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: RedisSetOptions): Promise<unknown>;
  del(...keys: readonly string[]): Promise<unknown>;
  incr(key: string): Promise<number>;
  zadd(key: string, member: RedisSortedSetMember): Promise<unknown>;
  zrange(key: string, start: number, stop: number): Promise<readonly string[]>;
  zremrangebyscore(key: string, min: number, max: number): Promise<unknown>;
  zcard(key: string): Promise<number>;
  zremrangebyrank(key: string, start: number, stop: number): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  hset(key: string, values: Record<string, string>): Promise<unknown>;
}

export function createRedisChatClient(redis: Redis): RedisChatClient {
  return {
    async get(key) {
      return toRedisString(await redis.get(key));
    },
    async set(key, value, options) {
      return options?.ex ? redis.set(key, value, { ex: options.ex }) : redis.set(key, value);
    },
    async del(...keys) {
      return redis.del(...keys);
    },
    async incr(key) {
      return redis.incr(key);
    },
    async zadd(key, member) {
      return redis.zadd(key, member);
    },
    async zrange(key, start, stop) {
      const members = await redis.zrange(key, start, stop);
      return members.map(toStoredMember);
    },
    async zremrangebyscore(key, min, max) {
      return redis.zremrangebyscore(key, min, max);
    },
    async zcard(key) {
      return redis.zcard(key);
    },
    async zremrangebyrank(key, start, stop) {
      return redis.zremrangebyrank(key, start, stop);
    },
    async hgetall(key) {
      return toStringRecord(await redis.hgetall(key));
    },
    async hset(key, values) {
      return redis.hset(key, values);
    },
  };
}

function toRedisString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function toStoredMember(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function toStringRecord(value: unknown): Record<string, string> | null {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const entries = Object.entries(value).map(([key, fieldValue]) => [
    key,
    String(fieldValue),
  ]);
  return Object.fromEntries(entries);
}
