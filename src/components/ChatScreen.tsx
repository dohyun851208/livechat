import { Lock, Send, Settings } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '../lib/cn';
import type { ChatMessage, CommandResult } from '../types';
import { ChatLine } from './ChatLine';
import { PinnedNotice } from './PinnedNotice';

type ChatScreenProps = {
  readonly nickname: string;
  readonly setAppNickname: (nickname: string) => void;
  readonly messages: readonly ChatMessage[];
  readonly anonymousMode: boolean;
  readonly onSend: (content: string) => Promise<CommandResult>;
  readonly onChangeNickname: (nickname: string) => Promise<CommandResult>;
  readonly onAdmin: () => void;
  readonly isConnected: boolean;
  readonly pinnedNotice: ChatMessage | null;
  readonly chatActive: boolean;
};

export function ChatScreen({
  nickname,
  setAppNickname,
  messages,
  anonymousMode,
  onSend,
  onChangeNickname,
  onAdmin,
  isConnected,
  pinnedNotice,
  chatActive,
}: ChatScreenProps) {
  const [messageInput, setMessageInput] = useState('');
  const [sendError, setSendError] = useState('');
  const [isChangingNickname, setIsChangingNickname] = useState(false);
  const [newNicknameInput, setNewNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanMessage = messageInput.trim();
    if (!cleanMessage || !chatActive) {
      return;
    }

    const result = await onSend(cleanMessage);
    if (result.ok === true) {
      setMessageInput('');
      setSendError('');
    } else {
      setSendError(result.error);
    }
  };

  const startChangingNickname = () => {
    setNewNicknameInput(nickname);
    setNicknameError('');
    setIsChangingNickname(true);
  };

  const handleChangeNickname = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanNickname = newNicknameInput.trim();
    if (!cleanNickname) {
      setNicknameError('이름을 입력해주세요.');
      return;
    }

    const result = await onChangeNickname(cleanNickname);
    if (result.ok === true) {
      setAppNickname(cleanNickname);
      setIsChangingNickname(false);
      setNicknameError('');
    } else {
      setNicknameError(result.error);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-white/80 backdrop-blur-sm z-10 sticky top-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-semibold text-gray-800 whitespace-nowrap">실시간 채팅</h3>
          <span
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500',
            )}
            title={isConnected ? '채팅 서버 연결 완료' : '채팅 서버 연결 대기 중'}
          />
          {!isConnected && (
            <span className="text-[10px] text-red-500 font-medium whitespace-nowrap animate-pulse">
              연결 중...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isChangingNickname ? (
            <button
              onClick={startChangingNickname}
              className="text-xs text-gray-500 font-medium px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full truncate max-w-[120px]"
              title="닉네임 변경"
            >
              {nickname}
            </button>
          ) : (
            <form onSubmit={handleChangeNickname} className="flex flex-col relative items-end">
              <div className="flex items-center shadow-sm">
                <input
                  type="text"
                  autoFocus
                  className="text-xs px-2 py-1 bg-white border border-blue-200 rounded-l-md w-24 outline-none focus:ring-1 focus:ring-blue-500"
                  value={newNicknameInput}
                  onChange={(event) => setNewNicknameInput(event.target.value)}
                  maxLength={20}
                />
                <button
                  type="submit"
                  className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 transition-colors"
                >
                  변경
                </button>
                <button
                  type="button"
                  onClick={() => setIsChangingNickname(false)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 px-2 py-1 rounded-r-md transition-colors border border-l-0 border-gray-200"
                >
                  취소
                </button>
              </div>
            </form>
          )}

          <button
            onClick={onAdmin}
            className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-md transition-colors shrink-0"
            title="관리자 모드"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {nicknameError && (
        <div className="absolute top-[52px] right-4 bg-red-100 border border-red-200 text-red-600 text-[11px] px-2 py-1 rounded shadow-sm z-20">
          {nicknameError}
        </div>
      )}

      {pinnedNotice && (
        <PinnedNotice
          notice={pinnedNotice}
          anonymousMode={anonymousMode}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 pb-8">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
            <p className="text-sm">채팅 내용이 없습니다.</p>
            <p className="text-xs">첫 메시지를 남겨보세요.</p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatLine
              key={message.id}
              message={message}
              anonymousMode={anonymousMode}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-100 bg-white p-3 sm:pb-4 relative">
        {!chatActive && (
          <div className="absolute inset-0 bg-gray-50/90 z-10 flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
              <Lock size={14} className="text-gray-400" />
              관리자에 의해 채팅이 일시적으로 제한되었습니다.
            </span>
          </div>
        )}
        {sendError && <p className="text-red-500 text-xs mb-2 px-2">{sendError}</p>}
        <form
          onSubmit={handleSend}
          className="relative flex items-center pr-1 bg-gray-50 border border-gray-200 rounded-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all"
        >
          <input
            type="text"
            className="flex-1 bg-transparent px-4 py-3 outline-none text-[15px] text-gray-800 placeholder:text-gray-400 min-w-0"
            placeholder="메시지를 입력하세요..."
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            disabled={!chatActive}
            maxLength={300}
          />
          <button
            type="submit"
            disabled={!messageInput.trim() || !chatActive}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white p-2 rounded-full transition-colors shrink-0"
          >
            <Send size={18} className="translate-x-[1px] translate-y-[-1px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
