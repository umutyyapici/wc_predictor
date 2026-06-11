# 🏆 WC Prediction League 2026

> A full-stack World Cup match score prediction game for friend groups — with group-based leaderboards, a daily joker system, and automated fixture/score syncing.

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=github-actions&logoColor=white)

---

## ✨ Features

- **🔒 Automatic Betting Lock:** Predictions are locked 1 hour before kick-off. No backdating or last-minute changes allowed — enforced both in the UI and at the database level via a Postgres trigger.
- **🃏 Daily Joker:** Each user gets one Joker per day. Apply it to any match to double your points for that game. The one-joker-per-day rule is enforced server-side, so it can't be bypassed via the browser console or direct API calls.
- **👥 Group-Based Leaderboards:** Users join their friend group via an invite code at registration. Each group has its own separate standings.
- **👀 View Others' Predictions:** Once a match is locked or the betting window closes, all predictions from the same group become visible.
- **📧 Account Recovery:** Users provide a recovery email at signup (and existing users are prompted via a one-time popup). This email becomes their login email in Supabase Auth, so they can use the built-in **"Forgot Password"** flow to reset a forgotten password themselves — no admin intervention needed.
- **🤖 Automated Fixture & Score Sync:** A scheduled GitHub Actions workflow fetches fixtures and final scores from the Football-Data.org API every hour and writes them to the database. Already-locked matches are never overwritten.
- **📅 Calendar Navigation:** Browse any day of the tournament using arrow navigation or a mini calendar picker.

---

## 🎯 Scoring System

| Category | Description | Points |
| :--- | :--- | :---: |
| **EXACT SCORE 🔥** | Correct result (1/X/2) and correct scoreline | **6** |
| **CLOSE CALL 🎯** | Correct result and one team's goal count correct | **3** |
| **STRATEGIST ↔️** | Correct result and correct goal difference (wrong goals) | **2** |
| **SAGE 🔮** | Correct result (1/X/2) only | **1** |
| **CONSOLATION ⚽** | Wrong result but one team's goal count correct | **1** |
| **JOKER 🃏** | Doubles all points for that match | **max 12** |

---

## ⚖️ Tiebreaker Criteria

When points are equal, ranked by (in order):

1. EXACT SCORE count (more → higher)
2. CLOSE CALL count (more → higher)
3. STRATEGIST count (more → higher)
4. SAGE count (more → higher)
5. CONSOLATION count (more → higher)
6. Total predictions made (fewer → higher)
7. Username alphabetical order (Turkish locale)

---

## 🚀 Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React + Vite (inline CSS) |
| Backend & Database | Supabase (PostgreSQL + Row Level Security) |
| Automation | GitHub Actions + Node.js |
| Data Provider | [Football-Data.org API v4](https://www.football-data.org/) |
| Deployment | Vercel |

---

## ⚙️ Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_INVITE_CODE=your_invite_code
VITE_ADMIN_PASS=your_admin_password

# Only needed locally to run the one-time `npm run sync-emails` migration
# (see "Password Reset Migration" below). Do NOT prefix with VITE_ — these
# must never be bundled into the frontend or deployed to Vercel.
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. GitHub Secrets

For automated score syncing, add the following under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| :--- | :--- |
| `FOOTBALL_API_TOKEN` | Your Football-Data.org API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin-level writes) |

### 3. Database Setup (Supabase SQL Editor)

Run the SQL files in `supabase/sql/` against your Supabase project, in order:

| File | What it does |
| :--- | :--- |
| `01_recovery_email.sql` | Adds the `profiles.recovery_email` column and an RLS policy so users can update their own profile. |
| `02_prediction_guards.sql` | Adds a `BEFORE INSERT/UPDATE` trigger on `predictions` that enforces the betting lock, the locked-match rule, and the one-joker-per-day rule at the database level — closing the browser-console bypass. |
| `03_indexes.sql` | Adds indexes on `predictions`, `user_groups`, and `matches` to keep the app fast as the user base grows. |
| `04_login_email_lookup.sql` | Adds a `get_login_email(username)` RPC function so the login form can find a user's current Supabase Auth email (which may have been migrated to their real `recovery_email`). |

All four are idempotent (`if not exists` / `or replace`), so they're safe to re-run.

### 4. Password Reset Migration (One-Time)

Originally every account used a generated `username@tahmin.com` address as its Supabase Auth email, so Supabase's built-in "forgot password" emails couldn't reach real users. Once users have provided a `recovery_email` (via signup or the recovery popup), run this **one-time** script to copy `profiles.recovery_email` into `auth.users.email` for those accounts:

```bash
npm run sync-emails
```

This requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your local `.env` (see above) — it uses the Supabase Admin API and must be run from a trusted machine, never from the browser. The script:

- Skips users who don't have a `recovery_email` yet (they keep using `username@tahmin.com` until they provide one).
- Skips users whose Auth email is already up to date.
- Reports any failures (e.g. two users accidentally entering the same recovery email) so they can be resolved manually in the Supabase dashboard.

After running it, also check **Authentication → URL Configuration** in the Supabase dashboard and make sure your app's URL (e.g. `http://localhost:5173` for local dev, plus your production domain) is listed under **Site URL** / **Redirect URLs** — this is required for the password reset email link to redirect back into the app correctly.

### 5. Install & Run

```bash
npm install
npm run dev
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│          GitHub Actions (Hourly Cron)       │
│   Football-Data.org API → Supabase          │
│   (Locked matches are skipped)              │
└────────────────────┬────────────────────────┘
                     │
              ┌──────▼──────┐
              │   Supabase  │  PostgreSQL + RLS
              │  (Database) │  Group-based access
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │    React    │  Vite
              │  (Frontend) │  Deployed on Vercel
              └─────────────┘
```

---

*Built for the love of football and the thrill of competition. May the best predictor win.* ⚽🔥
