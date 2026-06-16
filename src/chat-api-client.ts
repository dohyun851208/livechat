import ky from 'ky';
import {
  ChatApiResponseSchema,
  toChatApiResponse,
  type ChatAction,
  type ChatApiResponse,
} from './chat-contract';

class ChatApiClientError extends Error {
  readonly name = 'ChatApiClientError';
}

export async function fetchChatState(): Promise<ChatApiResponse> {
  const response = await ky.get('/api/chat', {
    timeout: 5000,
    retry: { limit: 0 },
    throwHttpErrors: false,
  });
  return parseChatResponse(response);
}

export async function postChatAction(action: ChatAction): Promise<ChatApiResponse> {
  const response = await ky.post('/api/chat', {
    json: action,
    timeout: 5000,
    retry: { limit: 0 },
    throwHttpErrors: false,
  });
  return parseChatResponse(response);
}

async function parseChatResponse(response: Response): Promise<ChatApiResponse> {
  const body: unknown = await response.json();
  const parsed = ChatApiResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ChatApiClientError('채팅 서버 응답 형식이 올바르지 않습니다.');
  }
  return toChatApiResponse(parsed.data);
}
