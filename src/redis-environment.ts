export type RedisEnvironment = {
  readonly url: string;
  readonly token: string;
  readonly prefix: string;
};

export type RedisEnvironmentSource = {
  readonly UPSTASH_REDIS_REST_URL?: string;
  readonly UPSTASH_REDIS_REST_TOKEN?: string;
  readonly KV_REST_API_URL?: string;
  readonly KV_REST_API_TOKEN?: string;
  readonly LIVECHAT_REDIS_PREFIX?: string;
};

export function readRedisEnvironment(
  source: RedisEnvironmentSource,
): RedisEnvironment | null {
  const url = (source.UPSTASH_REDIS_REST_URL ?? source.KV_REST_API_URL)?.trim();
  const token = (
    source.UPSTASH_REDIS_REST_TOKEN ?? source.KV_REST_API_TOKEN
  )?.trim();
  if (!url || !token) {
    return null;
  }
  return {
    url,
    token,
    prefix: source.LIVECHAT_REDIS_PREFIX?.trim() || 'livechat',
  };
}
