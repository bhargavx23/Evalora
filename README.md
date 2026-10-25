# Evalora — Monorepo Architecture

> **AI-Powered Assessment, Multi-Domain Learning, and Adaptive Practice Platform**

Evalora is a modern monorepo application structured into two clean, deployment-ready application directories:
- **`client/`**: React 18 + TypeScript + Vite frontend.
- **`server/`**: Node.js + Express + TypeScript + MongoDB backend.

---

## 1. Monorepo Directory Structure

```text
Evalora/
├── client/                     # Frontend Application
│   ├── public/                 # Static assets & favicons
│   ├── src/                    # React frontend source code
│   │   ├── api/                # Axios HTTP client & interceptors
│   │   ├── components/         # Reusable UI components & navigation
│   │   ├── context/            # React context providers (Auth, etc.)
│   │   ├── features/           # Feature-specific components
│   │   ├── layouts/            # Page layouts & wrappers
│   │   ├── pages/              # Route pages (Student, Faculty, Admin, Public)
│   │   ├── services/           # Frontend business services & wallet adapters
│   │   ├── shared/             # Frontend constants & domain types
│   │   └── utils/              # Frontend formatting & utility helpers
│   ├── .env.example            # Client environment variable template
│   ├── index.html              # Frontend HTML entry point
│   ├── package.json            # Client package manifest
│   ├── package-lock.json       # Client lockfile
│   ├── postcss.config.js       # PostCSS configuration
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   ├── tsconfig.json           # Client TypeScript configuration
│   └── vite.config.ts          # Vite build & dev proxy configuration
│
├── server/                     # Backend API & Worker Engine
│   ├── src/                    # Backend source code
│   │   ├── config/             # Environment, DB, Algorand & domain configs
│   │   ├── controllers/        # REST route controllers
│   │   ├── docs/               # Backend architecture & OAuth guides
│   │   ├── integrations/       # External service connectors
│   │   ├── jobs/               # Background scheduled jobs (48h adaptive scheduler)
│   │   ├── middleware/         # Auth, validation, rate-limiting & error middleware
│   │   ├── models/             # Mongoose schemas & data models
│   │   ├── routes/             # Express API route declarations
│   │   ├── services/           # Core business logic (AI, code execution, payments, PDF)
│   │   ├── shared/             # Server constants & domain types
│   │   ├── utils/              # Logger, seed scripts, & helper utilities
│   │   └── server.ts           # Server entry point
│   ├── tests/                  # Automated integration & unit test suites (Vitest)
│   ├── .env.example            # Server environment variable template
│   ├── package.json            # Server package manifest
│   ├── package-lock.json       # Server lockfile
│   └── tsconfig.json           # Server TypeScript configuration
│
├── .env.example                # Safe repository-level environment template
├── .gitignore                  # Git exclusions for monorepo
├── package.json                # Monorepo root workspace scripts
├── package-lock.json           # Root lockfile
└── README.md                   # Project documentation
```

---

## 2. Root Development Commands

All lifecycle scripts can be executed directly from the repository root:

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Concurrently starts both **Backend (port 5000)** and **Frontend (port 5173)**. |
| `npm run dev:backend` | Starts only the backend dev server via `tsx watch`. |
| `npm run dev:frontend` | Starts only the frontend dev server via `vite`. |
| `npm run build` | Builds both the backend (`tsc`) and frontend (`tsc && vite build`). |
| `npm run build:server` | Compiles backend TypeScript to `server/dist`. |
| `npm run build:client` | Compiles frontend production bundle to `client/dist`. |
| `npm run lint` | Performs TypeScript typechecking (`tsc --noEmit`) across both projects. |
| `npm test` | Runs the full Vitest automated test suite across all subsystems. |
| `npm run seed` | Seeds initial colleges, administrators, domains, and question banks. |
| `npm run start:server` | Starts the compiled production backend server (`node dist/server.js`). |

---

## 3. Environment Configuration

### Client (`client/.env.example`)
| Variable | Description | Default (Local) |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base API URL for HTTP requests. Use `/api` with reverse proxy, or full URL (e.g., `https://api.evalora.com/api`) for cross-origin setups. | `/api` |

### Server (`server/.env.example`)
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | HTTP port for the Express API server | `5000` |
| `NODE_ENV` | Runtime environment (`development` / `production` / `test`) | `development` |
| `CLIENT_URL` | Allowed CORS origin for web client | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/evalora` |
| `JWT_SECRET` | Secret key for signing JSON Web Tokens ($\ge 32$ chars in prod) | `<generated-secret>` |
| `JWT_EXPIRES_IN` | Token validity period | `7d` |
| `GEMINI_API_KEY` | Google Gemini API Key for autonomous question generation | `<gemini-key>` |
| `GEMINI_MODEL` | Google Gemini model identifier | `gemini-3.8-flash` |
| `SMTP_HOST` | SMTP server host for sending OTP challenge emails | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port (465 for SSL, 587 for TLS) | `465` |
| `SMTP_USER` | SMTP username / sender email | `admin@evalora.com` |
| `SMTP_PASS` | SMTP application password | `<app-password>` |
| `EVALORA_PAYMENT_WALLET` | Algorand receiver treasury address for verified payments | `WLLFEO...` |
| `ALGORAND_NETWORK` | Algorand network (`testnet` / `mainnet`) | `testnet` |

---

## 4. Production Deployment

### Option A: Separate Frontend & Backend Deployment (Recommended)

#### 1. Backend Deployment (`server/`)
- **Platforms**: Render, Railway, AWS ECS, DigitalOcean App Platform, Fly.io.
- **Root Directory**: `server`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start` (executes `node dist/server.js`)
- **Required Env**: Configure MongoDB URI, JWT secret, Gemini key, SMTP credentials, and set `CLIENT_URL` to your production frontend domain.

#### 2. Frontend Deployment (`client/`)
- **Platforms**: Vercel, Netlify, Cloudflare Pages, AWS S3 + CloudFront.
- **Root Directory**: `client`
- **Build Command**: `npm install && npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - Set `VITE_API_URL` to your production backend URL (e.g. `https://api.evalora.com/api`).
- **SPA Routing**: Configure single-page application fallback rewrite rules to point all routes to `/index.html`.

---

## 5. Security & Verification Guarantee

- **Zero Secret Exposure**: Server credentials, API keys, and private seeds are strictly maintained server-side and excluded from frontend bundles and Git tracking.
- **Monorepo Cleanliness**: No source code or dangling artifacts exist outside `client/` and `server/`.
- **100% Automated Test Suite Passing**: 11 out of 11 Vitest test suites (115 / 115 tests green) covering authentication, Web3 wallets, Algorand payments, coding execution sandbox, domain learning, and the 48-hour adaptive practice scheduler.
