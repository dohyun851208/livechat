import { useState, type FormEvent } from 'react';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { ChatScreen } from './components/ChatScreen';
import { NicknameScreen } from './components/NicknameScreen';
import { StartScreen } from './components/StartScreen';
import { useChatRoom } from './use-chat-room';
import type { AppView } from './types';

export function App() {
  const chat = useChatRoom();
  const [view, setView] = useState<AppView>('start');
  const [nickname, setNickname] = useState('');
  const [inputNickname, setInputNickname] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);

  const handleStart = () => {
    setView('nickname_input');
    setErrorMsg('');
  };

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanNickname = inputNickname.trim();
    if (!cleanNickname) {
      setErrorMsg('이름을 입력해주세요.');
      return;
    }

    setIsJoining(true);
    const result = await chat.join(cleanNickname);
    setIsJoining(false);

    if (result.ok === true) {
      setNickname(cleanNickname);
      setView('chat');
      setErrorMsg('');
    } else {
      setErrorMsg(result.error);
    }
  };

  const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAdminLoggingIn(true);
    const result = await chat.adminLogin(adminPassword);
    setIsAdminLoggingIn(false);

    if (result.ok === true) {
      setView('admin_panel');
      setErrorMsg('');
      setAdminPassword('');
    } else {
      setErrorMsg(result.error);
    }
  };

  const handleAdminLogout = () => {
    setView('start');
  };

  return (
    <div className="w-full h-[100dvh] bg-white text-gray-900 font-sans mx-auto max-w-md shadow-xl flex flex-col relative overflow-hidden border-x border-gray-100">
      {view === 'start' && (
        <StartScreen
          onStart={handleStart}
          onAdmin={() => {
            setView('admin_login');
            setErrorMsg('');
          }}
        />
      )}

      {view === 'nickname_input' && (
        <NicknameScreen
          input={inputNickname}
          setInput={setInputNickname}
          error={errorMsg || chat.lastError}
          isJoining={isJoining}
          onJoin={handleJoin}
          onBack={() => setView('start')}
        />
      )}

      {view === 'admin_login' && (
        <AdminLoginScreen
          password={adminPassword}
          setPassword={setAdminPassword}
          error={errorMsg || chat.lastError}
          isLoggingIn={isAdminLoggingIn}
          onLogin={handleAdminLogin}
          onBack={() => setView('start')}
        />
      )}

      {view === 'chat' && (
        <ChatScreen
          nickname={nickname}
          setAppNickname={setNickname}
          messages={chat.messages}
          anonymousMode={chat.anonymousMode}
          onSend={chat.sendMessage}
          onChangeNickname={chat.changeNickname}
          onAdmin={() => {
            setView('admin_login');
            setErrorMsg('');
          }}
          isConnected={chat.isConnected}
          pinnedNotice={chat.pinnedNotice}
          chatActive={chat.chatActive}
        />
      )}

      {view === 'admin_panel' && (
        <AdminPanel
          messages={chat.messages}
          anonymousMode={chat.anonymousMode}
          onClear={chat.clearChat}
          onToggleAnonymous={chat.toggleAnonymous}
          onToggleChatActive={chat.toggleChatActive}
          onPinNotice={chat.pinNotice}
          onUnpinNotice={chat.unpinNotice}
          onLogout={handleAdminLogout}
          isConnected={chat.isConnected}
          pinnedNotice={chat.pinnedNotice}
          chatActive={chat.chatActive}
        />
      )}
    </div>
  );
}
