import { cn } from '../lib/cn';
import type { ChatMessage } from '../types';

type ChatLineProps = {
  readonly key?: string;
  readonly message: ChatMessage;
  readonly anonymousMode: boolean;
};

export function ChatLine({ message, anonymousMode }: ChatLineProps) {
  const displayNickname =
    message.nickname === '관리자' ? '관리자' : anonymousMode ? '익명' : message.nickname;

  return (
    <div className="text-[15px] leading-relaxed break-words px-2 py-0.5 hover:bg-gray-50 rounded-md transition-colors">
      <span
        className={cn(
          'font-medium',
          message.nickname === '관리자' && 'bg-gray-800 text-white px-1.5 rounded text-xs',
        )}
        style={{
          color:
            message.nickname === '관리자'
              ? '#fff'
              : anonymousMode
                ? '#6b7280'
                : message.color,
        }}
      >
        {displayNickname}
      </span>
      <span className="text-gray-300 font-normal select-none px-1.5 md:px-2">|</span>
      <span className="text-gray-800">{message.content}</span>
    </div>
  );
}
