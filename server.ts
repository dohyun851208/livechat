import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getChatStateResponse, handleChatAction } from './src/chat-controller.js';
import { getGlobalChatStore } from './src/global-chat-store.js';

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const store = getGlobalChatStore();

  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', timestamp: Date.now() });
  });

  app.get('/api/chat', async (_request, response) => {
    response.json(await getChatStateResponse(store));
  });

  app.post('/api/chat', async (request, response) => {
    const result = await handleChatAction(store, request.body);
    response.status(result.ok ? 200 : 400).json(result);
  });

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
