import { Megaphone, PinOff } from 'lucide-react';
import type { ChatMessage } from '../types';

type AdminPinnedNoticeProps = {
  readonly notice: ChatMessage;
  readonly anonymousMode: boolean;
  readonly onUnpin: () => void;
};

export function AdminPinnedNotice({
  notice,
  anonymousMode,
  onUnpin,
}: AdminPinnedNoticeProps) {
  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between gap-3 text-xs text-blue-900 z-10 shrink-0">
      <div className="flex items-start gap-2 flex-1 min-w-0">
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
      <button
        onClick={onUnpin}
        className="text-red-500 hover:text-red-700 bg-red-100/50 hover:bg-red-100 px-2 py-1 rounded transition-colors text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1 font-medium shadow-sm"
      >
        <PinOff size={11} />
        공지 내리기
      </button>
    </div>
  );
}
