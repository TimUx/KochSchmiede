# KochSchmiede 🍳

> Self-hosted, mobile-first Rezeptverwaltung — gebaut mit Next.js (PWA) + FastAPI + PostgreSQL.

📖 **[English version → README.en.md](README.en.md)**  
🛠️ **[Admin-Guide → ADMIN.md](ADMIN.md)**

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss)
![PWA](https://img.shields.io/badge/PWA-installierbar-5A0FC8?logo=pwa)
![License](https://img.shields.io/badge/Lizenz-MIT-green)

---

## Inhaltsverzeichnis

1. [Funktionen](#funktionen)
2. [Screenshots](#screenshots)
3. [App-Funktionen im Detail](#app-funktionen-im-detail)
4. [Import Center](#-import-center)
   - [Importmethoden](#importmethoden)
   - [KI-Technologien](#ki-technologien)
   - [Smart Routing](#smart-routing--welche-ki-für-welches-rezept)
   - [KI konfigurieren](#ki-konfigurieren)
5. [Schnellstart](#schnellstart)
6. [Architektur & Technologie-Stack](#architektur--technologie-stack)
7. [Entwicklung](#entwicklung)
8. [Seiten](#seiten)
9. [API-Endpunkte](#api-endpunkte)
10. [Farbpalette](#farbpalette)
11. [Lizenz](#lizenz)

---

## Funktionen

- 📱 **Progressive Web App** — installierbar auf iOS/Android/Desktop, Offline-Unterstützung, Kamera-Import
- 🌗 **Dark / Light Theme** mit automatischem Logo-Wechsel
- 🌍 **Mehrsprachigkeit** — Deutsch (Standard) + Englisch
- 📥 **Rezepte importieren** von Websites (URL-Scraping), PDFs, Bildern (OCR) oder der Kamera — inklusive KI-gestützter Erkennung
- 🤖 **KI-gestütztes Importieren** — lokal (Ollama / LM Studio) oder extern (OpenAI / Google Gemini) mit intelligentem Routing
- 🔐 **JWT-Authentifizierung** — self-hosted & mehrere Benutzer
- 🗄️ **PostgreSQL**-Datenbank mit vollständigem Rezept-CRUD
- 🐳 **Docker Compose** — alles mit einem Befehl starten
- ❤️ **Favoriten** — Lieblingsrezepte markieren
- 🏷️ **Kategorien & Tags** — Rezepte filtern und sortieren
- 📤 **Export** — Rezepte als JSON sichern
- 🖨️ **Druckansicht** — Rezepte druckerfreundlich ausgeben
- 🔗 **Teilen** — Rezepte mit anderen teilen
- 🖼️ **HEIC/HEIF-Unterstützung** — iPhone-Fotos direkt importieren

---

## Screenshots

<table>
  <tr>
    <td align="center"><b>Dashboard</b></td>
    <td align="center"><b>Alle Rezepte</b></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/fdbb21ff-f67f-4ba0-b5fa-755b0580b190" width="300" alt="Dashboard" /></td>
    <td><img src="https://github.com/user-attachments/assets/bfb89549-18aa-4550-87e8-57a4035c81cf" width="300" alt="Alle Rezepte" /></td>
  </tr>
  <tr>
    <td align="center"><b>Rezept-Detailansicht</b></td>
    <td align="center"><b>Import Center</b></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/d152c1cb-e825-4d06-ab67-9a959c090b40" width="300" alt="Rezept-Detailansicht" /></td>
    <td><img src="https://github.com/user-attachments/assets/1159594c-9468-4cfc-8f84-7e9356a012a4" width="300" alt="Import Center" /></td>
  </tr>
</table>

---

## App-Funktionen im Detail

### 📊 Dashboard
Das Dashboard zeigt eine Übersicht der zuletzt hinzugefügten Rezepte mit Statistiken (Anzahl der Rezepte, Kategorien, Favoriten) und Schnellzugriff-Buttons für neue Rezepte oder den Import.

### 📖 Rezeptverwaltung
- Vollständige Rezeptliste mit Suche und Kategorie-Filter
- Detailansicht mit Zutaten, Zubereitungsschritten, Zeiten und Portionen
- Rezepte erstellen, bearbeiten und löschen
- Tags und Kategorien zur Strukturierung
- Favoriten markieren

### ⚙️ Einstellungen
- **Theme**: Hell/Dunkel-Modus umschalten
- **Sprache**: Deutsch/Englisch wechseln
- **Profil**: Name und Avatar verwalten
- **Backup & Export**: Rezepte als JSON sichern
- **Admin-Bereich**: Registrierung, Sichtbarkeit und Benutzerverwaltung, externe KI konfigurieren

---

## 📥 Import Center

Das Import Center ist das Herzstück von KochSchmiede. Es unterstützt drei grundlegend verschiedene Importmethoden und kombiniert mehrere KI-Technologien, um aus nahezu jeder Quelle ein strukturiertes Rezept zu erstellen.

### Importmethoden

#### 1. 🌐 Website-Import (URL)
URL einer Rezept-Seite eingeben — der eingebaute Web-Scraper extrahiert Titel, Zutaten und Zubereitungsschritte automatisch aus dem HTML-Quellcode der Seite (z. B. Chefkoch, Küchengötter, internationale Rezept-Blogs). Keine KI notwendig, funktioniert vollständig ohne externe Dienste.

#### 2. 📄 Datei-Import (PDF / Bild)
PDF oder Foto hochladen — unterstützte Formate: **JPEG, PNG, WebP, TIFF, HEIC/HEIF** (iPhone-Fotos) sowie **PDF**. Die maximale Dateigröße beträgt 20 MB. Je nach Qualität und Aufbau des Dokuments wählt die Pipeline automatisch die passende KI-Strategie (siehe [Smart Routing](#smart-routing--welche-ki-für-welches-rezept)).

#### 3. 📷 Kamera-Import
Rezept direkt mit der Gerätekamera fotografieren und sofort scannen — besonders praktisch auf Mobilgeräten. Das Foto wird wie ein regulärer Datei-Upload verarbeitet und durchläuft dieselbe KI-Pipeline.

---

### KI-Technologien

Der Import nutzt drei unabhängige KI-Ebenen, die je nach verfügbarer Konfiguration und Dokumentqualität automatisch kombiniert werden:

#### 🔤 Text-LLM (Sprach­modell auf Textbasis)
Erhält den extrahierten Text (aus PDF-Textschicht oder Tesseract-OCR) und gibt strukturierte Rezeptdaten zurück. Schnell und ressourcenschonend.

- **Lokal mit Ollama**: `llama3.2` (~2 GB) wird automatisch heruntergeladen, wenn kein Modell vorhanden ist.
- **Lokal mit LM Studio**: Beliebiges OpenAI-kompatibles Modell — `LLM_MODEL` muss manuell gesetzt werden.
- **OpenAI** (kostenpflichtig, extern): `gpt-4.1`, `gpt-4o`, `gpt-4o-mini` u. a. — nutzt die Responses API mit `json_schema` Structured Output für zuverlässige Extraktion.
- **Google Gemini** (kostenpflichtig, extern): `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro` u. a. — nutzt das offizielle `google-genai` SDK.

#### 👁️ Vision-LLM (multimodales Modell)
Erhält das Bild direkt (kein Umweg über OCR) und erkennt Layout, Handschrift, Spalten und Zeitschriften-Designs deutlich besser als reine Texterkennung.

- **Lokal mit Ollama**: `llava:7b` (~4,7 GB) wird automatisch heruntergeladen.
- **OpenAI** (extern): Vollbild-Analyse mit `gpt-4o` / `gpt-4.1`.
- **Google Gemini** (extern): Multimodale Analyse mit `gemini-1.5-flash` / `gemini-1.5-pro`.

#### 📐 Heuristik-Parser (immer verfügbar)
Regelbasierter Parser ohne KI — analysiert den OCR-Text strukturiert: erkennt Zutaten-Blöcke, Zubereitungsschritte, Zeitangaben, Portionen, mehrspaltige Layouts und filtert Zeitschriften-Rauschen (Preise, Werbung, Seitenzahlen). Dient als Fallback, wenn keine KI konfiguriert oder verfügbar ist.

---

### Smart Routing — welche KI für welches Rezept?

Die Import-Pipeline bewertet jedes Dokument automatisch und wählt die schnellste und präziseste Strategie:

```
Eingabe (PDF / Bild / Kamerafoto)
        │
        ▼
 ┌──────────────────────────────────────────────────┐
 │ Ist es ein PDF mit extrahierbarem Text?          │
 └──────────────────────────────────────────────────┘
        │ Ja                          │ Nein
        ▼                             ▼
  Text-LLM                     Tesseract OCR
  (schnell)                    (Texterkennung)
        │                             │
        ▼                             ▼
  ┌─────────────────────────────────────────────────┐
  │ OCR-Qualitäts­bewertung (Score 0.0 – 1.0)      │
  │  ≥ 0.60 → gute Qualität (z. B. Chefkoch-PDF)  │
  │  < 0.60 → schlechte Qualität (Zeitschrift,     │
  │            Handschrift, mehrere Spalten)        │
  └─────────────────────────────────────────────────┘
        │ ≥ 0.60                      │ < 0.60
        ▼                             ▼
  Text-LLM                     Vision-LLM (Bild direkt)
  (ressourcen­schonend)         (höchste Qualität)
        │                             │
        └──────────────┬──────────────┘
                       ▼
              Heuristik-Parser
              (Fallback, immer aktiv)
```

**Welche KI wird für Text-LLM / Vision-LLM verwendet?**

Die Pipeline wählt automatisch die konfigurierte KI in folgender Priorität:

| Priorität | Anbieter | Text-LLM | Vision-LLM |
|-----------|----------|-----------|------------|
| 1 | **Externe KI** (OpenAI / Gemini) | ✅ | ✅ |
| 2 | **Lokal** (Ollama / LM Studio) | ✅ | ✅ (llava:7b) |
| 3 | **Heuristik-Parser** (Fallback, kein LLM) | ✅ | — |

Ist eine externe KI konfiguriert, wird diese bevorzugt verwendet. Ist kein lokales Modell vorhanden und keine externe KI eingerichtet, greift automatisch der Heuristik-Parser als Fallback.

**Beispiele:**
| Dokument | OCR-Score | Strategie |
|----------|-----------|-----------|
| Strukturiertes PDF (z. B. Chefkoch-Export) | ≥ 0.77 | Text-LLM direkt |
| Chefkoch-Website-Screenshot | ≥ 0.60 | Text-LLM |
| Zeitschriften-Scan (mehrspaltig, Anzeigen) | ≈ 0.54 | Vision-LLM |
| Handgeschriebenes Rezept | < 0.60 | Vision-LLM |
| Kamerafoto (Kochbuch) | < 0.60 | Vision-LLM |

Wenn ein KI-Schritt fehlschlägt (z. B. kein Ollama verfügbar, API-Fehler), wechselt die Pipeline automatisch zum nächsten verfügbaren Schritt und gibt ggf. eine Warnung im Importergebnis zurück.

---

### KI konfigurieren

#### Option A: Ollama (lokal, vollautomatisch — empfohlen)

```bash
# Stack inklusive Ollama starten
docker compose --profile ollama up -d
```

In `.env`:
```env
LLM_BASE_URL=http://ollama:11434/v1
# LLM_MODEL leer lassen → automatische Modellauswahl
# Modelle werden beim ersten Import automatisch heruntergeladen (OLLAMA_AUTO_PULL=true)
```

#### Option B: Ollama mit festem Modell

```env
LLM_BASE_URL=http://ollama:11434/v1
LLM_MODEL=llama3.2:1b        # kleines Textmodell für schwache Hardware
# LLM_VISION=false           # Vision komplett deaktivieren (spart Ressourcen)
```

#### Option C: LM Studio (lokal, Desktop-App)

1. [LM Studio](https://lmstudio.ai) herunterladen und ein Modell laden
2. Lokalen Server in LM Studio starten
3. In `.env`:

```env
LLM_BASE_URL=http://host.docker.internal:1234/v1
LLM_MODEL=dein-geladenes-modell   # muss immer gesetzt werden (nur ein Modell gleichzeitig)
```

#### Option D: OpenAI (extern, kostenpflichtig)

> **Voraussetzung:** Ein kostenpflichtiger [OpenAI-Account](https://platform.openai.com/) ist erforderlich. Die Nutzung wird nach Tokenverbrauch abgerechnet — OpenAI bietet verschiedene Preismodelle je nach Modell an (z. B. `gpt-4o-mini` für günstige Nutzung, `gpt-4o` / `gpt-4.1` für höchste Qualität). Aktuelle Preise: [openai.com/pricing](https://openai.com/pricing).

Im Admin-Bereich (`/admin`) unter **Externe KI**:
- **Anbieter**: `openai`
- **API-Schlüssel**: OpenAI API Key
- **Modell**: z. B. `gpt-4o-mini` (günstig) oder `gpt-4o` / `gpt-4.1` (höchste Qualität)

OpenAI wird automatisch für alle Datei- und Kamera-Imports verwendet, sobald ein API-Schlüssel konfiguriert ist. Der Schlüssel wird verschlüsselt in der Datenbank gespeichert und nie im Frontend angezeigt.

#### Option E: Google Gemini (extern, kostenpflichtig)

> **Voraussetzung:** Ein [Google-Account](https://accounts.google.com/) sowie ein aktiver Zugang zu [Google AI Studio](https://aistudio.google.com/) sind erforderlich. Die Nutzung über die API wird nutzungsbasiert abgerechnet — Google bietet verschiedene Preismodelle je nach Modell und Anfragelast an (z. B. `gemini-2.0-flash` für schnelle und günstige Nutzung, `gemini-1.5-pro` für höchste Qualität). Aktuelle Preise: [ai.google.dev/pricing](https://ai.google.dev/pricing).

Im Admin-Bereich (`/admin`) unter **Externe KI**:
- **Anbieter**: `gemini`
- **API-Schlüssel**: Google AI Studio API Key
- **Modell**: z. B. `gemini-2.0-flash` (schnell & günstig) oder `gemini-1.5-pro` (höchste Qualität)

#### Konfigurations­übersicht

| Einstellung | Beschreibung | Standard |
|-------------|--------------|---------|
| `LLM_BASE_URL` | URL des lokalen LLM-Servers (Ollama / LM Studio) | leer (deaktiviert) |
| `LLM_MODEL` | Modellname — leer = automatische Auswahl aus Ollama | leer (auto) |
| `LLM_VISION` | `true` = Vision immer, `false` = nie, leer = auto | leer (auto) |
| `LLM_API_KEY` | API-Schlüssel für lokalen LLM-Server (meist leer) | leer |
| `AI_TIMEOUT` | Timeout pro KI-Anfrage in Sekunden | `300` |
| `OLLAMA_AUTO_PULL` | Modelle automatisch herunterladen | `true` |
| Admin → Externe KI | OpenAI / Gemini Anbieter, Schlüssel, Modell | — |

---

## Schnellstart

### Voraussetzungen

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)

### Starten

```bash
# Repository klonen
git clone https://github.com/TimUx/KochSchmiede.git
cd KochSchmiede

# Umgebungsvariablen kopieren und anpassen
cp .env.example .env
# .env bearbeiten: starkes POSTGRES_PASSWORD und SECRET_KEY setzen

# Alle Dienste starten
docker compose up -d

# Optional: mit lokalem Ollama-LLM starten
docker compose --profile ollama up -d
```

- **Frontend**: http://localhost:3000
- **API-Dokumentation**: http://localhost:8000/api/docs

> **SECRET_KEY** ist Pflicht. Einen sicheren Schlüssel erzeugen:
> ```bash
> openssl rand -hex 32
> ```

---

## Architektur & Technologie-Stack

```
kochschmiede/
├── frontend/          # Next.js 15 App Router, TailwindCSS, PWA
├── backend/           # FastAPI + SQLAlchemy + PostgreSQL
│   └── app/
│       ├── api/       # REST-Endpunkte (auth, recipes, import, settings)
│       ├── services/  # OCR, AI-Parser, Scraper, externe KI
│       └── models/    # SQLAlchemy-Datenbankmodelle
├── public/assets/     # Logo-Assets (Dark/Light-Varianten)
├── docker-compose.yml
└── .env.example
```

### Technologie-Stack

| Ebene | Technologie |
|-------|-------------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, next-themes |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Datenbank | PostgreSQL 16 |
| OCR | Tesseract (pytesseract) + Pillow + PyMuPDF |
| Bildformate | JPEG, PNG, WebP, TIFF, HEIC/HEIF (pillow-heif) |
| Lokale KI | Ollama (llama3.2 + llava:7b), LM Studio, OpenAI-Protokoll |
| Externe KI | OpenAI Responses API (`openai>=1.58.0`), Google Gemini (`google-genai>=1.10.0`) |
| Authentifizierung | JWT (python-jose + passlib/bcrypt) |
| Web-Scraping | BeautifulSoup4 + lxml + requests |
| Deployment | Docker Compose |

---

## Entwicklung

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

> `DATABASE_URL` in `backend/.env` setzen, wenn lokal ohne Docker gestartet wird.

---

## Seiten

| Route | Beschreibung |
|-------|--------------|
| `/` | Dashboard — Rezeptübersicht + Schnellaktionen |
| `/recipes` | Alle Rezepte mit Suche und Kategorie-Filter |
| `/recipes/[id]` | Rezept-Detailansicht |
| `/recipes/[id]/edit` | Rezept-Editor |
| `/recipes/new` | Neues Rezept erstellen (mit Kamera / Upload) |
| `/import` | Import Center (URL / PDF+OCR / Kamera) |
| `/settings` | Theme, Sprache, Konto, Export |
| `/admin` | Admin-Bereich (Benutzer, Registrierung, externe KI) |
| `/offline` | Offline-Fallback-Seite |

---

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| POST | `/api/auth/register` | Konto erstellen |
| POST | `/api/auth/login` | Anmelden → JWT-Token |
| GET | `/api/auth/me` | Aktueller Benutzer |
| GET | `/api/recipes/` | Rezepte auflisten |
| POST | `/api/recipes/` | Rezept erstellen |
| GET | `/api/recipes/{id}` | Rezept abrufen |
| PUT | `/api/recipes/{id}` | Rezept aktualisieren |
| DELETE | `/api/recipes/{id}` | Rezept löschen |
| GET | `/api/import/url?url=…` | Von Website importieren |
| POST | `/api/import/file` | Von PDF/Bild importieren |
| POST | `/api/import/camera` | Von Kamerafoto importieren |
| GET | `/api/settings` | Site-Einstellungen lesen |
| PUT | `/api/settings` | Site-Einstellungen aktualisieren (Admin) |
| GET | `/api/health` | Health-Check |

---

## Farbpalette

| Rolle | Farbe |
|-------|-------|
| Dunkler Hintergrund | `#1e1e2e` |
| Akzentfarbe | `#f59e0b` (Amber) |
| Erfolg / Frisch | `#22c55e` (Grün) |

---

## Lizenz

MIT
