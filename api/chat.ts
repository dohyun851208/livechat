import type { IncomingMessage, ServerResponse } from 'node:http';
import { getChatStateResponse, handleChatAction } from '../src/chat-controller.js';
import { getGlobalChatStore } from '../src/global-chat-store.js';

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  const store = getGlobalChatStore();

  if (request.method === 'GET') {
    sendJson(response, 200, await getChatStateResponse(store));
    return;
  }

  if (request.method === 'POST') {
    const body = await readJsonBody(request);
    const result = await handleChatAction(store, body);
    sendJson(response, result.ok ? 200 : 400, result);
    return;
  }

  sendJson(response, 405, {
    ok: false,
    error: '지원하지 않는 요청 방식입니다.',
    state: await store.snapshot(),
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk, 'utf8'));
    }
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {};
    }
    throw error;
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}
