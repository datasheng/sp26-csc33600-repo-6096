# TradeConnect — Frontend

Next.js 14 frontend for the TradeConnect skilled trades platform.

## Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Flask REST API (see backend repo)
- **Database**: MySQL (schema in database repo)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL to your Flask server URL

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Make sure your Flask backend is running on the URL set in `.env.local` (default: `http://localhost:5000`).

## Project Structure

```
app/
├── page.tsx                    ← Public landing page
├── login/page.tsx              ← Login (wired to POST /api/auth/login ✅)
├── register/page.tsx           ← Register (wired to POST /api/auth/register ✅)
├── employer/
│   ├── dashboard/page.tsx      ← Employer home
│   └── browse/page.tsx         ← Browse tradespeople
├── tradesperson/
│   ├── dashboard/page.tsx      ← Tradesperson home
│   └── jobs/page.tsx           ← Browse available jobs
├── junior/
│   ├── dashboard/page.tsx      ← Junior home + onboarding checklist
│   ├── setup/page.tsx          ← Doc upload + endorsement request
│   └── jobs/page.tsx           ← Jobs with job-cap indicator
├── bookings/page.tsx           ← All bookings (all roles)
├── reviews/page.tsx            ← Review requests + history
├── notifications/page.tsx      ← Notifications center
└── profile/page.tsx            ← User profile (+ trade fields if applicable)

components/
├── layout/DashboardLayout.tsx  ← Sidebar nav (role-aware)
└── ui/
    ├── StatusBadge.tsx         ← Booking/payment/review status pills
    └── StarRating.tsx          ← Interactive + readonly star rating

lib/
└── api.ts                      ← ALL Flask API calls in one place

types/
└── index.ts                    ← TypeScript types mirroring DB schema exactly

context/
└── AuthContext.tsx             ← Global auth state (login/logout/user)

middleware.ts                   ← Route protection (redirect to /login if no session)
```

## API Status

| Route | Backend Status |
|---|---|
| `POST /api/auth/register` | ✅ Implemented |
| `POST /api/auth/login` | ✅ Implemented |
| `POST /api/auth/logout` | ✅ Implemented |
| `GET/POST /api/bookings` | ⚠️ Not yet built |
| `GET/POST /api/reviews` | ⚠️ Not yet built |
| `GET /api/notifications` | ⚠️ Not yet built |
| `GET /api/tradespeople` | ⚠️ Not yet built |
| `GET /api/services` | ⚠️ Not yet built |
| `GET/POST /api/payments` | ⚠️ Not yet built |

Pages using unbuilt routes show **mock data** and have a comment pointing to the exact `lib/api.ts` call to swap in.

## Key Notes

- **Passwords**: The backend currently stores passwords as plain text. Once the team adds bcrypt hashing, no frontend changes are needed.
- **Session auth**: Flask uses cookie-based sessions. The middleware checks for the `session` cookie. If the team later switches to JWT, update `middleware.ts` to check `Authorization` header instead.
- **Adding a new route**: Add the function to `lib/api.ts`, then call it in the relevant page. Types are already in `types/index.ts`.
