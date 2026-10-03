import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './chat';
import { ChatStore } from '../src/chat-store';
import { ChatApiResponseSchema } from '../src/chat-contract';

describe('Vercel chat API', () => {
  let store: ChatStore;

  beforeEach(() => {
    store = new ChatStore('test-admin');
    globalThis.__livechatStore = store;
  });

  afterEach(() => {
    globalThis.__livechatStore = undefined;
    vi.restoreAllMocks();
  });

  it.each([
    { action: 'join', nickname: '민수' },
    JSON.stringify({ action: 'join', nickname: '민수' }),
    Buffer.from(JSON.stringify({ action: 'join', nickname: '민수' })),
  ])('accepts an already parsed request body: %j', async (body) => {
    const request = requestWithBody('POST', body);
    const result = await invoke(request);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, sessionId: expect.any(String) });
  });

  it('accepts JSON from a raw request stream', async () => {
    const request = Readable.from([
      Buffer.from(JSON.stringify({ action: 'join', nickname: '서연' })),
    ]) as unknown as IncomingMessage;
    request.method = 'POST';
    expect((await invoke(request)).body).toMatchObject({ ok: true });
  });

  it('rejects malformed JSON with a typed response', async () => {
    const result = await invoke(requestWithBody('POST', '{broken'));
    expect(result.status).toBe(400);
    expect(ChatApiResponseSchema.safeParse(result.body).success).toBe(true);
  });

  it('returns a recovery code after an administrator resets nicknames', async () => {
    const joined = store.join('민수');
    const admin = store.adminLogin('test-admin');
    if (!joined.ok || !admin.ok) throw new Error('Test setup failed');
    store.resetNicknames(admin.adminToken);

    const result = await invoke(requestWithBody('POST', {
      action: 'send_message', sessionId: joined.sessionId, content: 'hello',
    }));
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ ok: false, code: 'SESSION_EXPIRED' });
    expect(ChatApiResponseSchema.safeParse(result.body).success).toBe(true);
  });

  it('rejects privileged actions without a valid administrator token', async () => {
    const result = await invoke(requestWithBody('POST', {
      action: 'clear_chat', adminToken: 'forged', isAdmin: true,
    }));
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ ok: false, code: 'ADMIN_SESSION_EXPIRED' });
  });

  it('returns JSON on storage failure and retries the same store next time', async () => {
    const snapshot = vi.spyOn(store, 'snapshot');
    snapshot.mockImplementationOnce(() => { throw new Error('Storage unavailable'); });
    const result = await invoke(requestWithBody('GET'));
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ ok: false });
    expect(ChatApiResponseSchema.safeParse(result.body).success).toBe(true);
    expect((await invoke(requestWithBody('GET'))).status).toBe(200);
  });

  it('rejects unsupported methods without reading storage', async () => {
    const snapshot = vi.spyOn(store, 'snapshot');
    const result = await invoke(requestWithBody('DELETE'));
    expect(result.status).toBe(405);
    expect(result.headers.Allow).toBe('GET, POST, OPTIONS');
    expect(snapshot).not.toHaveBeenCalled();
  });
});

function requestWithBody(method: string, body?: unknown): IncomingMessage {
  const request = Readable.from([]) as unknown as IncomingMessage & { body?: unknown };
  request.method = method;
  request.body = body;
  return request;
}

async function invoke(request: IncomingMessage) {
  let body = '';
  const headers: Record<string, unknown> = {};
  const response = {
    statusCode: 0,
    setHeader(name: string, value: unknown) { headers[name] = value; },
    end(value: string) { body = value; },
  };
  await handler(request, response as unknown as ServerResponse);
  return { status: response.statusCode, headers, body: body ? JSON.parse(body) : null };
}
