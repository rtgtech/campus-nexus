# Campus Nexus Backend

Flask API for the local Campus Nexus app, backed by SQLAlchemy ORM models and PostgreSQL. The aggregate endpoints keep the response shapes used by the Next.js frontend, while collection endpoints expose CRUD access to the persisted rows.

## Setup

```powershell
python -m venv backend\venv
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Create a local PostgreSQL database:

```powershell
createdb campus_nexus
```

The repo includes `backend/.env` for local development. Edit it if your local database password differs from the default URL:

```powershell
notepad backend\.env
```

The backend explicitly loads `backend/.env`, creates missing tables on startup, and leaves content tables empty. The only startup seed is the common development account.

## Run

```powershell
npm run dev:backend
```

`npm run dev:backend` runs `backend/run.ps1`, which creates `backend/venv` when missing, installs backend dependencies when needed, copies `.env.example` to `.env` when missing, and starts Flask. The frontend defaults to `http://127.0.0.1:5000`. Override with `CAMPUS_NEXUS_API_URL` for server-side page fetches and `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` for browser form submissions.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@localhost:5432/campus_nexus` | SQLAlchemy database URL loaded from `backend/.env`. |
| `PORT` | `5000` | Flask port. |
| `FLASK_DEBUG` | unset | Set to `1` to enable Flask debug mode. |
| `CORS_ORIGIN` | `*` | Allowed CORS origin. |

## Aggregate Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check. |
| `GET` | `/api/feed` | Feed cards, trending topics, and suggested people. |
| `GET` | `/api/clubs` | Spotlight clubs, club cards, and club stats. |
| `GET` | `/api/games` | Game cards, top-rated games, and recent activity. |
| `GET` | `/api/marketplace` | Marketplace listings. |
| `GET` | `/api/messages` | Conversations and chat messages. |
| `POST` | `/api/auth/signup` | Create a student account with email, name, profile photo, date of birth, department, year, and password. |
| `POST` | `/api/auth/login` | Login with email or username and password. |
| `GET` | `/api/auth/me` | Return the authenticated user for a bearer token. |
| `POST` | `/api/auth/logout` | Delete the authenticated session token. |
| `GET` | `/api/profile/<user>` | Stored profile when present, otherwise an empty default profile. |

The Next.js frontend stores the returned token in a `campusNexusToken` cookie for route middleware and in `localStorage` as `campusNexusAuth` for client-side header state.

Startup also seeds a common development account when missing:

```text
username: admin
password: 12345678
```

## CRUD Endpoints

Each collection supports `GET` and `POST`; each item endpoint supports `GET`, `PATCH`, `PUT`, and `DELETE`.

| Collection | Item |
| --- | --- |
| `/api/posts` | `/api/posts/<id>` |
| `/api/feed/trending` | `/api/feed/trending/<id>` |
| `/api/feed/suggested-people` | `/api/feed/suggested-people/<id>` |
| `/api/clubs/items` | `/api/clubs/items/<id>` |
| `/api/clubs/spotlight` | `/api/clubs/spotlight/<id>` |
| `/api/clubs/stats` | `/api/clubs/stats/<id>` |
| `/api/games/items` | `/api/games/items/<id>` |
| `/api/games/top-rated` | `/api/games/top-rated/<id>` |
| `/api/games/recent-activity` | `/api/games/recent-activity/<id>` |
| `/api/marketplace/items` | `/api/marketplace/items/<id>` |
| `/api/messages/conversations` | `/api/messages/conversations/<id>` |
| `/api/messages/items` | `/api/messages/items/<id>` |
| `/api/profiles` | `/api/profiles/<user>` |

Compatibility aliases are preserved:

- `POST /api/clubs` creates a club card.
- `POST /api/marketplace` creates a marketplace item.
- `POST /api/marketplace/items` also creates a marketplace item.
