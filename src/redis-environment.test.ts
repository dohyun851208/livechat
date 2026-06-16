import { describe, expect, it } from 'vitest';
import { readRedisEnvironment } from './redis-environment';

describe('readRedisEnvironment', () => {
  it('trims bom and newlines from Vercel environment values', () => {
    expect(
      readRedisEnvironment({
        UPSTASH_REDIS_REST_URL: '\uFEFFhttps://example.upstash.io\r\n',
        UPSTASH_REDIS_REST_TOKEN: '\uFEFF token-value \r\n',
      }),
    ).toEqual({
      url: 'https://example.upstash.io',
      token: 'token-value',
      prefix: 'livechat',
    });
  });
});
