# TradeConnect — Final (Phases 1–5)

Full-stack marketplace for employers, tradespeople, and junior tradespeople.

Stack: **Next.js 14 + TypeScript**, **Flask**, **MySQL**.

This is the merged "best of" build: the Phase 1–4 academic foundation
(`PHASE1_NOTES.md` … `PHASE4_NOTES.md`) plus a real revenue model and a
backend refactor (Phase 5, `PHASE5_NOTES.md`).

## What's included

**Phase 1 — Database (15 tables, 3NF)**
Users, tradespeople, services, job postings, applications, bookings,
payments, reviews, endorsement requests, documents, revenue streams,
platform fees, subscription plans, subscriptions, review requests. Plus 7
triggers for junior-booking validation, review-request auto-creation,
endorsement approval, and job-accept → booking handoff.

**Phase 2 — Job posting + application system (backend)**
Employers post, tradespeople apply, juniors are gated until endorsed.

**Phase 3 — Endorsement requests + document upload (backend)**
Real multipart upload with path-traversal and mime-spoofing defenses;
trigger sets `endorse_id` only on approved endorsements.

**Phase 4 — Frontend wiring**
22 routes, all typed against the backend.

**Phase 5 — Revenue model + refactor**
- 10% platform service fee on every paid booking (computed server-side
  with `Decimal` / `ROUND_HALF_UP`, recorded in `platform_fees`).
- Tradesperson subscriptions: Free / Pro / Elite, with `subscription_plans`
  as the catalog table (3NF) and `price_at_purchase` as a per-row snapshot
  for historical accuracy.
- Backend refactor: `create_app()` factory, env-driven config, centralized
  `db.py` with a `db_cursor()` context manager.

## Revenue stream details

Two streams, both recorded in `revenue_streams`:

1. **Platform service fee** — `POST /api/payments` records the payment and
   inserts a corresponding `platform_fees` row at 10%. The response
   includes `platform_fee_amount` and `tradesperson_payout`.
2. **Tradesperson subscription** — plans live in `subscription_plans`
   (catalog). Activating creates a `subscriptions` row that FKs to the
   plan and snapshots the price into `price_at_purchase`.

New backend routes:

- `POST /api/payments` — records payment and platform fee revenue.
- `GET /api/subscriptions/plans` — lists active plans from the catalog.
- `GET /api/subscriptions/me` — current subscription (joined with plan).
- `POST /api/subscriptions` — activates Pro or Elite.
- `PATCH /api/subscriptions/me/cancel` — cancels and resets to Free.
- `GET /api/revenue/summary` — platform-fee and subscription totals,
  per-stream breakdown (Employer-gated).

New frontend pages:

- `/bookings` now shows platform fee and tradesperson payout.
- `/tradesperson/subscription` lets tradespeople manage paid plans.
- `/admin/revenue`, `/admin/users`, and `/admin/settings` are visible only when signing in as an Admin user.

## What changed in this update

- **Reviews UI** — the "Leave a review" button on `/bookings` now hides once the employer has submitted a review for that booking (backend `GET /api/bookings` returns a new `has_review` flag joined from the `reviews` table).
- **Admin super user** — the `users.user_type` ENUM gained `'Admin'`. Admins see a separate sidebar with Revenue, Users, and Settings. Non-admins no longer see the revenue page at all. The admin can:
  - View and delete any user (`/admin/users`, backed by `/api/admin/users`).
  - Change the platform service fee % at runtime (`/admin/settings`, stored in a new single-row `platform_settings` table; the payments route reads it on every charge).
  - Edit subscription plan prices (existing subscribers keep their `price_at_purchase` snapshot).
- **Booking guardrails** — two new triggers on `bookings` enforce that a tradesperson cannot:
  1. accept two jobs scheduled at the same time, and
  2. accept a job whose `city` differs from their own user `city`.
  Both trigger on INSERT and on UPDATE that would put a row into a slot it didn't previously occupy.
- **Sample data** — adds an admin account plus 3 new employers, 3 new senior tradespeople, and 3 new juniors (the juniors come in pre-endorsed by their respective seniors so they can take jobs immediately).

## Quick start

### 1. Database

```bash
cd database
mysql -u root < schema.sql
mysql -u root freelancer_db < triggers.sql
mysql -u root freelancer_db < sample_data.sql
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cat > .env <<'ENV'
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=freelancer_db
SECRET_KEY=change-this-dev-key
FRONTEND_URL=http://localhost:3000
ENV

python app.py
```

Backend runs on `http://localhost:5001`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Demo accounts

Use the passwords already defined in `database/sample_data.sql`.

- Admin: `admin@tradeconnect.com` (password `hashed_pw_admin`)
- Employer (NY): `alice@email.com`
- Employer (Jersey City): `grace@email.com`
- Employer (Newark): `henry@email.com`
- Senior plumber (NY): `bob@email.com`
- Senior plumber (Jersey City): `jack@email.com`
- Senior electrician (Newark): `karen@email.com`
- Senior carpenter (Brooklyn): `liam@email.com`
- Junior electrician (NY, still pending): `frank@email.com`
- Junior plumber (Jersey City, endorsed): `mia@email.com`

## Lean file map

```text
backend/
  app.py              Flask app factory + route registry
  config.py           Environment-based config
  db.py               Single DB connection helper
  routes/             Feature blueprints

database/
  schema.sql          Tables and indexes
  triggers.sql        Database automation rules
  sample_data.sql     Demo data

frontend/
  app/                Next.js App Router pages
  components/         Shared UI components
  context/            Auth context
  lib/api.ts          Typed API client
  types/index.ts      Shared frontend types
```

## Core data model

The database keeps the project normalized around these main entities:

- `users`
- `tradespeople`
- `services`
- `job_postings`
- `job_applications`
- `bookings`
- `payments`
- `reviews`
- `endorsement_requests`
- `documents`

Revenue tracking is represented through `revenue_streams`, `platform_fees`, and `subscriptions`. The design intentionally excludes a `subscription_plans` table to keep the database lean while still showing how the service can generate income.
