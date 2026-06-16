import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    pingInterval: 10000,
    pingTimeout: 5000
  });

  // Keep-alive lightweight endpoint to prevent cold start/sleep
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  let chatHistory: any[] = [];
  let anonymousMode = false;
  let pinnedNotice: any = null;
  let chatActive = true;
  const connectedUsers = new Map<string, string>(); // socketId -> nickname
  const usedNicknames = new Set<string>();
  const nicknameColors = new Map<string, string>();

  // A vibrant, readable palette suitable for a light background
  const PALETTE = [
    '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', 
    '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', 
    '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', 
    '#f97316', '#ef4444'
  ];

  function getColor(nickname: string) {
    if (!nicknameColors.has(nickname)) {
      // Pick a semi-random color based on nickname length/chars as a fallback
      // but sequential is also fine since users join sequentially
      const color = PALETTE[nicknameColors.size % PALETTE.length];
      nicknameColors.set(nickname, color);
    }
    return nicknameColors.get(nickname);
  }

  io.on('connection', (socket) => {
    // Send initial state upon connection
    socket.emit('init', {
      chatHistory,
      anonymousMode,
      pinnedNotice,
      chatActive
    });

    socket.on('join', (nickname: string, callback) => {
      const cleanNickname = nickname.trim();
      if (!cleanNickname) {
        return callback({ success: false, error: '이름을 입력해주세요.' });
      }
      
      const isDuplicate = Array.from(usedNicknames).some((n: string) => n.toLowerCase() === cleanNickname.toLowerCase());
      if (isDuplicate) {
        return callback({ success: false, error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.' });
      }
      
      usedNicknames.add(cleanNickname);
      connectedUsers.set(socket.id, cleanNickname);
      callback({ success: true, color: getColor(cleanNickname) });
    });

    socket.on('change_nickname', (newNickname: string, callback) => {
      const cleanNickname = newNickname.trim();
      if (!cleanNickname) {
        return callback({ success: false, error: '이름을 입력해주세요.' });
      }

      const oldNickname = connectedUsers.get(socket.id);
      if (oldNickname && cleanNickname.toLowerCase() === oldNickname.toLowerCase()) {
        return callback({ success: true, color: getColor(cleanNickname) });
      }
      
      const isDuplicate = Array.from(usedNicknames).some((n: string) => n.toLowerCase() === cleanNickname.toLowerCase());
      if (isDuplicate) {
        return callback({ success: false, error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요.' });
      }

      if (oldNickname) {
        usedNicknames.delete(oldNickname);
      }
      usedNicknames.add(cleanNickname);
      connectedUsers.set(socket.id, cleanNickname);
      callback({ success: true, color: getColor(cleanNickname) });
    });

    socket.on('send_message', (content: string) => {
      const isAdmin = socket.handshake.auth?.isAdmin === true;
      if (!chatActive && !isAdmin) return;
      const nickname = connectedUsers.get(socket.id) || (isAdmin ? '관리자' : '');
      
      if (!nickname && !isAdmin) return;

      const message = {
        id: Math.random().toString(36).substring(2, 9),
        nickname: isAdmin ? '관리자' : nickname,
        content,
        color: isAdmin ? '#000000' : getColor(nickname)
      };

      chatHistory.push(message);
      io.emit('new_message', message);
    });

    // Admin events
    socket.on('admin_login', (password, callback) => {
      if (password === '8624') {
        socket.handshake.auth = { isAdmin: true };
        callback({ success: true });
      } else {
        callback({ success: false });
      }
    });

    socket.on('clear_chat', () => {
      if (!socket.handshake.auth?.isAdmin) return;
      chatHistory = [];
      pinnedNotice = null;
      io.emit('pinned_notice_changed', null);
      io.emit('chat_cleared');
    });

    socket.on('toggle_anonymous', (enabled) => {
      if (!socket.handshake.auth?.isAdmin) return;
      anonymousMode = enabled;
      io.emit('anonymous_mode_changed', anonymousMode);
    });

    socket.on('pin_notice', (messageId) => {
      if (!socket.handshake.auth?.isAdmin) return;
      const found = chatHistory.find(m => m.id === messageId);
      if (found) {
        pinnedNotice = found;
        io.emit('pinned_notice_changed', pinnedNotice);
      }
    });

    socket.on('unpin_notice', () => {
      if (!socket.handshake.auth?.isAdmin) return;
      pinnedNotice = null;
      io.emit('pinned_notice_changed', null);
    });

    socket.on('toggle_chat_active', (active) => {
      if (!socket.handshake.auth?.isAdmin) return;
      chatActive = active;
      io.emit('chat_active_changed', chatActive);
    });

    socket.on('client_ping', (callback) => {
      if (typeof callback === 'function') callback();
    });

    socket.on('disconnect', () => {
      const nickname = connectedUsers.get(socket.id);
      if (nickname) {
        usedNicknames.delete(nickname);
        connectedUsers.delete(socket.id);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // For Express 4 and Production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
