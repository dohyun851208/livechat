import { describe, expect, it } from 'vitest';
import { ChatStore } from './chat-store';

describe('ChatStore', () => {
  it('adds a message to the snapshot when a joined participant sends one', () => {
    const store = new ChatStore();

    const join = store.join('민수');
    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }

    const sent = store.sendMessage({
      sessionId: join.sessionId,
      content: '질문 있습니다',
    });

    expect(sent.ok).toBe(true);
    expect(store.snapshot().messages).toMatchObject([
      {
        nickname: '민수',
        content: '질문 있습니다',
      },
    ]);
  });

  it('rejects duplicated active nicknames', () => {
    const store = new ChatStore();

    const firstJoin = store.join('지우');
    const secondJoin = store.join('지우');

    expect(firstJoin.ok).toBe(true);
    expect(secondJoin).toEqual({
      ok: false,
      error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.',
    });
  });

  it('lets an admin pin and clear messages', () => {
    const store = new ChatStore();
    const join = store.join('서연');
    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }

    const sent = store.sendMessage({
      sessionId: join.sessionId,
      content: '공지로 올려주세요',
    });
    expect(sent.ok).toBe(true);

    const login = store.adminLogin('8624');
    expect(login.ok).toBe(true);
    if (!login.ok) {
      return;
    }

    const [message] = store.snapshot().messages;
    expect(message).toBeDefined();
    if (!message) {
      return;
    }

    expect(store.pinNotice(login.adminToken, message.id)).toEqual({ ok: true });
    expect(store.snapshot().pinnedNotice?.content).toBe('공지로 올려주세요');

    expect(store.clearChat(login.adminToken)).toEqual({ ok: true });
    expect(store.snapshot().messages).toEqual([]);
    expect(store.snapshot().pinnedNotice).toBeNull();
  });
});
