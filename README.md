# Live Class Chat

A narrow real-time classroom chat app for questions and feedback during a live class or presentation.

## Local Development

Prerequisites: Node.js

1. Install dependencies:
   `npm install`
2. Optional: copy `.env.example` to `.env.local` and fill in production-like values.
3. Run the app:
   `npm run dev`

## Vercel

This project uses Vercel static hosting for the Vite client and `api/chat.ts` for the chat API.

- Vercel build command: `npm run build:client`
- Output directory: `dist`
- Optional persistence: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Admin password: set `ADMIN_PASSWORD` in Vercel project environment variables
- Chat message retention: 90 minutes from each message timestamp

Without Upstash Redis, Vercel serverless instances use temporary in-memory chat state.
