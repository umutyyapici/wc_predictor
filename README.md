# 🏆 WC Prediction League 2026

> A full-stack World Cup match score prediction game for friend groups — with group-based leaderboards, a daily joker system, player profiles, and automated fixture/score syncing.

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=github-actions&logoColor=white)

---

## ✨ Features

- **🔒 Automatic Betting Lock:** Predictions are locked 1 hour before kick-off. No backdating or last-minute changes allowed — enforced both in the UI and at the database level via a Postgres trigger.
- **🃏 Daily Joker:** Each user gets one Joker per day. Apply it to any match to double your points for that game. The one-joker-per-day rule is enforced server-side, so it can't be bypassed via the browser console or direct API calls.
- **🔔 Joker Reminder:** If a user has made predictions for a day but hasn't assigned their Joker — and at least one of that day's matches still has an open betting window — a reminder popup appears the next time they save a prediction. The popup lists the affected days and can be permanently dismissed via a "Don't show again" option (stored in `localStorage`).
- **👥 Group-Based Leagues:** Users join their friend group via an invite code at registration, and can join additional groups at any time via the `+` button in the header. The active group is selected from the header and drives the leaderboard, score total, and "others' predictions" view.
- **🏆 League Tab:** Shows the ranked standings for the active group. Clicking any player opens a **Player Profile Modal** with their full stats and a paginated list of their predictions (5 per page, newest first).
- **🕒 Group-Scoped Scoring:** A group's leaderboard and each member's total only count matches that kicked off after that group's invite code was created (`allowed_groups.created_at`) — a fair starting line for groups formed mid-tournament. Earlier matches are still shown in the Predict tab, marked as "grup öncesi" (before group) and excluded from totals.
- **👀 View Others' Predictions:** Once a match is locked or the betting window closes, all predictions from the same group become visible. The "Others" panel filters by the active group, so switching groups shows the correct set of predictions.
- **📲 Install Guide (PWA):** A one-time popup guides iOS (Safari) and Android (Chrome) users on how to add the site to their home screen as a full-screen standalone app. Can be permanently dismissed via "Bir daha gösterme" (stored in `localStorage`).
- **📧 Account Recovery:** Users provide a recovery email at signup (and existing users are prompted via a once-per-day popup). This email is kept in sync with their Supabase Auth login email, so they can use the built-in **"Forgot Password"** flow to reset a forgotten password themselves — no admin intervention needed.
- **🔑 Self-Service Email Claim:** Users who haven't set a `recovery_email` yet can do so directly from the "Forgot Password" screen by entering their username + email — their Auth login email is updated immediately and a reset link is sent right away. Has no effect if a `recovery_email` is already set, to prevent account takeover.
- **🔐 In-App Password Change:** Logged-in users can set a new password at any time via the 🔒 button in the header — useful as a fallback if a password-reset email link signs the user in directly without showing the reset screen (a known quirk with some email clients' link scanners).
- **🤖 Automated Fixture & Score Sync:** A GitHub Actions workflow runs every 10 minutes, but first checks whether any match falls within a ±3-hour window before hitting the Football-Data.org API — skipping the external call entirely on match-free days. Already-locked matches are never overwritten.
- **🔄 Automated Recovery Email Sync:** A second GitHub Actions workflow runs every hour to copy any newly-set `profiles.recovery_email` values into `auth.users.email`, so password resets keep working even for users who set their recovery email via the popup instead of the claim flow.
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

### Tiebreaker Criteria

When points are equal, ranked by (in order):

1. EXACT SCORE count (more → higher)
2. CLOSE CALL count (more → higher)
3. STRATEGIST count (more → higher)
4. SAGE count (more → higher)
5. CONSOLATION count (more → higher)
6. Total predictions made (more → higher)
7. Username alphabetical order (Turkish locale)

---

## 🚀 Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React + Vite (inline CSS) |
| Backend & Database | Supabase (PostgreSQL + Row Level Security) |
| Automation | GitHub Actions + Node.js |
| Match Data | [Football-Data.org API v4](https://www.football-data.org/) |
| Deployment | Vercel |

---

## ⚙️ Setup

### 1. Environment Variables

Set the following in your Vercel project (**Settings → Environment Variables**) and in a local `.env` file for development:

| Variable | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase project URL (Dashboard → Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (Dashboard → Settings → API) |

For local development only (never commit these):

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Same Supabase URL — used by the email-sync script |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — used by the email-sync script |

### 2. GitHub Secrets

Add the following under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| :--- | :--- |
| `FOOTBALL_API_TOKEN` | Your Football-Data.org API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin-level writes) |

### 3. Database Setup (Supabase SQL Editor)

Run the files in `supabase/` in the following order:

| Order | File | What it does |
| :---: | :--- | :--- |
| 1 | `functions.sql` | Trigger functions (`update_updated_at`, `enforce_prediction_rules`) and RPC helpers (`get_login_email`, `claim_recovery_email`). Must run before schema.sql. |
| 2 | `schema.sql` | All tables: `matches`, `profiles`, `allowed_groups`, `predictions` (with triggers), `user_groups`. |
| 3 | `get_league_board.sql` | `get_league_board(group, cutoff)` RPC — server-side scoring for the League tab. |

All files use `create or replace`, so they're safe to re-run.

### 4. GitHub Actions Workflows

| Workflow | Schedule | What it does |
| :--- | :--- | :--- |
| `.github/workflows/sync_matches.yml` | Every 10 minutes + manual | Checks Supabase for any match within ±3 hours; exits early if none. Otherwise fetches fixtures and scores from Football-Data.org and upserts into `matches`. Skips already-locked matches. |
| `.github/workflows/sync_emails.yml` | Every hour + manual | Runs `scripts/sync-auth-emails.mjs` to copy any `profiles.recovery_email` into `auth.users.email`. Uses npm cache (~5 s/run). Requires Node.js 22. |

Both workflows can be triggered manually from the **Actions** tab via "Run workflow".

> **Secret name note:** The email-sync script reads `process.env.SUPABASE_URL` — make sure the GitHub secret is named exactly `SUPABASE_URL` (not `VITE_SUPABASE_URL`).

### 5. Recovery Email Sync

Originally every account used a generated `username@tahmin.com` address as its Supabase Auth email. Once a user's `profiles.recovery_email` is set, the hourly workflow copies it into `auth.users.email` so password resets reach the real inbox.

To run it manually:

```bash
npm run sync-emails
```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your local `.env`. The script skips users without a `recovery_email` and users whose Auth email is already up to date.

Also verify **Authentication → URL Configuration** in the Supabase dashboard has your app URL listed under **Redirect URLs** so password-reset links work correctly.

### 6. Install & Run

```bash
npm install
npm run dev
```

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────┐
│                GitHub Actions (Scheduled)                  │
│  • sync_matches (*/10): early-exit if no match in ±3h     │
│    → Football-Data.org → Supabase (locked matches skipped) │
│  • sync_emails  (hourly, npm-cached): recovery_email      │
│    → auth.users.email  (Node 22, ~5 s/run)                │
└─────────────────────────┬─────────────────────────────────┘
                          │
                   ┌──────▼──────┐
                   │   Supabase  │  PostgreSQL + RLS
                   │  (Database) │  get_league_board() RPC
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │    React    │  Vite — Deployed on Vercel
                   │  (Frontend) │
                   │             │  src/hooks/
                   │             │  ├─ useMatches  (data + realtime)
                   │             │  ├─ useGroups   (profile + leagues)
                   │             │  └─ (auth in App.jsx)
                   └─────────────┘
```

### Frontend structure

| File | Responsibility |
| :--- | :--- |
| `src/App.jsx` | Auth lifecycle, modal state, tab routing, UI layout |
| `src/hooks/useMatches.js` | `matches` state, `loadMatches()`, Supabase realtime subscription |
| `src/hooks/useGroups.js` | `profile`, `myPreds`, `myGroups`, `activeGroup`, `groupCutoffs` + their loaders |
| `src/lib/scoring.js` | `calcPoints()`, `isBettingOpen()`, date helpers |
| `src/components/LeagueTab.jsx` | League leaderboard — calls `get_league_board` RPC |
| `src/components/PredictTab.jsx` | Match prediction UI |
| `src/components/AdminPanel.jsx` | Match result entry (admin only) |

### Supabase files

| File | Contents |
| :--- | :--- |
| `supabase/schema.sql` | All table definitions and indexes |
| `supabase/functions.sql` | Trigger functions + `get_login_email` / `claim_recovery_email` RPCs |
| `supabase/get_league_board.sql` | `get_league_board(group, cutoff)` — server-side scoring RPC |

---

*Built for the love of football and the thrill of competition. May the best predictor win.* ⚽🔥
