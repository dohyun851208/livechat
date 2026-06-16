import type { FormEvent } from 'react';

type NicknameScreenProps = {
  readonly input: string;
  readonly setInput: (input: string) => void;
  readonly error: string;
  readonly isJoining: boolean;
  readonly onJoin: (event: FormEvent<HTMLFormElement>) => void;
  readonly onBack: () => void;
};

export function NicknameScreen({
  input,
  setInput,
  error,
  isJoining,
  onJoin,
  onBack,
}: NicknameScreenProps) {
  return (
    <div className="flex-1 flex flex-col p-6 relative">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 text-gray-500 text-sm py-2 px-2 hover:bg-gray-100 rounded"
      >
        취소
      </button>
      <div className="flex-1 flex flex-col justify-center max-w-xs mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">이름 입력</h2>
          <p className="text-sm text-gray-500">채팅에 사용할 이름을 입력해주세요.</p>
        </div>

        <form onSubmit={onJoin} className="space-y-4">
          <div>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="홍길동"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              autoFocus
              maxLength={20}
            />
            {error && <p className="text-red-500 text-xs mt-2 font-medium px-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
            disabled={!input.trim() || isJoining}
          >
            {isJoining ? '입장 중...' : '입장하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
