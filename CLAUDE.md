# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AlquilAR is a fullstack rental contract management system for Argentina. It tracks USD-indexed rental contracts, calculates periodic adjustments using Argentine economic indexes (ICL, IPC, UVA, etc.), generates PDF receipts, and provides role-based access for admins and tenants.

## Commands

### Root (runs both services concurrently)
```bash
npm run dev          # Start server + client in parallel
npm run start        # Production: server only
```

### Server (`server/`)
```bash
npm run dev          # Nodemon watch mode on port 5000
npm run start        # Production start
npm run seed         # Seed demo admin + tenant users
```

### Client (`client/`)
```bash
npm run dev          # Vite dev server on port 5173
npm run build        # Production build
npm run preview      # Preview production build
```

There are no test or lint scripts configured.

## Architecture

### Monorepo Layout
- `server/` — Express + Mongoose API
- `client/` — React + Vite SPA
- Root `package.json` uses `concurrently` to run both together

### Authentication Flow
1. Email/password → JWT (7-day) stored in `localStorage`
2. Magic links: admin generates a 24-hour token → tenant auto-logs in via `/magic-login?token=...`
3. `client/src/api/client.js` is an Axios instance with a request interceptor that auto-attaches the JWT
4. `server/src/middleware/auth.js` exports `authRequired` and `requireRole('admin')` middleware

### Role-Based Access
- `admin`: full access — creates users, contracts, increments, receipts
- `user` (tenant): read-only access to their own contracts and receipts
- `ProtectedRoute.jsx` enforces role-based routing on the frontend

### Contract Lifecycle
1. Admin creates a contract linking a tenant, base amount (USD), index type, frequency (months), and duration (years)
2. The model computes `nextIncrementDate` and `expirationDate` on save
3. Increment preview fetches a % from ArquilaAPI (external) via `server/src/services/indexProvider.js`; falls back to manual override
4. Increment confirm records the event in `incrementHistory`, updates `currentAmountUsd`, and advances `nextIncrementDate`
5. Projection (`server/src/utils/projection.js`) builds the full payment schedule: confirmed history + estimated future increments

### Receipt Generation
- `POST /api/contracts/:contractId/receipts/generate?year=YYYY&month=MM` (admin only)
- PDFKit creates a PDF saved to `server/storage/receipts/`
- Receipt document is upserted with `{contract, year, month}` as unique key
- Tenant downloads via `GET /api/receipts/:id/download`

### Installments Table
`GET /api/contracts/:id/installments` merges the projection array with receipt records to return per-month status: `paid`, `current`, `past` (unpaid), or `upcoming`.

### Index Provider Pattern
`server/src/services/indexProvider.js` wraps ArquilaAPI. The function is designed to be swapped — if the API fails or is unavailable, a `FallbackProvider` (manual %) is used instead.

### Date Convention
All dates are normalized to UTC start-of-month using helpers in `server/src/utils/dateMath.js`. Never store or compare mid-month timestamps for contract dates.

## Environment Variables

**Server** (`server/.env`):
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/alquilar
JWT_SECRET=<base64 secret>
APP_BASE_URL=http://localhost:5173
```

**Client** (`client/.env`):
```
VITE_API_URL=http://localhost:5000/api
```

## Key Data Models

**Contract** — core entity: `tenant`, `adminOwner`, `baseAmountUsd`, `currentAmountUsd`, `indexType`, `incrementFrequencyMonths`, `nextIncrementDate`, `expirationDate`, `incrementHistory[]`, `manualOverridePercent`, `manualNextAmountUsd`, `status`

**Receipt** — `{contract, year, month}` unique; stores `filePath` to PDF on disk

**MagicLink** — TTL-indexed (MongoDB auto-deletes expired tokens)

## Demo Credentials (seed data)
- Admin: `admin@alquilar.local` / `admin1234`
- Tenant: `tenant@alquilar.local` / `tenant1234`
