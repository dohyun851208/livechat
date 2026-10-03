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

  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST, OPTIONS');
    sendJson(response, 405, {
      ok: false,
      error: '지원하지 않는 요청 방식입니다.',
    });
    return;
  }

  try {
    const store = getGlobalChatStore();
    if (request.method === 'GET') {
      sendJson(response, 200, await getChatStateResponse(store));
      return;
    }

    const body = await readJsonBody(request);
    const result = await handleChatAction(store, body);
    sendJson(response, result.ok ? 200 : 400, result);
  } catch {
    sendJson(response, 503, {
      ok: false,
      error: '채팅 서버에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
    });
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  // Vercel may have already consumed the stream and populated request.body.
  const parsedBody = (request as IncomingMessage & { body?: unknown }).body;
  if (parsedBody !== undefined) {
    if (typeof parsedBody === 'string' || Buffer.isBuffer(parsedBody)) {
      return parseJson(parsedBody.toString());
    }
    return parsedBody;
  }

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

  return parseJson(Buffer.concat(chunks).toString('utf8'));
}

function parseJson(rawBody: string): unknown {
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
