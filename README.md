# 🏆 WC Prediction League 2026

> A full-stack World Cup match score prediction game for friend groups — with group-based leaderboards, a daily joker system, and automated fixture/score/account syncing.

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
- **📧 Account Recovery:** Users provide a recovery email at signup (and existing users are prompted via a one-time-per-day popup). This email is kept in sync with their Supabase Auth login email, so they can use the built-in **"Forgot Password"** flow to reset a forgotten password themselves — no admin intervention needed.
- **🔑 Self-Service Email Claim:** Users who haven't set a `recovery_email` yet can do so directly from the "Forgot Password" screen by entering their username + email — their Auth login email is updated immediately and a reset link is sent right away. Has no effect if a `recovery_email` is already set, to prevent account takeover.
- **🔐 In-App Password Change:** Logged-in users can set a new password at any time via the 🔑 button in the header — useful as a fallback if a password-reset email link signs the user in directly without showing the reset screen (a known quirk with some email clients' link scanners).
- **🤖 Automated Fixture & Score Sync:** A scheduled GitHub Actions workflow fetches fixtures and final scores from the Football-Data.org API every 30 minutes and writes them to the database. Already-locked matches are never overwritten.
- **🔄 Automated Recovery Email Sync:** A second scheduled GitHub Actions workflow runs every 30 minutes to copy any newly-set `profiles.recovery_email` values into `auth.users.email`, so password resets keep working even for users who set their recovery email via the popup instead of the claim flow.
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

# Only needed locally to run the `npm run sync-emails` script manually
# (see "Recovery Email Sync" below). Do NOT prefix with VITE_ — these
# must never be bundled into the frontend or deployed to Vercel.
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. GitHub Secrets

For automated fixture/score syncing and recovery email syncing, add the following under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| :--- | :--- |
| `FOOTBALL_API_TOKEN` | Your Football-Data.org API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin-level writes) |

### 3. Database Setup (Supabase SQL Editor)

Run the SQL files in `supabase/sql/` against your Supabase project, in order:

| File | What it does |
| :--- | :--- |
| `00_schema.sql` | Base schema: creates `profiles`, `matches`, `predictions` tables, RLS policies, realtime publication, `updated_at` trigger, and a few sample matches. Run this first on a fresh project. |
| `01_recovery_email.sql` | Adds the `profiles.recovery_email` column and an RLS policy so users can update their own profile. |
| `02_prediction_guards.sql` | Adds a `BEFORE INSERT/UPDATE` trigger on `predictions` that enforces the betting lock, the locked-match rule, and the one-joker-per-day rule at the database level — closing the browser-console bypass. |
| `03_indexes.sql` | Adds indexes on `predictions`, `user_groups`, and `matches` to keep the app fast as the user base grows. |
| `04_login_email_lookup.sql` | Adds a `get_login_email(username)` RPC function so the login form can find a user's current Supabase Auth email (which may have been migrated to their real `recovery_email`). |
| `05_claim_recovery_email.sql` | Adds a `claim_recovery_email(username, email)` RPC so users whose `recovery_email` is still unset can self-serve set it from the "Forgot Password" screen and immediately receive a password reset link. No-ops if `recovery_email` is already set (prevents account takeover). |

All six are idempotent (`if not exists` / `or replace`), so they're safe to re-run. Note: `profiles.recovery_email` (added by `01`) isn't in `00_schema.sql`'s `create table` — it's added separately by `01_recovery_email.sql`, so run them in order even on a fresh project.

### 4. GitHub Actions Workflows

| Workflow | Schedule | What it does |
| :--- | :--- | :--- |
| `.github/workflows/sync_matches.yml` | Every 30 minutes (`*/30 * * * *`) + manual | Fetches the World Cup fixture list and scores from Football-Data.org and upserts them into the `matches` table. Skips matches already locked with a final score. |
| `.github/workflows/sync_emails.yml` | Every 30 minutes (`*/30 * * * *`) + manual | Runs `npm run sync-emails` to copy any `profiles.recovery_email` into `auth.users.email` for accounts that haven't been migrated yet. |

Both can also be triggered manually from the **Actions** tab via "Run workflow" (`workflow_dispatch`). GitHub's scheduled triggers are "best effort" and can be delayed during high load — a 30-minute interval keeps the gap small, but manual triggers are useful right after a match ends or a user sets their recovery email.

### 5. Recovery Email Sync (Background Job)

Originally every account used a generated `username@tahmin.com` address as its Supabase Auth email, so Supabase's built-in "forgot password" emails couldn't reach real users. Once a user's `profiles.recovery_email` is set (via the recovery popup, signup, or the "Forgot Password" claim flow), the `sync_emails.yml` workflow copies it into `auth.users.email` within 30 minutes.

To run it manually instead (e.g. for local debugging):

```bash
npm run sync-emails
```

This requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your local `.env` (see above) — it uses the Supabase Admin API and must be run from a trusted machine, never from the browser. The script:

- Skips users who don't have a `recovery_email` yet (they keep using `username@tahmin.com` until they provide one).
- Skips users whose Auth email is already up to date.
- Reports any failures (e.g. two users accidentally entering the same recovery email) so they can be resolved manually in the Supabase dashboard.

After setting this up, also check **Authentication → URL Configuration** in the Supabase dashboard and make sure your app's URL (e.g. `http://localhost:5173` for local dev, plus your production domain) is listed under **Site URL** / **Redirect URLs** — this is required for the password reset email link to redirect back into the app correctly.

### 6. Install & Run

```bash
npm install
npm run dev
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│       GitHub Actions (Every 30 Minutes)      │
│  • sync_matches: Football-Data.org → Supabase│
│    (Locked matches are skipped)              │
│  • sync_emails: profiles.recovery_email      │
│    → auth.users.email                        │
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
