# KochSchmiede – Admin-Guide 🛠️

> Vollständige Anleitung für Installation, Konfiguration und Verwaltung von KochSchmiede – sowohl auf Docker-Ebene als auch im Admin-Interface.

📖 **[English version → ADMIN.en.md](ADMIN.en.md)**

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [Installation mit Docker Compose](#2-installation-mit-docker-compose)
3. [Umgebungsvariablen & Konfiguration](#3-umgebungsvariablen--konfiguration)
4. [KI-gestützte Rezepterkennung (Ollama / LM Studio / OpenAI / Gemini)](#4-ki-gestützte-rezepterkennung)
5. [Erster Start & First-Run-Setup](#5-erster-start--first-run-setup)
6. [Admin-Interface im Browser](#6-admin-interface-im-browser)
   - [Einstellungen (Site-Konfiguration)](#61-einstellungen)
   - [Benutzerverwaltung](#62-benutzerverwaltung)
   - [Einheitenverwaltung](#63-einheitenverwaltung)
7. [Reverse-Proxy-Betrieb (Nginx / Traefik)](#7-reverse-proxy-betrieb)
8. [Datensicherung & Wiederherstellung](#8-datensicherung--wiederherstellung)
9. [Logs & Debugging](#9-logs--debugging)
10. [Updates](#10-updates)
11. [Häufige Probleme (FAQ)](#11-häufige-probleme-faq)

---

## 1. Voraussetzungen

| Anforderung | Mindestversion | Notizen |
|-------------|---------------|---------|
| Docker | 24.0+ | [docker.com/get-docker](https://docs.docker.com/get-docker/) |
| Docker Compose | 2.20+ | Seit Docker Desktop 4.x enthalten |
| RAM | 512 MB | Ohne KI. Mit Ollama: mindestens 8 GB empfohlen |
| Festplatte | 2 GB | Ohne Ollama-Modelle. Mit Modellen: +7–15 GB |
| Betriebssystem | Linux, macOS, Windows (WSL2) | |

---

## 2. Installation mit Docker Compose

### 2.1 Repository klonen

```bash
git clone https://github.com/TimUx/KochSchmiede.git
cd KochSchmiede
```

### 2.2 Umgebungsdatei erstellen

```bash
cp .env.example .env
```

Öffne `.env` in einem Texteditor und setze mindestens diese zwei Pflichtfelder:

```env
# Sicheres Datenbankpasswort
POSTGRES_PASSWORD=dein_sicheres_passwort

# JWT-Geheimschlüssel – ZWINGEND ERFORDERLICH
# Generieren mit: openssl rand -hex 32
SECRET_KEY=dein_sehr_langer_geheimer_schluessel
```

> ⚠️ **Sicherheitshinweis**: Verwende in Produktionsumgebungen niemals die Standardwerte aus `.env.example`. `SECRET_KEY` muss mindestens 32 Zeichen lang sein.

### 2.3 Dienste starten

**Ohne KI-Unterstützung (nur Heuristik-Parser):**
```bash
docker compose up -d
```

**Mit lokalem Ollama LLM (empfohlen für KI-Import):**
```bash
docker compose --profile ollama up -d
```

### 2.4 Dienste nach dem Start

| Dienst | URL | Beschreibung |
|--------|-----|--------------|
| Frontend | http://localhost:3000 | Benutzeroberfläche |
| Backend API | http://localhost:8000 | REST-API |
| API-Dokumentation | http://localhost:8000/api/docs | Swagger UI (interaktiv) |
| Ollama (optional) | http://localhost:11434 | Lokaler LLM-Server |

### 2.5 Dienste stoppen und neu starten

```bash
# Stoppen (Daten bleiben erhalten)
docker compose down

# Stoppen und alle Daten löschen (⚠️ unwiderruflich!)
docker compose down -v

# Einzelnen Dienst neu starten
docker compose restart backend
```

### 2.6 Docker-Compose-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker-Netzwerk: kochschmiede              │
│                                                               │
│  ┌───────────┐    ┌───────────┐    ┌───────────────────┐    │
│  │ frontend  │───▶│  backend  │───▶│    postgres:16    │    │
│  │ Next.js   │    │  FastAPI  │    │    PostgreSQL      │    │
│  │ Port 3000 │    │ Port 8000 │    │    Port 5432       │    │
│  └───────────┘    └─────┬─────┘    └───────────────────┘    │
│                          │                                    │
│                    ┌─────▼─────┐                             │
│                    │  ollama   │  (optional, Profile)        │
│                    │ Port 11434│                             │
│                    └───────────┘                             │
│                                                               │
│  Volumes: postgres_data  uploads_data  ollama_data           │
└─────────────────────────────────────────────────────────────┘
```

**Volumes und ihre Bedeutung:**

| Volume | Inhalt | Pfad im Container |
|--------|--------|-------------------|
| `postgres_data` | Alle Rezepte, Nutzer, Einstellungen | `/var/lib/postgresql/data` |
| `uploads_data` | Hochgeladene Bilder & Logos | `/app/uploads` |
| `ollama_data` | KI-Modelle (llama3.2, llava:7b …) | `/root/.ollama` |

---

## 3. Umgebungsvariablen & Konfiguration

Alle Variablen werden in der `.env`-Datei im Projektverzeichnis gesetzt.

### 3.1 Pflichtfelder

| Variable | Beispiel | Beschreibung |
|----------|---------|--------------|
| `POSTGRES_PASSWORD` | `MeinSicheresPasswort123` | Datenbankpasswort. Muss vor dem ersten Start gesetzt werden. |
| `SECRET_KEY` | _(Ausgabe von `openssl rand -hex 32`)_ | JWT-Geheimschlüssel. Mind. 32 Zeichen. Nie ändern wenn Nutzer eingeloggt sind. |

### 3.2 Netzwerk & Domain

| Variable | Standard | Beschreibung |
|----------|---------|--------------|
| `DOMAIN` | `localhost` | Hostname, unter dem das Frontend erreichbar ist (z.B. `kochschmiede.example.com`). Wird für CORS verwendet. |
| `PORT` | `3000` | Öffentlicher Port des Frontends (z.B. `80` hinter Reverse-Proxy). |

**Beispiel hinter Reverse-Proxy:**
```env
DOMAIN=kochschmiede.example.com
PORT=443
```

### 3.3 KI-Konfiguration (lokal / kostenlos)

Siehe [Kapitel 4](#4-ki-gestützte-rezepterkennung) für ausführliche Anleitungen.

| Variable | Standard | Beschreibung |
|----------|---------|--------------|
| `LLM_BASE_URL` | _(leer)_ | Base-URL des lokalen LLM-Servers (OpenAI-kompatibel). Z.B. `http://ollama:11434/v1` |
| `LLM_MODEL` | _(leer)_ | Modellname. Leer = automatische Auswahl aus Ollama. |
| `LLM_API_KEY` | _(leer)_ | API-Key für lokales LLM (bei Ollama nicht nötig). |
| `LLM_VISION` | _(leer)_ | `true` = Vision immer erzwingen. `false` = nur Text-LLM. Leer = automatisch. |
| `AI_ENDPOINT` | _(leer)_ | Legacy: Ollama `/api/generate` Endpoint (z.B. `http://ollama:11434`). |
| `AI_MODEL` | `llama3.2` | Legacy: Modellname für den Legacy-Endpoint. |
| `AI_TIMEOUT` | `300` | Sekunden pro LLM-Anfrage. Bei CPU-only-Hardware erhöhen (z.B. `600`). |
| `OLLAMA_AUTO_PULL` | `true` | Modelle automatisch beim ersten Import herunterladen. `false` = manuell. |

### 3.4 Vollständiges `.env`-Beispiel (Produktion)

```env
# === Pflichtfelder ===
POSTGRES_PASSWORD=LangesZufaelligesPasswort!42
SECRET_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

# === Domain (hinter Reverse-Proxy) ===
DOMAIN=kochschmiede.example.com
PORT=443

# === Ollama KI (lokal, kostenlos) ===
LLM_BASE_URL=http://ollama:11434/v1
# LLM_MODEL=llama3.2    # leer lassen für automatische Auswahl
OLLAMA_AUTO_PULL=true
AI_TIMEOUT=300
```

---

## 4. KI-gestützte Rezepterkennung

KochSchmiede verwendet eine mehrstufige Import-Pipeline:

```
Vision-KI → Text-KI → Heuristik-Parser (immer verfügbar als Fallback)
```

Die Qualität des OCR-Ergebnisses entscheidet, welche Stufe verwendet wird:
- **Strukturiertes PDF / gute Qualität** → Text-LLM
- **Zeitschrift / Handschrift / schlechte OCR** → Vision-LLM
- **Kein LLM konfiguriert** → Heuristik-Parser

### 4.1 Option A: Ollama (empfohlen – vollständig lokal & kostenlos)

```bash
# Stack mit Ollama starten
docker compose --profile ollama up -d
```

In `.env` setzen:
```env
LLM_BASE_URL=http://ollama:11434/v1
OLLAMA_AUTO_PULL=true
```

Beim ersten Import werden automatisch heruntergeladen:
- `llama3.2` (~2 GB) – Text-Modell
- `llava:7b` (~4,7 GB) – Vision-Modell

**Modelle manuell verwalten:**
```bash
# Verfügbare Modelle anzeigen
docker compose exec ollama ollama list

# Modell manuell herunterladen
docker compose exec ollama ollama pull llama3.2
docker compose exec ollama ollama pull llava:7b

# Modell entfernen (Speicher freigeben)
docker compose exec ollama ollama rm llava:7b
```

**Auf schwacher Hardware (wenig RAM/CPU):**
```env
LLM_BASE_URL=http://ollama:11434/v1
LLM_MODEL=llama3.2:1b    # Kleinstes Modell (~600 MB)
LLM_VISION=false          # Vision deaktivieren
AI_TIMEOUT=600            # Längerer Timeout
```

**GPU-Unterstützung für Ollama:**
Füge in `docker-compose.yml` zum `ollama`-Service hinzu:
```yaml
ollama:
  # ... bestehende Konfiguration ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### 4.2 Option B: LM Studio (Desktop-App, lokal, kostenlos)

1. [LM Studio herunterladen](https://lmstudio.ai)
2. Ein Modell laden (z.B. `llava:7b` für Vision)
3. Lokalen Server in LM Studio starten
4. In `.env` setzen:

```env
LLM_BASE_URL=http://host.docker.internal:1234/v1
LLM_MODEL=dein-geladenes-modell    # Muss exakt dem Namen in LM Studio entsprechen
```

> **Hinweis**: Bei LM Studio ist immer nur ein Modell gleichzeitig geladen. `LLM_MODEL` muss daher immer explizit gesetzt werden.

### 4.3 Option C: Externe KI (OpenAI / Google Gemini)

Externe KI-Anbieter werden **im Admin-Interface** konfiguriert (nicht in `.env`). Siehe [Abschnitt 6.1](#61-einstellungen).

**Wann externe KI sinnvoll ist:**
- Keine lokale Hardware für Ollama verfügbar
- Bessere Erkennungsqualität bei komplexen Layouts
- Schnellere Verarbeitung gewünscht

**Kosten (ungefähre Richtwerte):**
- OpenAI gpt-4o-mini: ~$0.001–0.003 pro Rezept
- Google Gemini Flash: ~$0.0001–0.001 pro Rezept

---

## 5. Erster Start & First-Run-Setup

### 5.1 Anwendung aufrufen

Nach `docker compose up -d` und dem Gesundheits-Check der Container:

```
http://localhost:3000
```

### 5.2 Ersten Admin-Account erstellen

Beim ersten Aufruf ist die Registrierung offen. Der **erste registrierte Nutzer** erhält automatisch Admin-Rechte.

1. Navigiere zu **http://localhost:3000**
2. Klicke auf **„Registrieren"**
3. Gib Benutzername, E-Mail und Passwort ein
4. Nach der Registrierung bist du automatisch als Admin eingeloggt

> ⚠️ **Wichtig**: Schließe direkt nach dem ersten Login die Registrierung im Admin-Interface, wenn keine weiteren Nutzer sich selbst registrieren sollen (Einstellungen → Benutzerregistrierung → „Nur Admin").

### 5.3 Admin-Interface öffnen

1. Navigiere zu **Einstellungen** (⚙️-Symbol in der Navigation)
2. Scrolle zum Abschnitt **„Admin-Bereich"**
3. Klicke auf **„Zum Admin-Bereich"**

Oder direkt: **http://localhost:3000/admin**

---

## 6. Admin-Interface im Browser

Das Admin-Interface ist erreichbar unter `/admin` und ist in drei Tabs aufgeteilt:

### 6.1 Einstellungen

#### Sichtbarkeit der Seite

| Modus | Beschreibung |
|-------|--------------|
| **Privat** (Standard) | Nur eingeloggte Nutzer sehen Rezepte. Geteilte Rezepte erfordern ein Passwort. |
| **Öffentlich** | Alle Rezepte sind ohne Login einsehbar. Nützlich für öffentliche Kochblogs. |

#### Benutzerregistrierung

| Modus | Beschreibung |
|-------|--------------|
| **Offen** (Standard) | Jeder kann sich selbst registrieren. |
| **Nur Admin** | Neue Konten können nur von Admins erstellt werden. Für geschlossene Haushalte empfohlen. |

#### SSRF-Schutz

Der SSRF-Schutz (Server-Side Request Forgery) verhindert, dass beim URL-Import interne Netzwerkadressen (z.B. `192.168.x.x`, `10.x.x.x`) angesprochen werden.

| Einstellung | Empfehlung |
|-------------|------------|
| **Aktiviert** (Standard) | Für Installationen, die im Internet erreichbar sind. |
| **Deaktiviert** | Nur für rein private Home-Server-Installationen, bei denen du Rezepte von lokalen Webservern importieren möchtest. |

> ⚠️ **Sicherheitshinweis**: Deaktiviere den SSRF-Schutz nur, wenn die Instanz nicht aus dem Internet erreichbar ist.

#### Logos & Icons

Hier kannst du das Erscheinungsbild der Anwendung anpassen:

| Slot | Beschreibung | Empfohlene Größe |
|------|--------------|-----------------|
| **Logo (Hell)** | Wird im Light-Theme in der Navigation angezeigt | 200 × 50 px |
| **Logo (Dunkel)** | Wird im Dark-Theme in der Navigation angezeigt | 200 × 50 px |
| **Favicon** | Browser-Tab-Icon | 32 × 32 px oder 64 × 64 px |
| **App-Icon** | Wird beim Installieren als PWA verwendet | 512 × 512 px |

**Unterstützte Formate**: PNG, JPEG, WEBP, GIF  
**Maximale Dateigröße**: 5 MB pro Bild

**Logos zurücksetzen**: Klicke auf das Mülleimer-Symbol neben dem jeweiligen Bild, um das Standard-Logo wiederherzustellen.

#### Externe KI-Konfiguration (OpenAI / Gemini)

Hier konfigurierst du optionale externe KI-Dienste für die Rezepterkennung.

**Schritt-für-Schritt (OpenAI):**
1. Wähle **„OpenAI"** als Anbieter
2. Wähle ein Modell (empfohlen: **gpt-4o-mini** für gutes Preis-Leistungs-Verhältnis)
3. Gib deinen **OpenAI API-Key** ein (von [platform.openai.com](https://platform.openai.com/api-keys))
4. Klicke auf **„Speichern"**

**Schritt-für-Schritt (Google Gemini):**
1. Wähle **„Google Gemini"** als Anbieter
2. Wähle ein Modell (empfohlen: **gemini-2.0-flash** – kostenlos im Free Tier)
3. Gib deinen **Gemini API-Key** ein (von [aistudio.google.com](https://aistudio.google.com))
4. Klicke auf **„Speichern"**

**Modellübersicht:**

| Anbieter | Modell | Eigenschaften |
|---------|--------|---------------|
| OpenAI | gpt-4o | Höchste Qualität, höhere Kosten |
| OpenAI | gpt-4o-mini | Gute Qualität, günstiger |
| OpenAI | gpt-3.5-turbo | Schnell, günstig, einfache Rezepte |
| Gemini | gemini-2.5-flash | Sehr schnell, kostenlos im Free Tier |
| Gemini | gemini-2.5-pro | Höchste Qualität bei Gemini |
| Gemini | gemini-2.0-flash | Schnell, kostenlos |

> **Hinweis**: Der API-Key wird sicher in der Datenbank gespeichert und nie in der Oberfläche angezeigt. Nach dem Speichern wird nur ein ✅-Symbol angezeigt.

**Externe KI entfernen**: Wähle **„(keiner)"** als Anbieter und speichere.

**Priorität der Import-Pipeline**: Externe KI → Lokale KI (Ollama) → Heuristik-Parser.

---

### 6.2 Benutzerverwaltung

#### Neuen Benutzer erstellen

1. Navigiere zum Tab **„Benutzer"**
2. Fülle das Formular aus:
   - **Benutzername**: Eindeutiger Anmeldename
   - **E-Mail**: Pflichtfeld für Kontoverwaltung
   - **Passwort**: Sicheres Passwort festlegen
3. Klicke auf **„Benutzer erstellen"**

> Der neue Nutzer kann sich sofort anmelden. Ein Admin kann für ihn später das Passwort in der Benutzerverwaltung nicht direkt ändern – der Nutzer muss dies selbst tun.

#### Benutzer verwalten

| Aktion | Symbol | Beschreibung |
|--------|--------|--------------|
| **Admin-Status umschalten** | 👑 | Gibt dem Nutzer Admin-Rechte oder entzieht sie. Kann nicht auf sich selbst angewendet werden. |
| **Benutzer löschen** | 🗑️ | Löscht den Account unwiderruflich. Rezepte des Nutzers bleiben erhalten. Kann nicht auf sich selbst angewendet werden. |

**Hinweis**: Mindestens ein Admin muss immer vorhanden sein. Das System verhindert, dass ein Admin seinen eigenen Admin-Status widerruft oder sich selbst löscht.

---

### 6.3 Einheitenverwaltung

In diesem Tab werden Maßeinheiten für Zutaten verwaltet (z.B. „Tüte", „Schuss", „Prise").

#### Neue Einheit hinzufügen

1. Gib den Namen der Einheit in das Eingabefeld ein
2. Klicke auf **„Hinzufügen"**

#### Einheit umbenennen

1. Klicke auf das Stift-Symbol neben der Einheit
2. Ändere den Namen
3. Klicke auf **„Speichern"** oder drücke Enter

#### Einheit löschen

1. Klicke auf das Mülleimer-Symbol
2. Bestätige die Löschung

> **Hinweis**: Löschen einer Einheit entfernt sie nur aus der Auswahlliste. Bereits verwendete Zutatmengen in Rezepten sind davon nicht betroffen.

---

## 7. Reverse-Proxy-Betrieb

### 7.1 Nginx (Standard HTTP/HTTPS)

Erstelle eine Nginx-Konfigurationsdatei:

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

    # Backend API (wird vom Frontend-Server intern weitergeleitet)
    # Für direkten Zugriff auf die API von außen:
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;  # Für Bild-Uploads
    }
}
```

In `.env` setzen:
```env
DOMAIN=kochschmiede.example.com
PORT=443
```

### 7.2 Traefik (Docker-Labels)

```yaml
# In docker-compose.yml ergänzen:
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

## 8. Datensicherung & Wiederherstellung

### 8.1 Datenbank sichern (PostgreSQL Dump)

```bash
# Backup erstellen
docker compose exec postgres pg_dump -U kochschmiede kochschmiede > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup komprimiert erstellen
docker compose exec postgres pg_dump -U kochschmiede kochschmiede | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 8.2 Datenbank wiederherstellen

```bash
# Aus SQL-Datei wiederherstellen
cat backup_20240101_120000.sql | docker compose exec -T postgres psql -U kochschmiede kochschmiede

# Aus komprimierter Datei wiederherstellen
gunzip -c backup_20240101_120000.sql.gz | docker compose exec -T postgres psql -U kochschmiede kochschmiede
```

### 8.3 Upload-Daten sichern (Bilder & Logos)

```bash
# Uploads in ein lokales Verzeichnis kopieren
docker compose cp backend:/app/uploads ./uploads_backup_$(date +%Y%m%d)
```

### 8.4 Rezepte als JSON exportieren (In-App)

1. Navigiere zu **Einstellungen → Backup & Export**
2. Klicke auf **„Rezepte exportieren"**
3. Eine JSON-Datei mit allen Rezepten wird heruntergeladen

Dieser Export enthält alle Rezepte, Zutaten, Schritte und Metadaten, aber keine Bilder oder Benutzerkonten.

---

## 9. Logs & Debugging

### 9.1 Logs anzeigen

```bash
# Alle Logs (laufend)
docker compose logs -f

# Nur Backend-Logs
docker compose logs -f backend

# Nur Frontend-Logs
docker compose logs -f frontend

# Letzte 100 Zeilen
docker compose logs --tail=100 backend
```

### 9.2 Container-Status prüfen

```bash
# Alle Container und ihr Status
docker compose ps

# Health-Check-Status
docker inspect kochschmiede-backend-1 | grep -A5 Health
```

### 9.3 Backend-API testen

```bash
# Health-Check
curl http://localhost:8000/api/health

# Interaktive API-Dokumentation
open http://localhost:8000/api/docs
```

### 9.4 Datenbank direkt ansprechen

```bash
# PostgreSQL-Shell öffnen
docker compose exec postgres psql -U kochschmiede kochschmiede

# Anzahl der Rezepte abfragen
docker compose exec postgres psql -U kochschmiede kochschmiede -c "SELECT COUNT(*) FROM recipes;"

# Alle Benutzer anzeigen
docker compose exec postgres psql -U kochschmiede kochschmiede -c "SELECT id, username, email, is_admin FROM users;"
```

---

## 10. Updates

```bash
# Neuesten Code holen
git pull

# Container neu bauen und starten
docker compose build
docker compose up -d

# Alte, ungenutzte Images aufräumen
docker image prune -f
```

> **Hinweis**: Die Datenbank-Migrationen laufen beim Start des Backends automatisch (via Alembic). Es ist kein manueller Schritt erforderlich.

---

## 11. Häufige Probleme (FAQ)

### ❓ `SECRET_KEY must be set in .env file` beim Start

**Ursache**: `SECRET_KEY` fehlt oder ist zu kurz.  
**Lösung**: Generiere einen sicheren Key:
```bash
openssl rand -hex 32
```
Trage den Wert in `.env` ein:
```env
SECRET_KEY=<ausgabe>
```

---

### ❓ Frontend zeigt „502 Bad Gateway" oder leere Seite

**Ursache**: Backend ist noch nicht bereit.  
**Lösung**: Warte ~30 Sekunden nach dem ersten Start. Prüfe den Status:
```bash
docker compose ps
docker compose logs backend
```

---

### ❓ URL-Import schlägt fehl mit SSRF-Fehler

**Ursache**: Die URL zeigt auf eine private/lokale IP-Adresse und SSRF-Schutz ist aktiv.  
**Lösung für Home-Server**: SSRF-Schutz im Admin-Interface deaktivieren (Admin → Einstellungen → SSRF-Schutz).

---

### ❓ KI-Import funktioniert nicht / sehr langsam

**Ursache A**: Ollama ist nicht gestartet oder Modelle fehlen.  
**Lösung**:
```bash
# Prüfen ob Ollama läuft
docker compose ps ollama

# Mit Ollama-Profil neu starten
docker compose --profile ollama up -d

# Modelle manuell prüfen
docker compose exec ollama ollama list
```

**Ursache B**: AI_TIMEOUT zu niedrig für CPU-only-Hardware.  
**Lösung**: In `.env` erhöhen:
```env
AI_TIMEOUT=600
```

---

### ❓ Nach dem ersten Nutzer ist Registrierung noch offen

**Lösung**: Im Admin-Interface → Einstellungen → Benutzerregistrierung auf **„Nur Admin"** setzen.

---

### ❓ Externe KI (OpenAI/Gemini) funktioniert nicht

**Prüfschritte**:
1. API-Key korrekt eingegeben? (Im Admin-Interface → Einstellungen → Externe KI prüfen)
2. Guthaben auf dem API-Account vorhanden?
3. Richtiges Modell ausgewählt?
4. Backend-Logs prüfen: `docker compose logs backend | grep -i "ai\|openai\|gemini"`

---

### ❓ Bild-Upload schlägt fehl (Logo > 5 MB)

**Lösung**: Bild vorher komprimieren oder als kleineres Format (z.B. WebP) speichern. Maximale Größe: 5 MB.

---

*Letzte Aktualisierung: 2025 | KochSchmiede ist Open Source unter der MIT-Lizenz.*
