import { Settings } from 'lucide-react';

type StartScreenProps = {
  readonly onStart: () => void;
  readonly onAdmin: () => void;
};

export function StartScreen({ onStart, onAdmin }: StartScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center relative p-6">
      <button
        onClick={onAdmin}
        className="absolute top-4 right-4 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors bg-gray-50 px-2 py-1.5 rounded-md"
      >
        <Settings size={14} />
        관리자 모드
      </button>

      <div className="text-center space-y-8 w-full max-w-xs">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800 text-balance leading-tight">
            실시간 수업 채팅
          </h1>
          <p className="text-sm text-gray-500">질문과 피드백을 자유롭게 남겨주세요.</p>
        </div>

        <button
          onClick={onStart}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-6 rounded-xl shadow-md transition-all active:scale-95"
        >
          시작하기
        </button>
      </div>
    </div>
  );
}
