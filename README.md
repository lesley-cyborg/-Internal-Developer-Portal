# DevPulse: Secure Internal Developer Portal

An internal engineering dashboard that ingests GitHub webhooks to track PR velocity and enforce security policies. It features a real-time UI, a fail-closed security gate for secret scanning, and a robust backend designed to handle the quirks of the GitHub API.

## 🚀 Key Features

- **Secure Webhook Ingestion:** Verifies GitHub payloads using HMAC-SHA256 signatures and `timingSafeEqual` to prevent spoofing.
- **Idempotency Engine:** Uses the `X-GitHub-Delivery` header to guarantee each event is processed exactly once, preventing duplicate data during network retries.
- **Security Gate:** A dedicated endpoint (`/api/v1/security-scan`) that allows CI tools to report vulnerabilities. High-severity findings automatically flip a PR's status to `blocked`, excluding it from velocity metrics.
- **BigInt Safety:** Handles GitHub's 64-bit resource IDs safely in PostgreSQL, avoiding the classic 32-bit integer overflow trap.
- **Unified DX:** A single `npm run dev` command spins up the Express backend, Next.js frontend, and a secure Cloudflare Tunnel for local webhook testing.

## 🏗️ Architecture

- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Frontend:** Next.js 15 (App Router) + Tailwind CSS v3 + Server Components
- **Database:** PostgreSQL (Dockerized)
- **Tunneling:** Cloudflare Tunnels (`cloudflared`) for secure local exposure

## 🛠️ Getting Started

### Prerequisites
- Node.js v20+
- Docker & Docker Compose

### Installation

1. **Clone the repository:**
```bash
   git clone https://github.com/lesley-cyborg/-Internal-Developer-Portal.git
   cd Internal-Developer-Portal
```

2. **Start the database:**
```bash
   docker-compose up -d
```

3. **Install dependencies and run the unified stack:**
```bash
   npm install
   npm run dev
```
   *This will start the backend on port 3001, the frontend on port 3000, and a Cloudflare tunnel.*

4. **Configure GitHub Webhooks:**
   - Go to your repo settings -> Webhooks.
   - Set the Payload URL to the Cloudflare tunnel URL provided in your terminal (append `/webhooks/github`).
   - Set Content-Type to `application/json`.
   - Add a Secret (must match `GITHUB_WEBHOOK_SECRET` in your `.env`).

## ⚖️ Trade-offs & Design Decisions

### 1. Application-Layer Metrics vs. Raw SQL
Initially, I used PostgreSQL's `EXTRACT(EPOCH FROM ...)` to calculate time-to-merge. However, mapping Postgres `NUMERIC` types back to JavaScript via Prisma's `$queryRaw` caused type-casting friction. 
**Decision:** I refactored to use Prisma's type-safe `findMany` and computed the time deltas in the application layer. For an internal dashboard with thousands of rows, this is safer, fully type-checked, and avoids database dialect lock-in.

### 2. Ephemeral Tunnels vs. Stable Domains
The project uses Cloudflare's "quick tunnels" for local development. These URLs change on every restart. 
**Trade-off:** While perfect for local testing, a production deployment would require a stable domain or a named Cloudflare Tunnel so GitHub's webhook endpoint doesn't need constant updating.

### 3. Fail-Closed Security Posture
The Security Gate is designed to be "fail-closed." Once a PR is marked `blocked` by a high-severity scan, a subsequent low-severity scan cannot unblock it. This ensures that security findings are never accidentally washed away by noisy, low-priority warnings.