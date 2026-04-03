# KochSchmiede 🍳

> Self-hosted, mobile-first Rezeptverwaltung — gebaut mit Next.js (PWA) + FastAPI + PostgreSQL.

📖 **[English version → README.en.md](README.en.md)**  
🛠️ **[Admin-Guide → ADMIN.md](ADMIN.md)**

---

## Funktionen

- 📱 **Progressive Web App** — installierbar, Offline-Unterstützung, Kamera-Import
- 🌗 **Dark / Light Theme** mit automatischem Logo-Wechsel
- 🌍 **Mehrsprachigkeit** — Deutsch (Standard) + Englisch
- 📥 **Rezepte importieren** von Websites (URL-Scraping), PDFs, Bildern (OCR) oder der Kamera
- 🔐 **JWT-Authentifizierung** — self-hosted & mehrere Benutzer
- 🗄️ **PostgreSQL**-Datenbank mit vollständigem Rezept-CRUD
- 🐳 **Docker Compose** — alles mit einem Befehl starten
- ❤️ **Favoriten** — Lieblingsrezepte markieren
- 🏷️ **Kategorien & Tags** — Rezepte filtern und sortieren
- 📤 **Export** — Rezepte als JSON sichern
- 🖨️ **Druckansicht** — Rezepte druckerfreundlich ausgeben
- 🔗 **Teilen** — Rezepte mit anderen teilen

---

## Screenshots

<table>
  <tr>
    <td align="center"><b>Dashboard</b></td>
    <td align="center"><b>Alle Rezepte</b></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/a258f626-64e8-400a-90db-55160a440a37" width="300" alt="Dashboard" /></td>
    <td><img src="https://github.com/user-attachments/assets/ff66be36-cb8d-4acf-812d-de600aeecfbe" width="300" alt="Alle Rezepte" /></td>
  </tr>
  <tr>
    <td align="center"><b>Rezept-Detailansicht</b></td>
    <td align="center"><b>Import Center</b></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/8e920f30-4903-499e-91f3-c4d8d36c6221" width="300" alt="Rezept-Detailansicht" /></td>
    <td><img src="https://github.com/user-attachments/assets/ddafbb46-abc0-4fe4-bb81-b3338c0dc6bc" width="300" alt="Import Center" /></td>
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

### 📥 Import Center
Rezepte können aus drei Quellen importiert werden:
- **Website**: URL einer Rezept-Seite eingeben — Zutaten und Schritte werden automatisch extrahiert
- **PDF/Bild**: PDF oder Foto hochladen — OCR erkennt den Text automatisch
- **Kamera**: Rezept direkt mit der Kamera fotografieren und scannen

### ⚙️ Einstellungen
- **Theme**: Hell/Dunkel-Modus umschalten
- **Sprache**: Deutsch/Englisch wechseln
- **Profil**: Name und Avatar verwalten
- **Backup & Export**: Rezepte als JSON sichern
- **Admin-Bereich**: Registrierung, Sichtbarkeit und Benutzerverwaltung

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
```

- **Frontend**: http://localhost:3000
- **API-Dokumentation**: http://localhost:8000/api/docs

---

## Architektur

```
kochschmiede/
├── frontend/          # Next.js 15 App Router, TailwindCSS, PWA
├── backend/           # FastAPI + SQLAlchemy + PostgreSQL
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
| OCR | pytesseract + Pillow |
| Authentifizierung | JWT (python-jose + passlib/bcrypt) |
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
| `/admin` | Admin-Bereich (Benutzer, Registrierung) |
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
