import { Megaphone } from 'lucide-react';
import type { ChatMessage } from '../types';

type PinnedNoticeProps = {
  readonly notice: ChatMessage;
  readonly anonymousMode: boolean;
};

export function PinnedNotice({ notice, anonymousMode }: PinnedNoticeProps) {
  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-start gap-2 text-xs text-blue-800 z-10 shrink-0">
      <Megaphone size={14} className="text-blue-500 shrink-0 mt-0.5" />
      <span className="font-semibold text-blue-950 bg-blue-100 px-1.5 py-0.5 rounded leading-none shrink-0 text-[10px]">
        공지
      </span>
      <div className="flex-1 min-w-0">
        <span
          className="font-medium mr-1.5"
          style={{
            color:
              anonymousMode && notice.nickname !== '관리자'
                ? '#6b7280'
                : notice.color,
          }}
        >
          {notice.nickname === '관리자' ? '관리자' : anonymousMode ? '익명' : notice.nickname}:
        </span>
        <span className="text-gray-700 font-medium break-all">{notice.content}</span>
      </div>
    </div>
  );
}
