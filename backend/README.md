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

`npm run dev:backend` runs `backend/run.ps1`, which creates `backend/venv` when missing, installs backend dependencies when needed, copies `.env.example` to `.env` when missing, and starts Flask. Browser requests default to `http://localhost:5000`. Override with `CAMPUS_NEXUS_API_URL` for server-side page fetches and `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` for browser form submissions.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@localhost:5432/campus_nexus` | SQLAlchemy database URL loaded from `backend/.env`. |
| `NEO4J_URI` | required | Neo4j or Aura Bolt URI. |
| `NEO4J_USERNAME` | required | Neo4j username. |
| `NEO4J_PASSWORD` | required | Neo4j password. |
| `NEO4J_DATABASE` | `neo4j` | Neo4j database name. |
| `PORT` | `5000` | Flask port. |
| `FLASK_DEBUG` | unset | Set to `1` to enable Flask debug mode. |
| `CORS_ORIGIN` | `http://localhost:3000` | Exact frontend origin allowed to send the auth cookie. |
| `JWT_SECRET` | required | Secret used to sign JWTs; use at least 32 random characters. |
| `JWT_EXPIRES_HOURS` | `24` | JWT lifetime in hours. |
| `JWT_COOKIE_SECURE` | `0` | Set to `1` when serving the frontend and backend over HTTPS. |
| `ALLOWED_EMAIL_DOMAINS` | required | Comma-separated signup email domains; entries may optionally include `@` or a sample address. |

## Existing database migration

Apply the camelCase column migration once before deploying this version:

```powershell
psql $env:DATABASE_URL -f backend/migrations/001_camel_case_columns.sql
```

Apply the matching Neo4j property migration with Neo4j Browser or `cypher-shell`:

```powershell
cypher-shell -f backend/migrations/002_neo4j_camel_case.cypher
```

## Feed graph maintenance

Neo4j is the friendship source of truth. Bootstrap the graph once to import existing accepted PostgreSQL friendships:

```powershell
backend\venv\Scripts\python.exe backend\update_feed_graph.py --bootstrap
```

Run the normal update whenever PostgreSQL-backed users, clubs, memberships, followers, relationship weights, and PageRank should be reconciled:

```powershell
backend\venv\Scripts\python.exe backend\update_feed_graph.py
```

Friend and unfriend requests update Neo4j immediately. Other graph topology changes appear after the next normal update. Feed requests fall back to engagement and recency ranking when Neo4j is unavailable; friendship endpoints return `503`.

## Aggregate Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check. |
| `GET` | `/api/feed` | Feed cards, trending topics, and suggested people. |
| `GET` | `/api/clubs` | Spotlight clubs, club cards, and club stats. |
| `GET` | `/api/clubs/<slug>` | Club detail with club info, members, and club posts. |
| `GET` | `/api/clubs/<slug>/members` | Members for a club. |
| `GET` | `/api/games` | Game cards, top-rated games, and recent activity. |
| `GET` | `/api/marketplace` | Marketplace listings. |
| `GET` | `/api/messages` | Conversations and chat messages. |
| `POST` | `/api/auth/signup` | Create a student account with `email`, `username`, `name`, `dateOfBirth`, `department`, `yearOfStudy`, and `password`. |
| `POST` | `/api/auth/login` | Login with email or username and password. |
| `GET` | `/api/auth/me` | Return the authenticated user for a bearer token. |
| `POST` | `/api/auth/logout` | Acknowledge client-side logout. JWTs expire automatically. |
| `GET` | `/api/profile/<user>` | Stored profile when present, otherwise an empty default profile. |

The backend stores an HS256 JWT in the HttpOnly `campusNexusToken` cookie. Browser JavaScript stores only the returned user profile, never the token.

Startup also seeds an admin service account when missing:

```text
username: admin
name: Admin
mail: admin@cn.nhce
password: 12345678
```

Club creation and club management mutations require this admin account's bearer token. Regular users can read club data, but cannot create, update, or delete club records.

## CRUD Endpoints

Each collection supports `GET` and `POST`; each item endpoint supports `GET`, `PATCH`, `PUT`, and `DELETE`.

| Collection | Item |
| --- | --- |
| `/api/posts` | `/api/posts/<id>` |
| `/api/feed/trending` | `/api/feed/trending/<id>` |
| `/api/feed/suggested-people` | `/api/feed/suggested-people/<id>` |
| `/api/clubs/items` | `/api/clubs/items/<id>` |
| `/api/clubs/<slug>/members` | `/api/clubs/<slug>/members/<id>` |
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

`POST`, `PATCH`, `PUT`, and `DELETE` requests for `/api/clubs`, `/api/clubs/items`, `/api/clubs/spotlight`, and `/api/clubs/stats` require admin access.
Club member create, update, and delete requests under `/api/clubs/<slug>/members` also require admin access.
Club posts and announcements use `/api/posts` with `type: 1` or `type: 3` plus `clubSlug` or `clubId`; club leaders can publish both, and admins can grant or revoke a member's post access with `PATCH /api/clubs/<slug>/members/<id>` and `{"canPost": true|false}`.
Regular posts accept mixed image/MP4 arrays in `mediaUrls`; announcements require exactly one image in `mediaUrls` as their poster.
