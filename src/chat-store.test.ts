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

  it('reserves the admin nickname for admin messages', () => {
    const store = new ChatStore();

    expect(store.join('관리자')).toEqual({
      ok: false,
      error: '사용할 수 없는 이름입니다.',
    });
  });

  it('lets an admin send messages from the admin panel', () => {
    const store = new ChatStore();
    const login = store.adminLogin('8624');
    expect(login.ok).toBe(true);
    if (!login.ok) {
      return;
    }

    expect(store.sendAdminMessage(login.adminToken, '관리자 안내입니다')).toEqual({
      ok: true,
    });
    expect(store.snapshot().messages).toMatchObject([
      {
        nickname: '관리자',
        content: '관리자 안내입니다',
        color: '#111827',
      },
    ]);
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

  it('keeps messages for ninety minutes and removes older history', () => {
    let currentTime = 1_000;
    const store = new ChatStore('8624', () => currentTime);
    const join = store.join('시간확인');
    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }

    expect(
      store.sendMessage({
        sessionId: join.sessionId,
        content: '90분 보존 메시지',
      }),
    ).toEqual({ ok: true });

    currentTime += 90 * 60 * 1000;
    expect(store.snapshot().messages).toHaveLength(1);

    currentTime += 1;
    expect(store.snapshot().messages).toEqual([]);
  });

  it('allows forty active participants and rejects the forty first', () => {
    const store = new ChatStore();

    for (let index = 1; index <= 40; index += 1) {
      expect(store.join(`학생${index}`).ok).toBe(true);
    }

    expect(store.join('학생41')).toEqual({
      ok: false,
      error: '참여 인원이 40명에 도달했습니다.',
    });
  });
});
