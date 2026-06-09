# 🏆 World Cup Predictor

> A full-stack prediction game for friend groups to compete on World Cup match scores — with automated fixture syncing, a joker system, and room-based leaderboards.

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=github-actions&logoColor=white)

---

## ✨ Features

- **🔒 Smart Time Lock (Fair Play):** Predictions are automatically locked when a match kicks off. No backdating, no cheating — the window closes the moment the whistle blows.
- **🔮 Daily Joker:** Each user gets one Joker per day. Apply it to any match and **double your points** if you get it right.
- **👥 Room-Based Leaderboards:** Users join their friend group's private room via an invite code at registration (e.g. `crystal26`, `thyme26`). Every room has its own live standings.
- **🤖 Automated Fixture & Score Sync:** A scheduled GitHub Actions workflow fetches live fixtures and final scores from the Football-Data.org API and writes them directly to the database — no manual updates needed.
- **🛡️ Data Protection Shield:** The automation pipeline skips already-locked matches, preventing accidental overwrites or wasted API quota.

---

## 🎯 Scoring System

Three tiers of reward keep every match meaningful, even when you miss the exact score:

| Outcome | Description | Points |
| :--- | :--- | :---: |
| **Exact Score** | Correct scoreline down to the goal (e.g. Match: 2–1 / Prediction: 2–1) | **+6** |
| **Correct Margin** | Right result and goal difference, wrong goals (e.g. Match: 3–1 / Prediction: 2–0) | **+4** |
| **Correct Result** | Right winner or draw, but scoreline missed (e.g. Match: 2–1 / Prediction: 1–0) | **+3** |

> 🃏 **Joker Bonus:** All points are **doubled** when you use your Joker on that match — up to **+12** for an exact score.

---

## 🚀 Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React + Vite + Tailwind CSS |
| Backend & Database | Supabase (PostgreSQL + Row Level Security) |
| Automation | GitHub Actions + Node.js scripts |
| Data Provider | [Football-Data.org API v4](https://www.football-data.org/) |

---

## ⚙️ Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. GitHub Secrets

For the automated score-sync workflow to run, add the following secrets under **Settings → Secrets and variables → Actions** in your repository:

| Secret | Description |
| :--- | :--- |
| `FOOTBALL_API_TOKEN` | Your Football-Data.org API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (used for admin-level writes) |

### 3. Install & Run

```bash
npm install
npm run dev
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│              GitHub Actions (Cron)          │
│   Fetches fixtures & scores from API        │
│   → Writes to Supabase (skips locked rows)  │
└────────────────────┬────────────────────────┘
                     │
              ┌──────▼──────┐
              │   Supabase  │  PostgreSQL + RLS
              │  (Database) │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │    React    │  Vite + Tailwind
              │  (Frontend) │  Room leaderboards
              └─────────────┘
```

---

## 📄 License

MIT — feel free to fork and run your own tournament.

---

*Built for the love of football and the thrill of competition. May the best predictor win.* ⚽🔥
