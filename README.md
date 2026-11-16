# Pinnacle Meet — Online Video Conferencing & Classroom Platform

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 (`src/App.tsx`, `src/components/*`)
- **Backend**: Node.js + Express + WebSocket (`server.ts`, `src/realtime/wsServer.ts`)
- **Database**: PostgreSQL via Cloud SQL + Drizzle ORM (`src/db/schema.ts`, `src/db/index.ts`, `src/db/repository.ts`)
- **Real-Time Media**: Built-in multi-peer WebRTC (`RTCPeerConnection` + WebSocket signaling + STUN/TURN + adaptive bitrate + Web Audio active speaker detection) with optional **LiveKit SFU** scaling (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)
- **Authentication**: Email/Mobile/Password (`bcryptjs` + JWT) and Google Sign-In (Firebase Auth)
- **Payments**: Razorpay INR checkout (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, with built-in test-mode verification when keys are omitted)

## Environment Variables

Configure these in your deployment environment (never commit secrets):

- `PORT`: Server port (`3000`)
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`: Runtime PostgreSQL credentials
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`: Drizzle Kit schema migration credentials
- `JWT_SECRET`: Long random secret for session & meeting access tokens
- `SUPER_ADMIN_EMAIL`: Email address automatically granted `super_admin` privileges on first registration/sign-in (defaults to the workspace owner email)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` *(optional)*: Enables LiveKit SFU media routing for 100–500 participant rooms
- `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` *(optional)*: Dedicated TURN relay for strict corporate NATs
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` *(optional)*: Live Razorpay INR checkout keys

## Administrator Account Setup

1. Set `SUPER_ADMIN_EMAIL` to your administrator email address (or register the very first user on the platform—the first registered user is automatically assigned `super_admin`).
2. Sign up via **Register** (name, email, mobile number, password) or click **Continue with Google**.
3. Open **Admin** in the top navigation bar (or **Admin Panel** from the dashboard) to manage users, suspend/block accounts, force-end active rooms, monitor storage, inspect Razorpay payments, and review audit logs.

## Build & Run Commands

```bash
npm install
npm run build
npm run start
```
