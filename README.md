<div align="center">

# Smart Travel Assistant

AI-powered travel planning with an interactive flight dashboard, price trends, and a conversational assistant.

</div>

### Key Features
- 🤖 **AI Chat**: Context-aware assistant using OpenAI.
- ✈️ **Flights Dashboard**: Outbound/return options, price trends, and best-deal highlights.
- 🧭 **Intent Detection**: Extracts routes and dates from natural language.
- 🔌 **Real APIs**: Amadeus for live travel data; graceful mock fallback.
- 🎨 **Wayfinder UI**: Clean React UI with reusable components and CSS tokens.

### Tech Stack
- **Frontend**: React 18, React Router, Recharts
- **Backend**: FastAPI (Python 3.11+), OpenAI SDK, Amadeus API
- **Tooling**: PostCSS (build Figma tokens), Uvicorn, Firebase/Vercel friendly

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Amadeus credentials and an OpenAI API key

### Environment Variables
Create `.env` files (see `env.example`). Required keys:

Frontend (build-time via PostCSS if needed):
- none required for local UI

Backend (`backend/.env` or host env):
- `OPENAI_API_KEY`
- `AMADEUS_API_KEY`
- `AMADEUS_API_SECRET`
- Optional: `AMADEUS_API_BASE` (defaults to `https://api.amadeus.com`)

### Install
```bash
npm install
```

### Build design tokens (Figma -> CSS)
```bash
npm run css:build   # compiles figma_design/styles/globals.css -> src/styles/globals.css
```

### Run Frontend (React)
```bash
npm start
# open http://localhost:3000
```

### Run Backend (FastAPI)
```bash
python -m venv .venv && .venv/Scripts/activate  # Windows PowerShell
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
# health: http://localhost:8000/api/health
```

Tip (one-command CSS+build):
```bash
npm run build
```

---

## Project Structure
```text
src/
  components/
    dashboard/            # FlightDashboard, FlightMap, PriceChart, FlightsTable
    ui/                   # Card, Badge, Table, ScrollArea
  pages/                  # Home, Chat
  styles/                 # globals.css (tokens), site.css (layout utilities)
  App.js                  # Routes and dashboard wiring

backend/
  main.py                 # FastAPI app, /api/chat, diagnostics
  services/
    amadeus_service.py    # OAuth + Amadeus calls + formatting
    flight_formatter.py    # Normalize flights for dashboard
    intent_detector.py     # Intent parsing (message -> params)
    cache_manager.py       # Simple caching layer
```

---

## How It Works
- The React chat sends messages to `POST /api/chat` with optional context (time, tz, location).
- `intent_detector` extracts origin/destination/dates from free text.
- `amadeus_service` queries real flights and normalizes responses.
- `flight_formatter` converts offers to the dashboard schema (outbound, return, priceData).
- The frontend displays charts, tables, and badges; chat copy is post-processed for readability.

---

## API (Backend)
Base URL (local): `http://localhost:8000`

- `GET /api/health` – health check
- `POST /api/chat` – main chat + optional real data
  - body: `{ messages: [{role, content}], context?, session_id? }`
  - returns: `{ reply, dashboard_data, amadeus_data, ... }`

Diagnostics (useful during setup):
- `GET /api/diag/amadeus/location?keyword=Paris`
- `GET /api/diag/amadeus/flight?origin=JFK&destination=CDG&date=2025-12-01`
- `GET /api/diag/amadeus/flight-dates?origin=PAR&destination=TYO&start=2025-12-01&end=2026-01-01`
- `GET /api/diag/amadeus/token`
- `GET /api/diag/flight-raw?origin=JFK&destination=CDG&date=2024-12-10`

---

## Development Tips
- Build tokens during development: `npm run css:watch`
- If Amadeus returns errors or credentials are missing, the backend falls back to mock data so the dashboard still works.
- The chat response is post-processed to emphasize place names; verify formatting if changing copy rules.

---

## Deployment
- Frontend: static build (`npm run build`) can be hosted on Vercel, Netlify, Firebase Hosting, or GitHub Pages.
- Backend: suitable for Vercel Serverless, traditional VPS with Uvicorn, or any ASGI host.
- Configure production environment variables on your hosting platform (OpenAI + Amadeus).

Firebase and Vercel configuration files are included (`firebase.json`, `backend/vercel.json`).

---

## Troubleshooting
- Dashboard not showing: ensure your prompt includes flight-related keywords (e.g., “flight”, “price”, “tickets”).
- No flight results: confirm future dates and valid IATA codes or city names.
- CSS tokens missing: run `npm run css:build` before `npm start`.
- CORS: local dev allows `*`; tighten origins for production in `backend/main.py` as needed.

---

## License
MIT (or your preferred license)

---

Built with React, FastAPI, and modern web tooling.

Last Updated: October 2025
Version: 2.0.0