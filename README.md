# 🏆 WC Prediction League 2026

> A full-stack World Cup match score prediction game for friend groups — with group-based leaderboards, a daily joker system, player profiles, automated fixture/score syncing, and an odds-based logarithmic scoring leaderboard.

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
- **📊 Odds-Based Leaderboard (Admin only):** A third tab visible only to admins shows a logarithmic scoring leaderboard for matches from 24 June 2026 onward. Pre-match odds are fetched daily from oddspapi.io at 12:00 TRT and stored in Supabase. Admins can also enter decimal odds manually for matches the API doesn't cover. Joker doubles the logarithmic score, same as the standard scoring system.
- **📲 Install Guide (PWA):** A one-time popup guides iOS (Safari) and Android (Chrome) users on how to add the site to their home screen as a full-screen standalone app. Can be permanently dismissed via "Bir daha gösterme" (stored in `localStorage`).
- **📧 Account Recovery:** Users provide a recovery email at signup (and existing users are prompted via a once-per-day popup). This email is kept in sync with their Supabase Auth login email, so they can use the built-in **"Forgot Password"** flow to reset a forgotten password themselves — no admin intervention needed.
- **🔑 Self-Service Email Claim:** Users who haven't set a `recovery_email` yet can do so directly from the "Forgot Password" screen by entering their username + email — their Auth login email is updated immediately and a reset link is sent right away. Has no effect if a `recovery_email` is already set, to prevent account takeover.
- **🔐 In-App Password Change:** Logged-in users can set a new password at any time via the 🔒 button in the header — useful as a fallback if a password-reset email link signs the user in directly without showing the reset screen (a known quirk with some email clients' link scanners).
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

## 📊 Odds-Based Scoring (Admin Tab)

The **Odds** tab uses a logarithmic scoring rule that rewards predictions for surprising outcomes more than easy-to-guess ones. It only counts matches from 24 June 2026 (00:00 TRT) onward.

### Formula

```
score = K_sonuc × log₂(1/p_sonuc)   if result correct
      + K_fark  × log₂(1/p_fark)    if goal difference correct
      + K_skor  × log₂(1/p_skor)    if exact score correct
```

These components **stack**: an exact-score prediction earns all three.

### Multipliers

| Component | K | Typical score range |
| :--- | :---: | :---: |
| Correct result (1/X/2) | **5** | 4 – 7 pts |
| Correct goal difference | **10** | 10 – 20 pts |
| Correct exact score | **20** | 40 – 80 pts |

A correctly predicted surprise (e.g. 3-2 in a closely-contested match) earns up to ~100 pts. **Joker doubles the total score** for that match.

### Probability Source

- **h2h odds (1×2):** fetched from oddspapi.io daily. Vig is removed (normalize: `p = (1/odd) / Σ(1/odds)`).
- **Exact score (`p_skor`):** if oddspapi provides correct-score market odds, `p = 1 / odds`. Otherwise falls back to a Poisson model fitted to h2h + totals.
- **Goal difference (`p_fark`):** Poisson model.

### Tiebreakers

When odds-tab points are equal, ranked by (in order): total → exact score count → goal difference count → result count → prediction count → username (Turkish locale).

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
| Odds Data | [oddspapi.io](https://oddspapi.io) (250 req/month) |
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

For automated fixture/score syncing, recovery email syncing, and odds syncing, add the following under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| :--- | :--- |
| `FOOTBALL_API_TOKEN` | Your Football-Data.org API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin-level writes) |
| `ODDSPAPI_KEY` | Your oddspapi.io API key (odds-based leaderboard) |

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

**Additionally**, create the `match_odds` table for the odds-based leaderboard:

```sql
CREATE TABLE IF NOT EXISTS match_odds (
  match_id       int     PRIMARY KEY REFERENCES matches(id),
  h2h_home       numeric,
  h2h_draw       numeric,
  h2h_away       numeric,
  totals_line    numeric,
  correct_scores jsonb,           -- { "1-0": 7.5, "0-0": 12.0, ... } from API
  is_manual      boolean DEFAULT false,
  api_event_id   text,
  fetched_at     timestamptz DEFAULT now()
);

ALTER TABLE match_odds ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for score display)
CREATE POLICY "select_all" ON match_odds FOR SELECT USING (true);

-- Authenticated users can write (admin check is enforced in the UI)
CREATE POLICY "write_authenticated" ON match_odds
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

If you previously created `match_odds` without `correct_scores` / `is_manual`, add them:

```sql
ALTER TABLE match_odds ADD COLUMN IF NOT EXISTS correct_scores jsonb;
ALTER TABLE match_odds ADD COLUMN IF NOT EXISTS is_manual boolean DEFAULT false;
```

### 4. GitHub Actions Workflows

| Workflow | Schedule | What it does |
| :--- | :--- | :--- |
| `.github/workflows/sync_matches.yml` | Every 10 minutes (`*/10 * * * *`) + manual | First checks Supabase for any match within ±3 hours; exits early (no Football-Data.org API call) if none are found. Otherwise fetches fixtures and scores and upserts them into the `matches` table. Skips matches already locked with a final score. |
| `.github/workflows/sync_emails.yml` | Every hour (`0 * * * *`) + manual | Runs `scripts/sync-auth-emails.mjs` to copy any `profiles.recovery_email` into `auth.users.email` for accounts that haven't been migrated yet. Uses npm cache so cold starts take ~5 s instead of ~45 s. Requires Node.js 22 (native WebSocket). |
| `.github/workflows/sync_odds.yml` | Daily at 09:00 UTC / 12:00 TRT (`0 9 * * *`) + manual | Fetches pre-match 1×2 (and correct score if available) odds from oddspapi.io for upcoming WC matches and upserts them into the `match_odds` table. Skips matches that have already started (preserving the pre-match snapshot). Uses ~30 API requests/month. |

All workflows can also be triggered manually from the **Actions** tab via "Run workflow" (`workflow_dispatch`).

> **First run tip for `sync_odds.yml`:** On the first manual trigger, check the workflow logs. It prints all available tournament IDs and market IDs discovered from the API response. If FIFA WC 2026 isn't found automatically, look in the logs for the correct tournament name and update the matching logic in the workflow file. It also logs market IDs and their outcome counts so you can verify which market contains correct-score odds (typically the one with 15+ outcomes).

> **`sync_emails.yml` secret note:** The script reads `process.env.SUPABASE_URL`, so the workflow injects it as `SUPABASE_URL` (not `VITE_SUPABASE_URL`). Make sure the GitHub secret is named exactly `SUPABASE_URL`.

### 5. Admin: Manual Odds Entry

For matches where the API has no odds (e.g. early group stage games, or if the daily sync missed a match), the admin can enter decimal odds directly:

1. Log in as admin → click the ⚙️ gear icon to open Admin Panel
2. Scroll to the **🎯 Odds Girişi** section
3. Enter decimal odds for each team (home / draw / away), e.g. `1.85 / 3.50 / 4.20`
4. Click **Kaydet** — the odds are saved with `is_manual = true` so the daily sync won't overwrite them if they were set before the API was available

> Decimal odds: a value of `1.85` means "bet 1, receive 1.85 total back." All three values must be greater than 1.0.

### 6. Recovery Email Sync (Background Job)

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

### 7. Install & Run

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
│  • sync_odds  (daily 09:00 UTC): oddspapi.io              │
│    → match_odds (pre-match snapshot, ~30 req/month)        │
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
