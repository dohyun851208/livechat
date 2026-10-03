# Live Class Chat

A narrow real-time classroom chat app for questions and feedback during a live class or presentation.

## Local Development

Prerequisites: Node.js 22 (see `.nvmrc`).

1. Install dependencies:
   `npm install`
2. Optional: copy `.env.example` to `.env.local` and fill in production-like values. Remove the Redis placeholders to use local in-memory storage.
3. Run the app:
   `npm run dev`

## Vercel

This project uses Vercel static hosting for the Vite client and `api/chat.ts` for the chat API.

- Vercel build command: `npm run build:client`
- Output directory: `dist`
- Node.js version: 22.x
- Shared storage: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the Vercel Marketplace `KV_REST_API_URL` and `KV_REST_API_TOKEN` pair
- Admin password: set `ADMIN_PASSWORD` in Vercel project environment variables; production admin access is disabled without it
- Chat message retention: 90 minutes from each message timestamp

Without Upstash Redis, Vercel serverless instances use temporary in-memory chat state.
For a classroom shared across devices, configure working Redis credentials. If configured Redis is unavailable, the existing temporary in-memory fallback is retained and a server warning is logged. That fallback is scoped to each serverless instance and cannot guarantee shared messages or session persistence. Correct the Redis settings and redeploy before relying on it for a class.

## Validation

Run `npm run lint`, `npm test`, and `npm run build` with Node.js 22.

Redis integration tests use a unique test namespace and clean up their own data. With valid Redis credentials in `.env.local`, run:

```powershell
$env:LIVECHAT_TEST_REDIS = '1'
npm test
```
