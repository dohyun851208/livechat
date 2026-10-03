import express from 'express';
import path from 'path';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import type { ErrorRequestHandler } from 'express';
import { createServer as createViteServer } from 'vite';
import { getChatStateResponse, handleChatAction } from './src/chat-controller.js';
import { getGlobalChatStore } from './src/global-chat-store.js';

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production' && existsSync('.env.local')) {
    loadEnvFile('.env.local');
  }
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const store = getGlobalChatStore();

  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', timestamp: Date.now() });
  });

  app.get('/api/chat', async (_request, response, next) => {
    try {
      response.setHeader('Cache-Control', 'no-store');
      response.json(await getChatStateResponse(store));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/chat', async (request, response, next) => {
    try {
      response.setHeader('Cache-Control', 'no-store');
      const result = await handleChatAction(store, request.body);
      response.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      next(error);
    }
  });

  const handleApiError: ErrorRequestHandler = (error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    const status = error.status === 400 || error.status === 413 ? error.status : 503;
    response.status(status).json({
      ok: false,
      error: status === 400 || status === 413
        ? '요청 형식이 올바르지 않습니다.'
        : '채팅 서버에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
    });
  };
  app.use('/api', handleApiError);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

void startServer();
