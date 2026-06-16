import type { FormEvent } from 'react';

type AdminLoginScreenProps = {
  readonly password: string;
  readonly setPassword: (password: string) => void;
  readonly error: string;
  readonly isLoggingIn: boolean;
  readonly onLogin: (event: FormEvent<HTMLFormElement>) => void;
  readonly onBack: () => void;
};

export function AdminLoginScreen({
  password,
  setPassword,
  error,
  isLoggingIn,
  onLogin,
  onBack,
}: AdminLoginScreenProps) {
  return (
    <div className="flex-1 flex flex-col p-6 relative bg-gray-50">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 text-gray-500 text-sm py-2 px-2 hover:bg-gray-200 rounded"
      >
        뒤로가기
      </button>
      <div className="flex-1 flex flex-col justify-center max-w-xs mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">관리자 로그인</h2>
          <p className="text-sm text-gray-500">관리자 비밀번호를 입력하세요.</p>
        </div>

        <form onSubmit={onLogin} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 transition-colors"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-2 font-medium px-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
