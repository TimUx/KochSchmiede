# KochSchmiede 🍳

> Self-hosted, mobile-first recipe management platform — built with Next.js (PWA) + FastAPI + PostgreSQL.

🇩🇪 **[Deutsche Version → README.md](README.md)**

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Table of Contents

1. [Features](#features)
2. [Screenshots](#screenshots)
3. [Feature Details](#feature-details)
4. [Import Center](#-import-center)
   - [Import Methods](#import-methods)
   - [AI Technologies](#ai-technologies)
   - [Smart Routing](#smart-routing--which-ai-for-which-recipe)
   - [Configuring AI](#configuring-ai)
5. [Quick Start](#quick-start)
6. [Architecture & Tech Stack](#architecture--tech-stack)
7. [Development](#development)
8. [Pages](#pages)
9. [API Endpoints](#api-endpoints)
10. [Colour Palette](#colour-palette)
11. [License](#license)

---

## Features

- 📱 **Progressive Web App** — installable on iOS/Android/Desktop, offline support, camera import
- 🌗 **Dark / Light theme** with automatic logo switching
- 🌍 **i18n** — German (default) + English
- 📥 **Import recipes** from websites (URL scraping), PDFs, images (OCR), or camera — including AI-powered recognition
- 🤖 **AI-powered import** — local (Ollama / LM Studio) or external (OpenAI / Google Gemini) with intelligent routing
- 🔐 **JWT authentication** — self-hosted & multi-user
- 🗄️ **PostgreSQL** database with full recipe CRUD
- 🐳 **Docker Compose** — one command to run everything
- ❤️ **Favourites** — mark your favourite recipes
- 🏷️ **Categories & tags** — filter and sort recipes
- 📤 **Export** — back up recipes as JSON
- 🖨️ **Print view** — printer-friendly recipe layout
- 🔗 **Share** — share recipes with others
- 🖼️ **HEIC/HEIF support** — import iPhone photos directly

---

## Screenshots

<table>
  <tr>
    <td align="center"><b>Dashboard</b></td>
    <td align="center"><b>All Recipes</b></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/a258f626-64e8-400a-90db-55160a440a37" width="300" alt="Dashboard" /></td>
    <td><img src="https://github.com/user-attachments/assets/ff66be36-cb8d-4acf-812d-de600aeecfbe" width="300" alt="All Recipes" /></td>
  </tr>
  <tr>
    <td align="center"><b>Recipe Detail</b></td>
    <td align="center"><b>Import Center</b></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/8e920f30-4903-499e-91f3-c4d8d36c6221" width="300" alt="Recipe Detail" /></td>
    <td><img src="https://github.com/user-attachments/assets/ddafbb46-abc0-4fe4-bb81-b3338c0dc6bc" width="300" alt="Import Center" /></td>
  </tr>
</table>

---

## Feature Details

### 📊 Dashboard
The dashboard shows an overview of recently added recipes with statistics (number of recipes, categories, favourites) and quick-action buttons for new recipes or imports.

### 📖 Recipe Management
- Full recipe list with search and category filter
- Detail view with ingredients, preparation steps, times, and servings
- Create, edit, and delete recipes
- Tags and categories for organisation
- Mark favourites

### ⚙️ Settings
- **Theme**: Toggle light/dark mode
- **Language**: Switch between German and English
- **Profile**: Manage name and avatar
- **Backup & Export**: Save recipes as JSON
- **Admin panel**: User management, registration, visibility control, and external AI configuration

---

## 📥 Import Center

The Import Center is the heart of KochSchmiede. It supports three fundamentally different import methods and combines multiple AI technologies to produce a structured recipe from almost any source.

### Import Methods

#### 1. 🌐 Website Import (URL)
Enter the URL of a recipe page — the built-in web scraper automatically extracts the title, ingredients, and preparation steps from the page's HTML (e.g. Chefkoch, Küchengötter, international recipe blogs). No AI required; works entirely without external services.

#### 2. 📄 File Import (PDF / Image)
Upload a PDF or photo — supported formats: **JPEG, PNG, WebP, TIFF, HEIC/HEIF** (iPhone photos) and **PDF**. Maximum file size is 20 MB. Depending on the document's quality and layout, the pipeline automatically selects the appropriate AI strategy (see [Smart Routing](#smart-routing--which-ai-for-which-recipe)).

#### 3. 📷 Camera Import
Photograph a recipe directly using the device camera and scan it immediately — especially handy on mobile devices. The photo is processed exactly like a regular file upload and goes through the same AI pipeline.

---

### AI Technologies

The import pipeline uses three independent AI layers, which are automatically combined based on the available configuration and document quality:

#### 🔤 Text LLM (language model)
Receives extracted text (from a PDF text layer or Tesseract OCR) and returns structured recipe data. Fast and resource-efficient.

- **Local via Ollama**: `llama3.2` (~2 GB) is downloaded automatically if no model is present.
- **Local via LM Studio**: Any OpenAI-compatible model — `LLM_MODEL` must be set manually.
- **OpenAI** (paid, external): `gpt-4.1`, `gpt-4o`, `gpt-4o-mini`, etc. — uses the Responses API with `json_schema` structured output for reliable extraction.
- **Google Gemini** (paid, external): `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`, etc. — uses the official `google-genai` SDK.

#### 👁️ Vision LLM (multimodal model)
Receives the image directly (bypassing OCR) and recognises layouts, handwriting, columns, and magazine designs far better than pure text recognition.

- **Local via Ollama**: `llava:7b` (~4.7 GB) is downloaded automatically.
- **OpenAI** (external): Full image analysis with `gpt-4o` / `gpt-4.1`.
- **Google Gemini** (external): Multimodal analysis with `gemini-1.5-flash` / `gemini-1.5-pro`.

#### 📐 Heuristic Parser (always available)
A rule-based parser without AI — analyses OCR text structurally: detects ingredient blocks, preparation steps, time details, servings, multi-column layouts, and filters out magazine noise (prices, advertisements, page numbers). Serves as a fallback when no AI is configured or available.

---

### Smart Routing — which AI for which recipe?

The import pipeline automatically evaluates every document and selects the fastest and most accurate strategy:

```
Input (PDF / image / camera photo)
        │
        ▼
 ┌──────────────────────────────────────────────────┐
 │ Is it a PDF with extractable text?               │
 └──────────────────────────────────────────────────┘
        │ Yes                         │ No
        ▼                             ▼
  Text LLM                      Tesseract OCR
  (fast)                        (text recognition)
        │                             │
        ▼                             ▼
  ┌─────────────────────────────────────────────────┐
  │ OCR quality score (0.0 – 1.0)                  │
  │  ≥ 0.60 → good quality (e.g. structured PDF)   │
  │  < 0.60 → poor quality (magazine, handwriting, │
  │            multi-column layout)                 │
  └─────────────────────────────────────────────────┘
        │ ≥ 0.60                      │ < 0.60
        ▼                             ▼
  Text LLM                     Vision LLM (raw image)
  (resource-efficient)          (highest quality)
        │                             │
        └──────────────┬──────────────┘
                       ▼
              Heuristic Parser
              (fallback, always active)
```

**Examples:**
| Document | OCR Score | Strategy |
|----------|-----------|----------|
| Structured PDF (e.g. Chefkoch export) | ≥ 0.77 | Text LLM directly |
| Chefkoch website screenshot | ≥ 0.60 | Text LLM |
| Magazine scan (multi-column, ads) | ≈ 0.54 | Vision LLM |
| Handwritten recipe | < 0.60 | Vision LLM |
| Camera photo (cookbook) | < 0.60 | Vision LLM |

If an AI step fails (e.g. Ollama unavailable, API error), the pipeline automatically falls back to the next available step and may include a warning in the import result.

---

### Configuring AI

#### Option A: Ollama (local, fully automatic — recommended)

```bash
# Start the stack including Ollama
docker compose --profile ollama up -d
```

In `.env`:
```env
LLM_BASE_URL=http://ollama:11434/v1
# Leave LLM_MODEL empty → automatic model selection
# Models are downloaded automatically on first import (OLLAMA_AUTO_PULL=true)
```

#### Option B: Ollama with a fixed model

```env
LLM_BASE_URL=http://ollama:11434/v1
LLM_MODEL=llama3.2:1b        # small text model for low-power hardware
# LLM_VISION=false           # disable vision entirely (saves resources)
```

#### Option C: LM Studio (local, desktop app)

1. Download [LM Studio](https://lmstudio.ai) and load a model
2. Start the local server in LM Studio
3. In `.env`:

```env
LLM_BASE_URL=http://host.docker.internal:1234/v1
LLM_MODEL=your-loaded-model   # must always be set (only one model at a time)
```

#### Option D: OpenAI (external, paid)

In the admin panel (`/admin`) under **External AI**:
- **Provider**: `openai`
- **API key**: OpenAI API key
- **Model**: e.g. `gpt-4o-mini` (budget-friendly) or `gpt-4o` / `gpt-4.1` (highest quality)

OpenAI is automatically used for all file and camera imports once an API key is configured. The key is stored encrypted in the database and never exposed in the frontend.

#### Option E: Google Gemini (external, paid)

In the admin panel (`/admin`) under **External AI**:
- **Provider**: `gemini`
- **API key**: Google AI Studio API key
- **Model**: e.g. `gemini-2.0-flash` (fast & affordable) or `gemini-1.5-pro` (highest quality)

#### Configuration Reference

| Setting | Description | Default |
|---------|-------------|---------|
| `LLM_BASE_URL` | URL of the local LLM server (Ollama / LM Studio) | empty (disabled) |
| `LLM_MODEL` | Model name — empty = auto-select from Ollama | empty (auto) |
| `LLM_VISION` | `true` = always use vision, `false` = never, empty = auto | empty (auto) |
| `LLM_API_KEY` | API key for local LLM server (usually empty) | empty |
| `AI_TIMEOUT` | Timeout per AI request in seconds | `300` |
| `OLLAMA_AUTO_PULL` | Automatically download models | `true` |
| Admin → External AI | OpenAI / Gemini provider, key, model | — |

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

# Optional: start with local Ollama LLM
docker compose --profile ollama up -d
```

- **Frontend**: http://localhost:3000
- **API docs**: http://localhost:8000/api/docs

> **SECRET_KEY** is required. Generate a secure key:
> ```bash
> openssl rand -hex 32
> ```

---

## Architecture & Tech Stack

```
kochschmiede/
├── frontend/          # Next.js 15 App Router, TailwindCSS, PWA
├── backend/           # FastAPI + SQLAlchemy + PostgreSQL
│   └── app/
│       ├── api/       # REST endpoints (auth, recipes, import, settings)
│       ├── services/  # OCR, AI parsers, scraper, external AI
│       └── models/    # SQLAlchemy database models
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
| OCR | Tesseract (pytesseract) + Pillow + PyMuPDF |
| Image formats | JPEG, PNG, WebP, TIFF, HEIC/HEIF (pillow-heif) |
| Local AI | Ollama (llama3.2 + llava:7b), LM Studio, OpenAI protocol |
| External AI | OpenAI Responses API (`openai>=1.58.0`), Google Gemini (`google-genai>=1.10.0`) |
| Authentication | JWT (python-jose + passlib/bcrypt) |
| Web scraping | BeautifulSoup4 + lxml + requests |
| Deployment | Docker Compose |

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

> Set `DATABASE_URL` in `backend/.env` when running locally without Docker.

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
| `/admin` | Admin panel (users, registration, external AI) |
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
| GET | `/api/settings` | Read site settings |
| PUT | `/api/settings` | Update site settings (admin) |
| GET | `/api/health` | Health check |

---

## Colour Palette

| Role | Colour |
|------|--------|
| Dark background | `#1e1e2e` |
| Accent | `#f59e0b` (amber) |
| Fresh / success | `#22c55e` (green) |

---

## License

MIT
