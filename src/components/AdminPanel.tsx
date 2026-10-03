import {
  ChevronDown,
  ChevronUp,
  Eye,
  Lock,
  LogOut,
  RotateCcw,
  Send,
  Settings,
  Trash2,
  Unlock,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '../lib/cn';
import type { ChatMessage, CommandResult } from '../types';
import { AdminChatLine } from './AdminChatLine';
import { AdminPinnedNotice } from './AdminPinnedNotice';
import { ChatLine } from './ChatLine';
import { PinnedNotice } from './PinnedNotice';

type AdminPanelProps = {
  readonly messages: readonly ChatMessage[];
  readonly anonymousMode: boolean;
  readonly onClear: () => Promise<CommandResult>;
  readonly onResetNicknames: () => Promise<CommandResult>;
  readonly onToggleAnonymous: (enabled: boolean) => Promise<CommandResult>;
  readonly onToggleChatActive: (active: boolean) => Promise<CommandResult>;
  readonly onSendMessage: (content: string) => Promise<CommandResult>;
  readonly onPinNotice: (messageId: string) => Promise<CommandResult>;
  readonly onUnpinNotice: () => Promise<CommandResult>;
  readonly onLogout: () => void;
  readonly isConnected: boolean;
  readonly pinnedNotice: ChatMessage | null;
  readonly chatActive: boolean;
};

export function AdminPanel({
  messages,
  anonymousMode,
  onClear,
  onResetNicknames,
  onToggleAnonymous,
  onToggleChatActive,
  onSendMessage,
  onPinNotice,
  onUnpinNotice,
  onLogout,
  isConnected,
  pinnedNotice,
  chatActive,
}: AdminPanelProps) {
  const statusColor = isConnected && chatActive ? 'bg-green-500 animate-pulse' : 'bg-red-500';
  const statusTitle = !chatActive
    ? '채팅방 잠김'
    : isConnected
      ? '채팅 서버 연결 완료'
      : '채팅 서버 연결 대기 중';
  const [controlError, setControlError] = useState('');
  const [pendingReset, setPendingReset] = useState<'chat' | 'nicknames' | null>(null);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [viewOnly, setViewOnly] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCommand = async (command: () => Promise<CommandResult>) => {
    const result = await command();
    setControlError(result.ok === true ? '' : result.error);
  };

  const handleReset = (
    target: 'chat' | 'nicknames',
    command: () => Promise<CommandResult>,
  ) => {
    if (pendingReset !== target) {
      setPendingReset(target);
      setControlError('');
      return;
    }
    void handleCommand(async () => {
      const result = await command();
      if (result.ok === true) {
        setPendingReset(null);
      }
      return result;
    });
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanMessage = messageInput.trim();
    if (!cleanMessage || isSendingRef.current) {
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);
    setMessageInput('');
    setControlError('');
    try {
      const result = await onSendMessage(cleanMessage);

      if (result.ok === true) {
        setControlError('');
      } else {
        setMessageInput(cleanMessage);
        setControlError(result.error);
      }
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  return (
    <div className={cn('flex-1 flex flex-col h-full', viewOnly ? 'bg-white' : 'bg-gray-50')}>
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 z-10 sticky top-0 shadow-sm gap-2">
        <h3 className="font-bold text-gray-800 flex items-center gap-1.5 min-w-0">
          <Settings size={18} className="text-blue-600 shrink-0" />
          <span className="whitespace-nowrap">{viewOnly ? '실시간 톡' : '관리자 패널'}</span>
          <span
            className={cn('w-2 h-2 rounded-full shrink-0', statusColor)}
            title={statusTitle}
          />
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setViewOnly((active) => !active);
              setPendingReset(null);
              setControlError('');
            }}
            aria-pressed={viewOnly}
            title={viewOnly ? '관리 화면으로 돌아가기' : '공개 화면으로 보기'}
            className={cn(
              'text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors',
              viewOnly
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-500 hover:text-gray-800',
            )}
          >
            <Eye size={14} />
            보기용
          </button>
          <button
            onClick={() => setControlsOpen((open) => !open)}
            disabled={viewOnly}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded bg-gray-100 disabled:opacity-40 disabled:cursor-default"
            title={controlsOpen ? '관리 도구 접기' : '관리 도구 열기'}
          >
            {controlsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {controlsOpen ? '접기' : '열기'}
          </button>
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded bg-gray-100"
          >
            <LogOut size={14} />
            나가기
          </button>
        </div>
      </div>

      {pinnedNotice && (viewOnly ? (
        <PinnedNotice notice={pinnedNotice} anonymousMode={anonymousMode} />
      ) : (
        <AdminPinnedNotice
          notice={pinnedNotice}
          anonymousMode={anonymousMode}
          onUnpin={() => {
            void handleCommand(onUnpinNotice);
          }}
        />
      ))}

      {!viewOnly && (controlError || controlsOpen) && (
        <div className="p-4 space-y-3 shrink-0 bg-white border-b border-gray-100">
          {controlError && <p className="text-xs text-red-500 font-medium">{controlError}</p>}
          {controlsOpen && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    void handleCommand(() => onToggleChatActive(!chatActive));
                  }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-[13px] sm:text-sm transition-colors',
                    chatActive
                      ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
                  )}
                >
                  {chatActive ? <Unlock size={16} /> : <Lock size={16} />}
                  {chatActive ? '채팅방 활성화됨' : '채팅방 잠김'}
                </button>
                <button
                  onClick={() => {
                    void handleCommand(() => onToggleAnonymous(!anonymousMode));
                  }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-[13px] sm:text-sm transition-colors',
                    anonymousMode
                      ? 'bg-gray-800 text-white border-gray-800 hover:bg-gray-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {anonymousMode ? <UserX size={16} /> : <UserCheck size={16} />}
                  {anonymousMode ? '익명 모드 켜짐' : '익명 모드 꺼짐'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleReset('chat', onClear)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border font-medium text-xs sm:text-sm transition-colors',
                    pendingReset === 'chat'
                      ? 'border-red-500 bg-red-600 text-white hover:bg-red-700'
                      : 'border-red-200 text-red-600 hover:bg-red-50',
                  )}
                >
                  <Trash2 size={15} />
                  {pendingReset === 'chat' ? '한 번 더 눌러 삭제' : '모든 채팅 초기화'}
                </button>
                <button
                  onClick={() => handleReset('nicknames', onResetNicknames)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border font-medium text-xs sm:text-sm transition-colors',
                    pendingReset === 'nicknames'
                      ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600'
                      : 'border-orange-200 text-orange-700 hover:bg-orange-50',
                  )}
                >
                  <RotateCcw size={15} />
                  {pendingReset === 'nicknames'
                    ? '한 번 더 눌러 초기화'
                    : '모든 닉네임 초기화'}
                </button>
              </div>
              {pendingReset && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-[11px] text-gray-500">
                    {pendingReset === 'chat'
                      ? '메시지와 고정 공지가 삭제됩니다.'
                      : '현재 참여자는 새로고침 후 다시 입장해야 합니다.'}
                  </p>
                  <button
                    onClick={() => setPendingReset(null)}
                    className="shrink-0 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    취소
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!viewOnly && (
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-widest bg-gray-100/50">
          전체 채팅 미리보기
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-8 bg-white text-sm">
        {messages.length === 0 ? (
          <div className="pt-8 text-center text-gray-400">채팅 내용이 없습니다.</div>
        ) : (
          messages.map((message) => viewOnly ? (
            <ChatLine key={message.id} message={message} anonymousMode={anonymousMode} />
          ) : (
            <AdminChatLine
              key={message.id}
              message={message}
              anonymousMode={anonymousMode}
              isPinned={pinnedNotice?.id === message.id}
              onPin={() => {
                void handleCommand(() => onPinNotice(message.id));
              }}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {!viewOnly && (
        <div className="border-t border-gray-100 bg-white p-3 sm:pb-4 shrink-0">
          <form
            onSubmit={handleSendMessage}
            className="relative flex items-center pr-1 bg-gray-50 border border-gray-200 rounded-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all"
          >
            <input
              type="text"
              className="flex-1 bg-transparent px-4 py-3 outline-none text-[15px] text-gray-800 placeholder:text-gray-400 min-w-0"
              placeholder="관리자 메시지를 입력하세요."
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              disabled={isSending}
              maxLength={300}
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || isSending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white p-2 rounded-full transition-colors shrink-0"
            >
              <Send size={18} className="translate-x-[1px] translate-y-[-1px]" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
