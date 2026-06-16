export type RedisChatKeys = {
  readonly messages: string;
  readonly sessions: string;
  readonly admins: string;
  readonly state: string;
  readonly version: string;
  readonly session: (sessionId: string) => string;
  readonly admin: (adminToken: string) => string;
};

export function createRedisChatKeys(prefix: string): RedisChatKeys {
  return {
    messages: `${prefix}:messages`,
    sessions: `${prefix}:sessions`,
    admins: `${prefix}:admins`,
    state: `${prefix}:state`,
    version: `${prefix}:version`,
    session: (sessionId) => `${prefix}:session:${sessionId}`,
    admin: (adminToken) => `${prefix}:admin:${adminToken}`,
  };
}
