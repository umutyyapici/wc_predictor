# 🏆 WC Prediction League 2026

> A full-stack World Cup match score prediction game for friend groups — with group-based leaderboards, a daily joker system, and automated fixture/score syncing.

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=github-actions&logoColor=white)

---

## ✨ Features

- **🔒 Automatic Betting Lock:** Predictions are locked 1 hour before kick-off. No backdating or last-minute changes allowed.
- **🃏 Daily Joker:** Each user gets one Joker per day. Apply it to any match to double your points for that game.
- **👥 Group-Based Leaderboards:** Users join their friend group via an invite code at registration. Each group has its own separate standings.
- **👀 View Others' Predictions:** Once a match is locked or the betting window closes, all predictions from the same group become visible.
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
```

### 2. GitHub Secrets

For automated score syncing, add the following under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| :--- | :--- |
| `FOOTBALL_API_TOKEN` | Your Football-Data.org API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin-level writes) |

### 3. Install & Run

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
