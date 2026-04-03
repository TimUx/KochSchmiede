# KochSchmiede – Admin Guide 🛠️

> Complete guide for installation, configuration, and management of KochSchmiede — covering both Docker-level setup and the in-app Admin Interface.

🇩🇪 **[Deutsche Version → ADMIN.md](ADMIN.md)**

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation with Docker Compose](#2-installation-with-docker-compose)
3. [Environment Variables & Configuration](#3-environment-variables--configuration)
4. [AI-Powered Recipe Recognition (Ollama / LM Studio / OpenAI / Gemini)](#4-ai-powered-recipe-recognition)
5. [First Start & Initial Setup](#5-first-start--initial-setup)
6. [Admin Interface in the Browser](#6-admin-interface-in-the-browser)
   - [Settings (Site Configuration)](#61-settings)
   - [User Management](#62-user-management)
   - [Unit Management](#63-unit-management)
7. [Reverse Proxy Setup (Nginx / Traefik)](#7-reverse-proxy-setup)
8. [Backup & Restore](#8-backup--restore)
9. [Logs & Debugging](#9-logs--debugging)
10. [Updates](#10-updates)
11. [Troubleshooting (FAQ)](#11-troubleshooting-faq)

---

## 1. Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Docker | 24.0+ | [docker.com/get-docker](https://docs.docker.com/get-docker/) |
| Docker Compose | 2.20+ | Included in Docker Desktop 4.x+ |
| RAM | 512 MB | Without AI. With Ollama: 8 GB recommended |
| Disk Space | 2 GB | Without Ollama models. With models: +7–15 GB |
| OS | Linux, macOS, Windows (WSL2) | |

---

## 2. Installation with Docker Compose

### 2.1 Clone the Repository

```bash
git clone https://github.com/TimUx/KochSchmiede.git
cd KochSchmiede
```

### 2.2 Create the Environment File

```bash
cp .env.example .env
```

Open `.env` in a text editor and set at least these two required fields:

```env
# Secure database password
POSTGRES_PASSWORD=your_secure_password

# JWT secret key — REQUIRED
# Generate with: openssl rand -hex 32
SECRET_KEY=your_very_long_secret_key
```

> ⚠️ **Security warning**: Never use the default values from `.env.example` in production. `SECRET_KEY` must be at least 32 characters long.

### 2.3 Start the Services

**Without AI support (heuristic parser only):**
```bash
docker compose up -d
```

**With local Ollama LLM (recommended for AI-powered imports):**
```bash
docker compose --profile ollama up -d
```

### 2.4 Services After Startup

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | User interface |
| Backend API | http://localhost:8000 | REST API |
| API documentation | http://localhost:8000/api/docs | Interactive Swagger UI |
| Ollama (optional) | http://localhost:11434 | Local LLM server |

### 2.5 Stopping and Restarting

```bash
# Stop (data is preserved)
docker compose down

# Stop and delete all data (⚠️ irreversible!)
docker compose down -v

# Restart a single service
docker compose restart backend
```

### 2.6 Docker Compose Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker network: kochschmiede               │
│                                                               │
│  ┌───────────┐    ┌───────────┐    ┌───────────────────┐    │
│  │ frontend  │───▶│  backend  │───▶│    postgres:16    │    │
│  │ Next.js   │    │  FastAPI  │    │    PostgreSQL      │    │
│  │ Port 3000 │    │ Port 8000 │    │    Port 5432       │    │
│  └───────────┘    └─────┬─────┘    └───────────────────┘    │
│                          │                                    │
│                    ┌─────▼─────┐                             │
│                    │  ollama   │  (optional, profile)        │
│                    │ Port 11434│                             │
│                    └───────────┘                             │
│                                                               │
│  Volumes: postgres_data  uploads_data  ollama_data           │
└─────────────────────────────────────────────────────────────┘
```

**Volumes and their contents:**

| Volume | Contents | Container path |
|--------|----------|---------------|
| `postgres_data` | All recipes, users, settings | `/var/lib/postgresql/data` |
| `uploads_data` | Uploaded images & logos | `/app/uploads` |
| `ollama_data` | AI models (llama3.2, llava:7b …) | `/root/.ollama` |

---

## 3. Environment Variables & Configuration

All variables are set in the `.env` file in the project root.

### 3.1 Required Fields

| Variable | Example | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `MySecurePassword123` | Database password. Must be set before the first start. |
| `SECRET_KEY` | _(output of `openssl rand -hex 32`)_ | JWT secret key. At least 32 characters. Never change while users are logged in. |

### 3.2 Network & Domain

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | Hostname where the frontend is reachable (e.g. `kochschmiede.example.com`). Used for CORS. |
| `PORT` | `3000` | Public port of the frontend (e.g. `80` behind a reverse proxy). |

**Example behind a reverse proxy:**
```env
DOMAIN=kochschmiede.example.com
PORT=443
```

### 3.3 AI Configuration (local / free)

See [Chapter 4](#4-ai-powered-recipe-recognition) for detailed instructions.

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | _(empty)_ | Base URL of the local LLM server (OpenAI-compatible). E.g. `http://ollama:11434/v1` |
| `LLM_MODEL` | _(empty)_ | Model name. Empty = automatic selection from Ollama. |
| `LLM_API_KEY` | _(empty)_ | API key for the local LLM (not needed for Ollama). |
| `LLM_VISION` | _(empty)_ | `true` = always force vision. `false` = text LLM only. Empty = automatic. |
| `AI_ENDPOINT` | _(empty)_ | Legacy: Ollama `/api/generate` endpoint (e.g. `http://ollama:11434`). |
| `AI_MODEL` | `llama3.2` | Legacy: model name for the legacy endpoint. |
| `AI_TIMEOUT` | `300` | Seconds per LLM request. Increase on CPU-only hardware (e.g. `600`). |
| `OLLAMA_AUTO_PULL` | `true` | Auto-download models on first import. `false` = manual management. |

### 3.4 Complete `.env` Example (Production)

```env
# === Required ===
POSTGRES_PASSWORD=LongRandomPassword!42
SECRET_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

# === Domain (behind reverse proxy) ===
DOMAIN=kochschmiede.example.com
PORT=443

# === Ollama AI (local, free) ===
LLM_BASE_URL=http://ollama:11434/v1
# LLM_MODEL=llama3.2    # leave empty for automatic selection
OLLAMA_AUTO_PULL=true
AI_TIMEOUT=300
```

---

## 4. AI-Powered Recipe Recognition

KochSchmiede uses a multi-stage import pipeline:

```
Vision AI → Text AI → Heuristic Parser (always available as fallback)
```

The OCR quality score determines which stage is used:
- **Structured PDF / good quality** → text LLM
- **Magazine / handwriting / poor OCR** → vision LLM
- **No LLM configured** → heuristic parser

### 4.1 Option A: Ollama (recommended — fully local & free)

```bash
# Start the stack with Ollama
docker compose --profile ollama up -d
```

Set in `.env`:
```env
LLM_BASE_URL=http://ollama:11434/v1
OLLAMA_AUTO_PULL=true
```

On first import, these models are downloaded automatically:
- `llama3.2` (~2 GB) — text model
- `llava:7b` (~4.7 GB) — vision model

**Managing models manually:**
```bash
# List available models
docker compose exec ollama ollama list

# Pull a model manually
docker compose exec ollama ollama pull llama3.2
docker compose exec ollama ollama pull llava:7b

# Remove a model (free up disk space)
docker compose exec ollama ollama rm llava:7b
```

**On low-end hardware (little RAM/CPU):**
```env
LLM_BASE_URL=http://ollama:11434/v1
LLM_MODEL=llama3.2:1b    # Smallest model (~600 MB)
LLM_VISION=false          # Disable vision
AI_TIMEOUT=600            # Longer timeout
```

**GPU support for Ollama:**
Add the following to the `ollama` service in `docker-compose.yml`:
```yaml
ollama:
  # ... existing config ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### 4.2 Option B: LM Studio (desktop app, local, free)

1. [Download LM Studio](https://lmstudio.ai)
2. Load a model (e.g. `llava:7b` for vision)
3. Start the local server in LM Studio
4. Set in `.env`:

```env
LLM_BASE_URL=http://host.docker.internal:1234/v1
LLM_MODEL=your-loaded-model    # Must match the model name in LM Studio exactly
```

> **Note**: LM Studio only loads one model at a time. `LLM_MODEL` must always be set explicitly.

### 4.3 Option C: External AI (OpenAI / Google Gemini)

External AI providers are configured in the **Admin Interface** (not in `.env`). See [Section 6.1](#61-settings).

**When external AI makes sense:**
- No local hardware available for Ollama
- Better recognition quality for complex layouts
- Faster processing desired

**Approximate costs:**
- OpenAI gpt-4o-mini: ~$0.001–0.003 per recipe
- Google Gemini Flash: ~$0.0001–0.001 per recipe

---

## 5. First Start & Initial Setup

### 5.1 Open the Application

After `docker compose up -d` and the container health checks pass:

```
http://localhost:3000
```

### 5.2 Create the First Admin Account

On the first visit, registration is open. The **first registered user** automatically receives admin rights.

1. Navigate to **http://localhost:3000**
2. Click **"Register"**
3. Enter username, email, and password
4. After registration you are automatically logged in as admin

> ⚠️ **Important**: Right after the first login, close registration in the Admin Interface if you don't want other users to self-register (Settings → User Registration → "Admin Only").

### 5.3 Open the Admin Interface

1. Navigate to **Settings** (⚙️ icon in the navigation)
2. Scroll to the **"Admin Area"** section
3. Click **"Go to Admin Area"**

Or directly: **http://localhost:3000/admin**

---

## 6. Admin Interface in the Browser

The Admin Interface is available at `/admin` and is split into three tabs:

### 6.1 Settings

#### Site Visibility

| Mode | Description |
|------|-------------|
| **Private** (default) | Only logged-in users can see recipes. Shared recipes require a password. |
| **Public** | All recipes are visible without login. Useful for public cooking blogs. |

#### User Registration

| Mode | Description |
|------|-------------|
| **Open** (default) | Anyone can self-register. |
| **Admin Only** | New accounts can only be created by admins. Recommended for closed household setups. |

#### SSRF Protection

SSRF (Server-Side Request Forgery) protection prevents the URL importer from reaching internal network addresses (e.g. `192.168.x.x`, `10.x.x.x`).

| Setting | Recommendation |
|---------|---------------|
| **Enabled** (default) | For installations accessible from the internet. |
| **Disabled** | Only for purely private home-server installations where you want to import recipes from local web servers. |

> ⚠️ **Security warning**: Only disable SSRF protection if the instance is not reachable from the internet.

#### Logos & Icons

Here you can customise the visual identity of the application:

| Slot | Description | Recommended size |
|------|-------------|-----------------|
| **Logo (Light)** | Displayed in the navigation in light theme | 200 × 50 px |
| **Logo (Dark)** | Displayed in the navigation in dark theme | 200 × 50 px |
| **Favicon** | Browser tab icon | 32 × 32 px or 64 × 64 px |
| **App Icon** | Used when installed as a PWA | 512 × 512 px |

**Supported formats**: PNG, JPEG, WEBP, GIF  
**Maximum file size**: 5 MB per image

**Reset logos**: Click the trash icon next to an image to restore the default logo.

#### External AI Configuration (OpenAI / Gemini)

Here you configure optional external AI services for recipe recognition.

**Step-by-step (OpenAI):**
1. Select **"OpenAI"** as the provider
2. Choose a model (recommended: **gpt-4o-mini** for good price-to-quality ratio)
3. Enter your **OpenAI API key** (from [platform.openai.com](https://platform.openai.com/api-keys))
4. Click **"Save"**

**Step-by-step (Google Gemini):**
1. Select **"Google Gemini"** as the provider
2. Choose a model (recommended: **gemini-2.0-flash** — free in the free tier)
3. Enter your **Gemini API key** (from [aistudio.google.com](https://aistudio.google.com))
4. Click **"Save"**

**Model overview:**

| Provider | Model | Characteristics |
|----------|-------|----------------|
| OpenAI | gpt-4o | Highest quality, higher cost |
| OpenAI | gpt-4o-mini | Good quality, cheaper |
| OpenAI | gpt-3.5-turbo | Fast, cheap, simple recipes |
| Gemini | gemini-2.5-flash | Very fast, free in free tier |
| Gemini | gemini-2.5-pro | Highest quality for Gemini |
| Gemini | gemini-2.0-flash | Fast, free |

> **Note**: The API key is stored securely in the database and is never shown in the interface. After saving, only a ✅ indicator is displayed.

**Remove external AI**: Select **"(none)"** as the provider and save.

**Import pipeline priority**: External AI → Local AI (Ollama) → Heuristic Parser.

---

### 6.2 User Management

#### Create a New User

1. Navigate to the **"Users"** tab
2. Fill in the form:
   - **Username**: Unique login name
   - **Email**: Required for account management
   - **Password**: Set a secure password
3. Click **"Create User"**

> The new user can log in immediately. An admin cannot directly change another user's password — the user must do this themselves in their own settings.

#### Manage Users

| Action | Icon | Description |
|--------|------|-------------|
| **Toggle admin status** | 👑 | Grants or revokes admin rights. Cannot be applied to yourself. |
| **Delete user** | 🗑️ | Permanently deletes the account. The user's recipes are retained. Cannot be applied to yourself. |

**Note**: At least one admin must always exist. The system prevents an admin from revoking their own admin status or deleting their own account.

---

### 6.3 Unit Management

This tab manages measurement units for ingredients (e.g. "bag", "dash", "pinch").

#### Add a New Unit

1. Enter the unit name in the input field
2. Click **"Add"**

#### Rename a Unit

1. Click the pencil icon next to the unit
2. Change the name
3. Click **"Save"** or press Enter

#### Delete a Unit

1. Click the trash icon
2. Confirm the deletion

> **Note**: Deleting a unit only removes it from the selection list. Ingredient quantities already used in recipes are not affected.

---

## 7. Reverse Proxy Setup

### 7.1 Nginx (Standard HTTP/HTTPS)

Create an Nginx configuration file:

```nginx
server {
    listen 80;
    server_name kochschmiede.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name kochschmiede.example.com;

    ssl_certificate     /etc/letsencrypt/live/kochschmiede.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kochschmiede.example.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API (for direct external API access)
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;  # For image uploads
    }
}
```

Set in `.env`:
```env
DOMAIN=kochschmiede.example.com
PORT=443
```

### 7.2 Traefik (Docker Labels)

```yaml
# Add to docker-compose.yml:
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.kochschmiede.rule=Host(`kochschmiede.example.com`)"
      - "traefik.http.routers.kochschmiede.entrypoints=websecure"
      - "traefik.http.routers.kochschmiede.tls.certresolver=letsencrypt"
      - "traefik.http.services.kochschmiede.loadbalancer.server.port=3000"
```

---

## 8. Backup & Restore

### 8.1 Back Up the Database (PostgreSQL Dump)

```bash
# Create a backup
docker compose exec postgres pg_dump -U kochschmiede kochschmiede > backup_$(date +%Y%m%d_%H%M%S).sql

# Create a compressed backup
docker compose exec postgres pg_dump -U kochschmiede kochschmiede | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 8.2 Restore the Database

```bash
# Restore from SQL file
cat backup_20240101_120000.sql | docker compose exec -T postgres psql -U kochschmiede kochschmiede

# Restore from compressed file
gunzip -c backup_20240101_120000.sql.gz | docker compose exec -T postgres psql -U kochschmiede kochschmiede
```

### 8.3 Back Up Uploaded Files (Images & Logos)

```bash
# Copy uploads to a local directory
docker compose cp backend:/app/uploads ./uploads_backup_$(date +%Y%m%d)
```

### 8.4 Export Recipes as JSON (In-App)

1. Navigate to **Settings → Backup & Export**
2. Click **"Export Recipes"**
3. A JSON file with all recipes is downloaded

This export contains all recipes, ingredients, steps, and metadata, but no images or user accounts.

---

## 9. Logs & Debugging

### 9.1 View Logs

```bash
# All logs (live)
docker compose logs -f

# Backend logs only
docker compose logs -f backend

# Frontend logs only
docker compose logs -f frontend

# Last 100 lines
docker compose logs --tail=100 backend
```

### 9.2 Check Container Status

```bash
# All containers and their status
docker compose ps

# Health check status
docker inspect kochschmiede-backend-1 | grep -A5 Health
```

### 9.3 Test the Backend API

```bash
# Health check
curl http://localhost:8000/api/health

# Interactive API documentation
open http://localhost:8000/api/docs
```

### 9.4 Access the Database Directly

```bash
# Open a PostgreSQL shell
docker compose exec postgres psql -U kochschmiede kochschmiede

# Query the number of recipes
docker compose exec postgres psql -U kochschmiede kochschmiede -c "SELECT COUNT(*) FROM recipes;"

# List all users
docker compose exec postgres psql -U kochschmiede kochschmiede -c "SELECT id, username, email, is_admin FROM users;"
```

---

## 10. Updates

```bash
# Pull the latest code
git pull

# Rebuild and restart containers
docker compose build
docker compose up -d

# Clean up old unused images
docker image prune -f
```

> **Note**: Database migrations run automatically at backend startup (via Alembic). No manual steps are required.

---

## 11. Troubleshooting (FAQ)

### ❓ `SECRET_KEY must be set in .env file` on startup

**Cause**: `SECRET_KEY` is missing or too short.  
**Solution**: Generate a secure key:
```bash
openssl rand -hex 32
```
Add the value to `.env`:
```env
SECRET_KEY=<output>
```

---

### ❓ Frontend shows "502 Bad Gateway" or a blank page

**Cause**: The backend is not ready yet.  
**Solution**: Wait ~30 seconds after the first start. Check the status:
```bash
docker compose ps
docker compose logs backend
```

---

### ❓ URL import fails with an SSRF error

**Cause**: The URL points to a private/local IP address and SSRF protection is active.  
**Solution for home servers**: Disable SSRF protection in the Admin Interface (Admin → Settings → SSRF Protection).

---

### ❓ AI import doesn't work / is very slow

**Cause A**: Ollama is not running or models are missing.  
**Solution**:
```bash
# Check if Ollama is running
docker compose ps ollama

# Restart with the Ollama profile
docker compose --profile ollama up -d

# Manually check models
docker compose exec ollama ollama list
```

**Cause B**: `AI_TIMEOUT` is too low for CPU-only hardware.  
**Solution**: Increase in `.env`:
```env
AI_TIMEOUT=600
```

---

### ❓ Registration is still open after the first user

**Solution**: In the Admin Interface → Settings → User Registration, set it to **"Admin Only"**.

---

### ❓ External AI (OpenAI/Gemini) is not working

**Checklist**:
1. Is the API key correct? (Check Admin Interface → Settings → External AI)
2. Is there credit/quota on the API account?
3. Is the correct model selected?
4. Check backend logs: `docker compose logs backend | grep -i "ai\|openai\|gemini"`

---

### ❓ Image upload fails (logo > 5 MB)

**Solution**: Compress the image beforehand or save it in a smaller format (e.g. WebP). Maximum size: 5 MB.

---

*Last updated: 2025 | KochSchmiede is open source under the MIT licence.*
