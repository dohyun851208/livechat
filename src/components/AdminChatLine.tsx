import { Pin } from 'lucide-react';
import { cn } from '../lib/cn';
import type { ChatMessage } from '../types';

type AdminChatLineProps = {
  readonly key?: string;
  readonly message: ChatMessage;
  readonly anonymousMode: boolean;
  readonly isPinned: boolean;
  readonly onPin: () => void;
};

export function AdminChatLine({
  message,
  anonymousMode,
  isPinned,
  onPin,
}: AdminChatLineProps) {
  const displayNickname =
    message.nickname === '관리자' ? '관리자' : anonymousMode ? '익명' : message.nickname;

  return (
    <div className="group flex items-start justify-between gap-2 pb-1.5 pt-0.5 border-b border-gray-50 last:border-0 leading-relaxed text-[14px]">
      <div className="break-words min-w-0 flex-1">
        <span
          className={cn(
            'font-medium text-[13px]',
            message.nickname === '관리자' &&
              'bg-gray-800 text-white px-1.5 rounded text-[11px]',
          )}
          style={{
            color:
              message.nickname === '관리자'
                ? '#fff'
                : anonymousMode
                  ? '#9ca3af'
                  : message.color,
          }}
        >
          {displayNickname}
          {anonymousMode && message.nickname !== '관리자' && (
            <span className="text-gray-300 font-normal ml-1 text-[11px]">
              ({message.nickname})
            </span>
          )}
        </span>
        <span className="text-gray-200 text-xs px-1.5 font-light">|</span>
        <span className="text-gray-700">{message.content}</span>
      </div>

      <button
        onClick={onPin}
        className={cn(
          'text-[10px] px-1.5 py-0.5 rounded transition-colors font-semibold flex items-center gap-0.5 shrink-0 self-center border',
          isPinned
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white hover:bg-blue-50 text-gray-400 hover:text-blue-600 border-gray-200 hover:border-blue-200 md:opacity-0 group-hover:opacity-100 transition-all shadow-sm',
        )}
        title={isPinned ? '현재 공지 사항' : '공지로 지정'}
      >
        <Pin size={9} />
        {isPinned ? '공지됨' : '공지'}
      </button>
    </div>
  );
}
