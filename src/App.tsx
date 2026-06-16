import { useEffect, useState, useRef, FormEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { Settings, LogOut, Trash2, UserX, UserCheck, Send, Pin, PinOff, Megaphone, Lock, Unlock } from 'lucide-react';
import { AppView, ChatMessage } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility function to merge tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let socketInstance: Socket | null = null;

export default function App() {
  const [view, setView] = useState<AppView>('start');
  const [nickname, setNickname] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inputNickname, setInputNickname] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [pinnedNotice, setPinnedNotice] = useState<ChatMessage | null>(null);
  const [chatActive, setChatActive] = useState(true);
  
  // Connect once and reuse
  useEffect(() => {
    if (!socketInstance) {
      // Connect to the same origin
      socketInstance = io({
        reconnectionDelayMax: 10000,
        transports: ['websocket', 'polling']
      });

      socketInstance.on('connect', () => {
        setIsConnected(true);
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
      });

      socketInstance.on('init', (data: { chatHistory: ChatMessage[], anonymousMode: boolean, pinnedNotice?: ChatMessage | null, chatActive: boolean }) => {
        setMessages(data.chatHistory);
        setAnonymousMode(data.anonymousMode);
        setChatActive(data.chatActive);
        if (data.pinnedNotice !== undefined) {
          setPinnedNotice(data.pinnedNotice);
        }
      });

      socketInstance.on('chat_active_changed', (active: boolean) => {
        setChatActive(active);
      });

      socketInstance.on('pinned_notice_changed', (notice: ChatMessage | null) => {
        setPinnedNotice(notice);
      });

      socketInstance.on('new_message', (msg: ChatMessage) => {
        setMessages(prev => [...prev, msg]);
      });

      socketInstance.on('chat_cleared', () => {
        setMessages([]);
      });

      socketInstance.on('anonymous_mode_changed', (enabled: boolean) => {
        setAnonymousMode(enabled);
      });
    } else {
      // If socket already exists, sync initial connection state
      setIsConnected(socketInstance.connected);
    }

    // Keep-alive heartbeat: /api/health를 주기적으로 호출하여 
    // Cloud Run 서버가 비활성화(Sleep) 상태로 들어가는 것을 방지합니다.
    // 추가로, 소켓 상태를 명확하게 점검하여 멈춤 현상(좀비 커넥션)을 강제로 복구합니다.
    const keepWarmInterval = setInterval(() => {
      if (socketInstance?.connected) {
        socketInstance.timeout(2000).emit('client_ping', (err: any) => {
          if (err) {
            console.warn('Ping timeout: Forced reconnection triggered.');
            socketInstance?.disconnect();
            socketInstance?.connect();
          }
        });
      } else {
        socketInstance?.connect();
      }
      fetch('/api/health')
        .then((res) => res.json())
        .catch(() => {});
    }, 3000); // 3초 주기

    return () => {
      clearInterval(keepWarmInterval);
    };
  }, []);

  const handleStart = () => {
    setView('nickname_input');
    setErrorMsg('');
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!inputNickname.trim()) {
      setErrorMsg('이름을 입력해주세요.');
      return;
    }

    if (socketInstance) {
      socketInstance.emit('join', inputNickname, (res: { success: boolean, error?: string }) => {
        if (res.success) {
          setNickname(inputNickname.trim());
          setView('chat');
          setErrorMsg('');
        } else {
          setErrorMsg(res.error || '오류가 발생했습니다.');
        }
      });
    }
  };

  const [adminPassword, setAdminPassword] = useState('');
  
  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    if (socketInstance) {
      socketInstance.emit('admin_login', adminPassword, (res: { success: boolean }) => {
        if (res.success) {
          setIsAdmin(true);
          setView('admin_panel');
          setErrorMsg('');
          setAdminPassword('');
        } else {
          setErrorMsg('비밀번호가 틀렸습니다.');
        }
      });
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setView('start');
  };

  return (
    <div className="w-full h-[100dvh] bg-white text-gray-900 font-sans mx-auto max-w-md shadow-xl flex flex-col relative overflow-hidden border-x border-gray-100">
      {view === 'start' && (
        <StartScreen onStart={handleStart} onAdmin={() => { setView('admin_login'); setErrorMsg(''); }} />
      )}
      
      {view === 'nickname_input' && (
        <NicknameScreen 
          input={inputNickname} 
          setInput={setInputNickname} 
          error={errorMsg} 
          onJoin={handleJoin} 
          onBack={() => setView('start')}
        />
      )}

      {view === 'admin_login' && (
        <AdminLoginScreen 
          password={adminPassword}
          setPassword={setAdminPassword}
          error={errorMsg}
          onLogin={handleAdminLogin}
          onBack={() => setView('start')}
        />
      )}

      {view === 'chat' && (
        <ChatScreen 
          nickname={nickname} 
          setAppNickname={setNickname}
          messages={messages} 
          anonymousMode={anonymousMode}
          socket={socketInstance}
          onAdmin={() => { setView('admin_login'); setErrorMsg(''); }}
          isConnected={isConnected}
          pinnedNotice={pinnedNotice}
          chatActive={chatActive}
        />
      )}

      {view === 'admin_panel' && (
        <AdminPanel 
          messages={messages}
          anonymousMode={anonymousMode}
          socket={socketInstance}
          onLogout={handleAdminLogout}
          isConnected={isConnected}
          pinnedNotice={pinnedNotice}
          chatActive={chatActive}
        />
      )}
    </div>
  );
}

// --- Component Definitions ---

function StartScreen({ onStart, onAdmin }: { onStart: () => void, onAdmin: () => void }) {
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-800 text-balance leading-tight">실시간 수업 채팅</h1>
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

function NicknameScreen({ input, setInput, error, onJoin, onBack }: any) {
  return (
    <div className="flex-1 flex flex-col p-6 relative">
       <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 text-sm py-2 px-2 hover:bg-gray-100 rounded">
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
                onChange={(e) => setInput(e.target.value)}
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
              disabled={!input.trim()}
            >
              입장하기
            </button>
          </form>
       </div>
    </div>
  );
}

function AdminLoginScreen({ password, setPassword, error, onLogin, onBack }: any) {
  return (
    <div className="flex-1 flex flex-col p-6 relative bg-gray-50">
       <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 text-sm py-2 px-2 hover:bg-gray-200 rounded">
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 transition-colors"
                autoFocus
              />
              {error && <p className="text-red-500 text-xs mt-2 font-medium px-1">{error}</p>}
            </div>
            
            <button 
              type="submit"
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 rounded-xl shadow-sm transition-all active:scale-95"
            >
              로그인
            </button>
          </form>
       </div>
    </div>
  );
}

function ChatScreen({ nickname, setAppNickname, messages, anonymousMode, socket, onAdmin, isConnected, pinnedNotice, chatActive }: any) {
  const [msg, setMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [isChangingNickname, setIsChangingNickname] = useState(false);
  const [newNicknameInput, setNewNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!msg.trim() || !socket || !chatActive) return;
    
    socket.emit('send_message', msg);
    setMsg('');
  };

  const startChangingNickname = () => {
    setNewNicknameInput(nickname);
    setNicknameError('');
    setIsChangingNickname(true);
  };

  const handleChangeNickname = (e: FormEvent) => {
    e.preventDefault();
    if (!newNicknameInput.trim() || !socket) {
      setIsChangingNickname(false);
      return;
    }
    
    socket.emit('change_nickname', newNicknameInput, (res: { success: boolean, error?: string }) => {
      if (res.success) {
        setAppNickname(newNicknameInput.trim());
        setIsChangingNickname(false);
        setNicknameError('');
      } else {
        setNicknameError(res.error || '오류가 발생했습니다.');
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-white/80 backdrop-blur-sm z-10 sticky top-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-semibold text-gray-800 whitespace-nowrap">실시간 채팅</h3>
          <span 
            className={cn(
              "w-2 h-2 rounded-full shrink-0", 
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} 
            title={isConnected ? "실시간 서버 연결 완료" : "연결 끊김, 서버를 깨우는 중..."} 
          />
          {!isConnected && (
            <span className="text-[10px] text-red-500 font-medium whitespace-nowrap animate-pulse">연결 중...</span>
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
                    onChange={e => setNewNicknameInput(e.target.value)}
                    maxLength={20}
                  />
                  <button type="submit" className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 transition-colors">변경</button>
                  <button type="button" onClick={() => setIsChangingNickname(false)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 px-2 py-1 rounded-r-md transition-colors border border-l-0 border-gray-200">취소</button>
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

      {/* Pinned Notice */}
      {pinnedNotice && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-start gap-2 text-xs text-blue-800 z-10 shrink-0">
          <Megaphone size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <span className="font-semibold text-blue-950 bg-blue-100 px-1.5 py-0.5 rounded leading-none shrink-0 text-[10px]">공지</span>
          <div className="flex-1 min-w-0">
            <span className="font-medium mr-1.5" style={{ color: anonymousMode && pinnedNotice.nickname !== '관리자' ? '#6b7280' : pinnedNotice.color }}>
              {pinnedNotice.nickname === '관리자' ? '관리자' : (anonymousMode ? '익명' : pinnedNotice.nickname)}:
            </span>
            <span className="text-gray-700 font-medium break-all">{pinnedNotice.content}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 pb-8">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
            <p className="text-sm">채팅 내용이 없습니다.</p>
            <p className="text-xs">첫 메시지를 남겨보세요.</p>
          </div>
        ) : (
          messages.map((m) => {
            const displayNickname = m.nickname === '관리자' ? '관리자' : (anonymousMode ? '익명' : m.nickname);
            const isMe = m.nickname === nickname && !anonymousMode;
            
            return (
              <div key={m.id} className="text-[15px] leading-relaxed break-words px-2 py-0.5 hover:bg-gray-50 rounded-md transition-colors">
                <span 
                  className={cn("font-medium", m.nickname === '관리자' && "bg-gray-800 text-white px-1.5 rounded text-xs")}
                  style={{ color: m.nickname === '관리자' ? '#fff' : (anonymousMode ? '#6b7280' : m.color) }}
                >
                  {displayNickname}
                </span>
                <span className="text-gray-300 font-normal select-none px-1.5 md:px-2">|</span>
                <span className="text-gray-800">{m.content}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 bg-white p-3 sm:pb-4 relative">
        {!chatActive && (
          <div className="absolute inset-0 bg-gray-50/90 z-10 flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5"><Lock size={14} className="text-gray-400" /> 관리자에 의해 채팅이 일시적으로 제한되었습니다.</span>
          </div>
        )}
        <form onSubmit={handleSend} className="relative flex items-center pr-1 bg-gray-50 border border-gray-200 rounded-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <input
            type="text"
            className="flex-1 bg-transparent px-4 py-3 outline-none text-[15px] text-gray-800 placeholder:text-gray-400"
            placeholder="메시지를 입력하세요..."
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            disabled={!chatActive}
            maxLength={300}
          />
          <button 
            type="submit" 
            disabled={!msg.trim() || !chatActive}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white p-2 rounded-full transition-colors shrink-0"
          >
            <Send size={18} className="translate-x-[1px] translate-y-[-1px]" />
          </button>
        </form>
      </div>
    </div>
  );
}

// Separate admin panel purely focusing on control, plus a mini view of the chat
function AdminPanel({ messages, anonymousMode, socket, onLogout, isConnected, pinnedNotice, chatActive }: any) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClear = () => {
    if (window.confirm('정말 현재까지의 모든 채팅 내용을 지우시겠습니까? 복구할 수 없습니다.')) {
      if (socket) socket.emit('clear_chat');
    }
  };

  const handleToggleAnonymous = () => {
    if (socket) socket.emit('toggle_anonymous', !anonymousMode);
  };

  const handleToggleChatActive = () => {
    if (socket) socket.emit('toggle_chat_active', !chatActive);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 z-10 sticky top-0 shadow-sm gap-2">
        <h3 className="font-bold text-gray-800 flex items-center gap-1.5 min-w-0">
          <Settings size={18} className="text-blue-600 shrink-0" />
          <span className="whitespace-nowrap">관리자 패널</span>
          <span 
            className={cn(
              "w-2 h-2 rounded-full shrink-0", 
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} 
            title={isConnected ? "실시간 서버 연결 완료" : "연결 대기 및 재연결 중"} 
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
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between gap-3 text-xs text-blue-900 z-10 shrink-0">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Megaphone size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="font-semibold text-blue-950 bg-blue-100 px-1.5 py-0.5 rounded leading-none shrink-0 text-[10px]">공지</span>
            <div className="flex-1 min-w-0">
              <span className="font-medium mr-1.5" style={{ color: anonymousMode && pinnedNotice.nickname !== '관리자' ? '#6b7280' : pinnedNotice.color }}>
                {pinnedNotice.nickname === '관리자' ? '관리자' : (anonymousMode ? '익명' : pinnedNotice.nickname)}:
              </span>
              <span className="text-gray-700 font-medium break-all">{pinnedNotice.content}</span>
            </div>
          </div>
          <button 
            onClick={() => { if (socket) socket.emit('unpin_notice'); }}
            className="text-red-500 hover:text-red-700 bg-red-100/50 hover:bg-red-100 px-2 py-1 rounded transition-colors text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1 font-medium shadow-sm"
          >
            <PinOff size={11} />
            공지 내리기
          </button>
        </div>
      )}

      {/* Control Panel */}
      <div className="p-4 space-y-3 shrink-0 bg-white border-b border-gray-100">
        <div className="flex gap-2">
          <button
            onClick={handleToggleChatActive}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-[13px] sm:text-sm transition-colors",
              chatActive 
                ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50" 
                : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
            )}
          >
            {chatActive ? <Unlock size={16} /> : <Lock size={16} />}
            {chatActive ? "채팅방 활성화됨" : "채팅방 잠김 (비활성화)"}
          </button>
          <button
            onClick={handleToggleAnonymous}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-[13px] sm:text-sm transition-colors",
              anonymousMode 
                ? "bg-gray-800 text-white border-gray-800 hover:bg-gray-700" 
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            {anonymousMode ? <UserX size={16} /> : <UserCheck size={16} />}
            {anonymousMode ? "익명 모드 켜짐" : "익명 모드 꺼짐"}
          </button>
        </div>

        <button
          onClick={handleClear}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 text-sm transition-colors"
        >
          <Trash2 size={16} />
          모든 채팅 초기화
        </button>
      </div>

      {/* Chat Preview */}
      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-widest bg-gray-100/50">
        전체 채팅 미리보기
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-8 bg-white text-sm">
        {messages.length === 0 ? (
          <div className="pt-8 text-center text-gray-400">채팅 내용이 없습니다.</div>
        ) : (
          messages.map((m: ChatMessage) => {
            const displayNickname = m.nickname === '관리자' ? '관리자' : (anonymousMode ? '익명' : m.nickname);
            const isLatestPinned = pinnedNotice?.id === m.id;
            return (
              <div key={m.id} className="group flex items-start justify-between gap-2 pb-1.5 pt-0.5 border-b border-gray-50 last:border-0 leading-relaxed text-[14px]">
                <div className="break-words min-w-0 flex-1">
                  <span 
                    className={cn("font-medium text-[13px]", m.nickname === '관리자' && "bg-gray-800 text-white px-1.5 rounded text-[11px]")}
                    style={{ color: m.nickname === '관리자' ? '#fff' : (anonymousMode ? '#9ca3af' : m.color) }}
                  >
                    {displayNickname}
                    {/* Show real name faintly in admin view if anonymous is on so admin knows who it is */}
                    {anonymousMode && m.nickname !== '관리자' && (
                      <span className="text-gray-300 font-normal ml-1 text-[11px]">({m.nickname})</span>
                    )}
                  </span>
                  <span className="text-gray-200 text-xs px-1.5 font-light">|</span>
                  <span className="text-gray-700">{m.content}</span>
                </div>
                
                <button
                  onClick={() => { if (socket) socket.emit('pin_notice', m.id); }}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded transition-colors font-semibold flex items-center gap-0.5 shrink-0 self-center border",
                    isLatestPinned
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white hover:bg-blue-50 text-gray-400 hover:text-blue-600 border-gray-200 hover:border-blue-200 md:opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  )}
                  title={isLatestPinned ? "현재 공지 사항" : "공지로 지정"}
                >
                  <Pin size={9} />
                  {isLatestPinned ? "공지됨" : "공지"}
                </button>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
