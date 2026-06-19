import {
  Lock,
  LogOut,
  Settings,
  Trash2,
  Unlock,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import type { ChatMessage, CommandResult } from '../types';
import { AdminChatLine } from './AdminChatLine';
import { AdminPinnedNotice } from './AdminPinnedNotice';

type AdminPanelProps = {
  readonly messages: readonly ChatMessage[];
  readonly anonymousMode: boolean;
  readonly onClear: () => Promise<CommandResult>;
  readonly onToggleAnonymous: (enabled: boolean) => Promise<CommandResult>;
  readonly onToggleChatActive: (active: boolean) => Promise<CommandResult>;
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
  onToggleAnonymous,
  onToggleChatActive,
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
  const [confirmingClear, setConfirmingClear] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCommand = async (command: () => Promise<CommandResult>) => {
    const result = await command();
    setControlError(result.ok === true ? '' : result.error);
  };

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    void handleCommand(async () => {
      const result = await onClear();
      if (result.ok === true) {
        setConfirmingClear(false);
      }
      return result;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 z-10 sticky top-0 shadow-sm gap-2">
        <h3 className="font-bold text-gray-800 flex items-center gap-1.5 min-w-0">
          <Settings size={18} className="text-blue-600 shrink-0" />
          <span className="whitespace-nowrap">관리자 패널</span>
          <span
            className={cn('w-2 h-2 rounded-full shrink-0', statusColor)}
            title={statusTitle}
          />
        </h3>
        <button
          onClick={onLogout}
          className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded bg-gray-100"
        >
          <LogOut size={14} />
          나가기
        </button>
      </div>

      {pinnedNotice && (
        <AdminPinnedNotice
          notice={pinnedNotice}
          anonymousMode={anonymousMode}
          onUnpin={() => {
            void handleCommand(onUnpinNotice);
          }}
        />
      )}

      <div className="p-4 space-y-3 shrink-0 bg-white border-b border-gray-100">
        {controlError && <p className="text-xs text-red-500 font-medium">{controlError}</p>}
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

        <button
          onClick={handleClear}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-sm transition-colors',
            confirmingClear
              ? 'border-red-500 bg-red-600 text-white hover:bg-red-700'
              : 'border-red-200 text-red-600 hover:bg-red-50',
          )}
        >
          <Trash2 size={16} />
          {confirmingClear ? '한 번 더 누르면 삭제합니다' : '모든 채팅 초기화'}
        </button>
        {confirmingClear && (
          <button
            onClick={() => setConfirmingClear(false)}
            className="w-full py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100"
          >
            삭제 취소
          </button>
        )}
      </div>

      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-widest bg-gray-100/50">
        전체 채팅 미리보기
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-8 bg-white text-sm">
        {messages.length === 0 ? (
          <div className="pt-8 text-center text-gray-400">채팅 내용이 없습니다.</div>
        ) : (
          messages.map((message) => (
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
    </div>
  );
}
