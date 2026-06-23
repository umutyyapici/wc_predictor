# 🏆 WC Prediction League 2026

> A full-stack World Cup match score prediction game for friend groups — with group-based leaderboards, a daily joker system, player profiles, automated fixture/score syncing, and an experimental alternative scoring tab for admins.

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
- **🏆 League Tab:** Shows the ranked standings for the active group. Clicking any player opens a **Player Profile Modal** with their full stats (exact scores, close calls, strategist, sage, consolation counts, joker usage) and a paginated list of their predictions (5 per page, newest first).
- **🕒 Group-Scoped Scoring:** A group's leaderboard and each member's total only count matches that kicked off after that group's invite code was created (`allowed_groups.created_at`) — a fair starting line for groups formed mid-tournament. Earlier matches are still shown in the Predict tab, marked as "grup öncesi" (before group) and excluded from totals.
- **👀 View Others' Predictions:** Once a match is locked or the betting window closes, all predictions from the same group become visible. The "Others" panel filters by the active group, so switching groups shows the correct set of predictions.
- **🧪 Deneme (Experimental) Leaderboard (Admin only):** A third tab visible only to admins runs an alternative scoring system alongside the standard one. It uses higher base points and adds a **NADİR İSABET (Rare Hit) ⚡ bonus**: if a player correctly predicts the exact score and ≤10% of the group predicted the same scoreline, they earn +2 extra points. The tab also shows the difference between a player's Deneme score and their standard score, making it easy to see who benefits most from the new system.
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

---

## 🧪 Deneme (Experimental) Scoring — Admin Tab

The **Deneme** tab is visible only to admins and runs an alternative scoring system in parallel with the standard one. It uses higher base points and introduces a **Rare Hit bonus** for correctly predicting an unusual scoreline.

### Points Table

| Category | Description | Base Points |
| :--- | :--- | :---: |
| **TAM İSABET 🔥** | Correct result + exact scoreline | **8** |
| **KIL PAYI 🎯** | Correct result + one team's goal count correct | **4** |
| **STRATEJİST ↔️** | Correct result + correct goal difference | **4** |
| **BİLGE 🔮** | Correct result (1/X/2) only | **2** |
| **TESELLİ ⚽** | Wrong result but one team's goal count correct | **1** |
| **NADİR İSABET ⚡ bonus** | Exact score AND ≤10% of the group predicted the same scoreline | **+2** |
| **JOKER 🃏** | Doubles the total score (base + any bonus) for that match | **×2** |

Components **stack**: a correct exact-score prediction with NADİR İSABET starts at 8 + 2 = 10 pts (×2 with Joker → 20).

Each row in the leaderboard also shows the **difference** between a player's Deneme score and their standard score (`+N` / `-N`), so it's easy to see who gains or loses under the new system.

### Tiebreakers

When Deneme points are equal, ranked by (in order):

1. NADİR İSABET count (more → higher)
2. TAM İSABET count (more → higher)
3. KIL PAYI + STRATEJİST combined count (more → higher)
4. BİLGE count (more → higher)
5. TESELLİ count (more → higher)
6. Total predictions made (more → higher)
7. Username alphabetical order (Turkish locale)

---

## ⚖️ Tiebreaker Criteria

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

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_INVITE_CODE=your_invite_code

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

**Additionally**, run `supabase/get_league_board.sql` to create the leaderboard RPC function used by the League tab:

```
Supabase Dashboard → SQL Editor → paste & run supabase/get_league_board.sql
```

This creates the `get_league_board(group, cutoff)` function that calculates all player scores, categories, and prediction details server-side instead of in the browser. It mirrors the scoring logic in `src/lib/scoring.js` exactly. Without this function the League tab will show an error.

### 4. GitHub Actions Workflows

| Workflow | Schedule | What it does |
| :--- | :--- | :--- |
| `.github/workflows/sync_matches.yml` | Every 10 minutes (`*/10 * * * *`) + manual | First checks Supabase for any match within ±3 hours; exits early (no Football-Data.org API call) if none are found. Otherwise fetches fixtures and scores and upserts them into the `matches` table. Skips matches already locked with a final score. |
| `.github/workflows/sync_emails.yml` | Every hour (`0 * * * *`) + manual | Runs `scripts/sync-auth-emails.mjs` to copy any `profiles.recovery_email` into `auth.users.email` for accounts that haven't been migrated yet. Uses npm cache so cold starts take ~5 s instead of ~45 s. Requires Node.js 22 (native WebSocket). |
All workflows can also be triggered manually from the **Actions** tab via "Run workflow" (`workflow_dispatch`).

> **`sync_emails.yml` secret note:** The script reads `process.env.SUPABASE_URL`, so the workflow injects it as `SUPABASE_URL` (not `VITE_SUPABASE_URL`). Make sure the GitHub secret is named exactly `SUPABASE_URL`.

### 5. Recovery Email Sync (Background Job)

Originally every account used a generated `username@tahmin.com` address as its Supabase Auth email, so Supabase's built-in "forgot password" emails couldn't reach real users. Once a user's `profiles.recovery_email` is set (via the recovery popup, signup, or the "Forgot Password" claim flow), the `sync_emails.yml` workflow copies it into `auth.users.email` within an hour.

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
| `src/App.jsx` | Auth lifecycle, modal state, UI layout |
| `src/hooks/useMatches.js` | `matches` state, `loadMatches()`, Supabase realtime subscription |
| `src/hooks/useGroups.js` | `profile`, `myPreds`, `myGroups`, `activeGroup`, `groupCutoffs` + their loaders |
| `src/lib/scoring.js` | `calcPoints()`, `isBettingOpen()`, date helpers |
| `src/components/` | Tab components, modals, auth screens |

---

*Built for the love of football and the thrill of competition. May the best predictor win.* ⚽🔥
