# KochSchmiede 🍳

> Self-hosted, mobile-first recipe management platform — built with Next.js (PWA) + FastAPI + PostgreSQL.

---

## Features

- 📱 **Progressive Web App** — installable, offline support, camera import
- 🌗 **Dark / Light theme** with automatic logo switching
- 🌍 **i18n** — German (default) + English
- 📥 **Import recipes** from websites (URL scraping), PDFs, images (OCR), or camera
- 🔐 **JWT authentication** — self-hosted & multi-user
- 🗄️ **PostgreSQL** database with full recipe CRUD
- 🐳 **Docker Compose** — one command to run everything

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)

### Run

```bash
# Clone the repo
git clone https://github.com/TimUx/KochSchmiede.git
cd KochSchmiede

# Copy & edit environment variables
cp .env.example .env
# Edit .env and set strong POSTGRES_PASSWORD and SECRET_KEY

# Start all services
docker compose up -d
```

- **Frontend**: http://localhost:3000
- **API docs**: http://localhost:8000/api/docs

---

## Architecture

```
kochschmiede/
├── frontend/          # Next.js 15 App Router, TailwindCSS, PWA
├── backend/           # FastAPI + SQLAlchemy + PostgreSQL
├── public/assets/     # Logo assets (dark/light variants)
├── docker-compose.yml
└── .env.example
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, next-themes |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | PostgreSQL 16 |
| OCR | pytesseract + Pillow |
| Auth | JWT (python-jose + passlib/bcrypt) |
| Deploy | Docker Compose |

---

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

> Set `DATABASE_URL` in `backend/.env` when running locally.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — recipe overview + quick actions |
| `/recipes` | All recipes with search + category filter |
| `/recipes/[id]` | Recipe detail view |
| `/recipes/[id]/edit` | Recipe editor |
| `/recipes/new` | Create new recipe (with camera / upload) |
| `/import` | Import Center (URL / PDF+OCR / Camera) |
| `/settings` | Theme, language, account, export |
| `/offline` | Offline fallback page |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/recipes/` | List recipes |
| POST | `/api/recipes/` | Create recipe |
| GET | `/api/recipes/{id}` | Get recipe |
| PUT | `/api/recipes/{id}` | Update recipe |
| DELETE | `/api/recipes/{id}` | Delete recipe |
| GET | `/api/import/url?url=…` | Import from website |
| POST | `/api/import/file` | Import from PDF/image |
| POST | `/api/import/camera` | Import from camera photo |
| GET | `/api/health` | Health check |

---

## Color Palette

| Role | Color |
|------|-------|
| Dark background | `#1e1e2e` |
| Accent | `#f59e0b` (amber) |
| Fresh / success | `#22c55e` (green) |

---

## License

MIT
