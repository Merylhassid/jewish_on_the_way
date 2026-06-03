# Jewish On The Way

A full-stack mobile application for Jewish travelers to find kosher restaurants, synagogues, minyans, and Shabbat hosting in cities worldwide. Users can search by location or destination, filter by denomination and kashrut level, write reviews, and request hosting — all in real time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | NestJS 11 · TypeScript · TypeORM 0.3 |
| **Mobile** | React Native 0.81 · Expo 54 · Expo Router |
| **Database** | PostgreSQL + PostGIS (Neon Cloud serverless) |
| **AI / Search** | TF-IDF + Naive Bayes classifiers (Python training → TypeScript inference) |
| **Images** | Cloudinary |
| **Auth** | JWT (RS256) · expo-secure-store (device keychain/keystore) |
| **Real-time** | Socket.IO WebSockets (chat + hosting requests) |
| **Geocoding** | Nominatim (OpenStreetMap) |

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- **Python** 3.9 or later (AI model training only)
- **PostgreSQL** with the **PostGIS** extension enabled
- **Expo CLI** — `npm install -g expo-cli`
- **Expo Go** app installed on your device or simulator

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Merylhassid/jewish_on_the_way.git
cd jewish_on_the_way
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and fill in all required values (DB, JWT_SECRET, Cloudinary, etc.)
npm run start:dev
```

The API will be available at `http://localhost:3001`.

### 3. Mobile

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

### 4. AI Model (optional — only needed to retrain classifiers)

```bash
cd ai-model
pip install -r requirements.txt

# Train and export the search classifier
python export_model.py

# Train and export the denomination classifier
python export_denomination_model.py
```

The exported `model.json` and `denomination_model.json` files are copied into `backend/src/ai/` and loaded at server startup.

---

## Running Tests

```bash
# Backend — unit tests (103 tests)
cd backend
npm test

# Backend — end-to-end tests (requires a live DB connection in .env)
npm run test:e2e
```

---

## Project Structure

```
jewish_on_the_way/
├── backend/                  # NestJS API server
│   ├── src/
│   │   ├── ai/               # Smart search + denomination classifiers
│   │   ├── auth/             # JWT auth, guards, password reset
│   │   ├── synagogues/       # Synagogue CRUD + nearby search
│   │   ├── restaurants/      # Restaurant CRUD + kosher filtering
│   │   ├── minyans/          # Minyan times
│   │   ├── hosting/          # Shabbat hosting requests + WebSocket
│   │   ├── chat/             # Real-time chat gateway
│   │   ├── reviews/          # Reviews, reports, place requests
│   │   ├── favorites/        # User saved places
│   │   ├── destinations/     # City/country destination tree
│   │   ├── admin/            # Bulk synagogue import + geocoding
│   │   └── ...
│   └── test/                 # e2e test suites
├── mobile/                   # Expo / React Native app
│   ├── app/                  # Expo Router screens
│   │   ├── (tabs)/           # Main tab navigation
│   │   ├── synagogue/        # Synagogue detail screens
│   │   ├── restaurant/       # Restaurant detail screens
│   │   ├── hosting/          # Hosting request flow
│   │   └── ...
│   └── src/
│       ├── api/              # Axios client + interceptors
│       ├── store/            # Auth context
│       ├── components/       # Shared UI components
│       └── i18n/             # Translations (Hebrew/English)
└── ai-model/                 # Python model training scripts
    ├── classifier.py         # TF-IDF + Naive Bayes (search intent)
    ├── denomination_classifier.py  # Denomination detection
    ├── export_model.py
    └── export_denomination_model.py
```

---

## Key Features

- **Smart search** — AI classifier detects search intent (synagogue vs. restaurant vs. minyan) and routes to the correct endpoint automatically
- **Denomination filtering** — Ashkenaz, Sfarad, Chabad, Teimanim filters on synagogue search
- **Kashrut filtering** — Meat / dairy / pareve / kashrut-level filters on restaurant search
- **GPS nearby search** — Find the closest synagogues and restaurants to your current location using PostGIS spatial queries
- **Shabbat hosting** — Travelers can request a Shabbat meal/overnight; hosts receive real-time WebSocket notifications
- **Real-time chat** — Direct messaging between users with rate limiting and per-user cleanup
- **Reviews & reports** — Leave ratings/reviews, report incorrect data, or request a missing place be added
- **Favorites** — Save synagogues and restaurants for quick access
- **Bulk import** — Admin endpoint to import hundreds of synagogues from JSON with automatic Nominatim geocoding
- **Multilingual UI** — Hebrew and English support via i18n

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Mobile (React Native / Expo)            │
└───────────────────────┬─────────────────────────────────┘
                        │
          ┌─────────────┴──────────────┐
          │  REST (HTTP/JSON)          │  WebSocket (Socket.IO)
          │  Authorization: Bearer JWT │  JWT handshake
          ▼                            ▼
┌─────────────────────────────────────────────────────────┐
│                 NestJS API  :3001                        │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
│  │ Auth     │ │Synagogues│ │Restaurants│ │ AI Search│  │
│  │ Module   │ │ Module   │ │  Module   │ │  Module  │  │
│  └──────────┘ └──────────┘ └───────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐               │
│  │ Hosting  │ │  Chat    │ │  Reviews  │  ...           │
│  │ Gateway  │ │ Gateway  │ │  Module   │               │
│  └──────────┘ └──────────┘ └───────────┘               │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              TypeORM  (Repository layer)          │  │
│  └───────────────────────┬──────────────────────────┘  │
└──────────────────────────┼──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│         PostgreSQL + PostGIS  (Neon Cloud)               │
│                                                         │
│  synagogues  restaurants  minyans  users  destinations  │
│  reviews     favorites    hosting  chat   audit_log      │
└─────────────────────────────────────────────────────────┘

External services:
  Nominatim (geocoding)  ·  Cloudinary (image storage)
  SMTP (password reset)
```

---

## Deployment

The production backend runs on a dedicated Linux server managed with **PM2**.

| Item | Value |
|---|---|
| Server | `49.12.189.108:3000` |
| Process manager | PM2 |
| Deploy user | `student` |

### Deploy process

1. Build the backend locally:
   ```powershell
   cd backend
   npm run build
   ```

2. Upload the compiled `dist/` directory and `package.json` to the server via SFTP (Posh-SSH):
   ```powershell
   Import-Module Posh-SSH
   $session = New-SFTPSession -ComputerName 49.12.189.108 -Credential (Get-Credential student)
   Set-SFTPItem -SessionId $session.SessionId -Path .\dist -Destination /home/student/backend/
   ```

3. Restart the process on the server:
   ```powershell
   Invoke-SSHCommand -SessionId $sshSession -Command `
     "/home/student/.npm/_npx/.../pm2/bin/pm2 restart jewish-backend"
   ```

> **Note:** The server uses SSH key authentication. The private key is at `C:\Users\User\.ssh\id_ed25519`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `PORT` | API port (default `3001`) |
| `DB_HOST` | Neon PostgreSQL host |
| `DB_PASS` | Database password |
| `JWT_SECRET` | Secret for signing JWTs (required — app will not start without it) |
| `CLOUDINARY_API_KEY` | Cloudinary image upload key |
| `MAIL_PASS` | SMTP password for password-reset emails |
| `NODE_ENV` | `development` or `production` |
| `CORS_ORIGINS` | Comma-separated allowed origins |
