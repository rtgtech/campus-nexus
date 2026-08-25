# Campus Nexus

Campus Nexus is a student-focused campus social hub built with a Next.js frontend and a Flask backend backed by PostgreSQL through SQLAlchemy ORM models. It includes a campus feed, club discovery, student marketplace listings, games discovery, chat views, and profile pages.

## Quick Start

### Prerequisites

- Node.js 20 or newer
- npm
- Python 3.9 or newer
- PostgreSQL 14 or newer

### 1. Install frontend dependencies

```powershell
npm install
```

### 2. Install backend dependencies

```powershell
python -m venv backend\venv
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

### 3. Run the backend

Create a local database, then edit `backend/.env` if your local database password differs from the default URL.

```powershell
createdb campus_nexus
notepad backend\.env
```

```powershell
npm run dev:backend
```

The backend starts on `http://127.0.0.1:5000` by default.

### 4. Run the frontend

Open a second terminal:

```powershell
npm run dev
```

The frontend starts on `http://localhost:3000` by default.

## Common Commands

```powershell
npm run dev          # Start the Next.js development server
npm run dev:backend  # Start the Flask backend through backend/run.ps1
npm run build        # Build the Next.js app
npm run start        # Start the production Next.js server after a build
npm run lint         # Run linting if the local Next.js lint command is available
```

## Environment Variables

The app works with defaults for local development.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `CAMPUS_NEXUS_API_URL` | Next.js server components | `http://127.0.0.1:5000` | Backend base URL for server-side data fetches. |
| `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` | Browser/client components | `http://localhost:5000` | Backend base URL for form submissions from the browser. |
| `DATABASE_URL` | Flask backend, from `backend/.env` | `postgresql+psycopg://postgres:postgres@localhost:5432/campus_nexus` | SQLAlchemy database URL for persisted API data. |
| `NEO4J_URI` | Flask backend, from `backend/.env` | required | Neo4j or Aura Bolt URI for friendships and feed graph signals. |
| `NEO4J_USERNAME` | Flask backend, from `backend/.env` | required | Neo4j username. |
| `NEO4J_PASSWORD` | Flask backend, from `backend/.env` | required | Neo4j password. |
| `NEO4J_DATABASE` | Flask backend, from `backend/.env` | `neo4j` | Neo4j database name. |
| `ALLOWED_EMAIL_DOMAINS` | Flask backend, from `backend/.env` | required | Comma-separated email domains accepted at signup. |
| `PORT` | Flask backend | `5000` | Backend port. |
| `FLASK_DEBUG` | Flask backend | unset | Set to `1` to enable Flask debug mode. |
| `CORS_ORIGIN` | Flask backend | `*` | Allowed CORS origin returned by the API. |

Example:

```powershell
$env:CAMPUS_NEXUS_API_URL="http://127.0.0.1:5000"
$env:NEXT_PUBLIC_CAMPUS_NEXUS_API_URL="http://localhost:5000"
```

## Project Structure

```text
app/                         Next.js App Router pages and global layout
components/                  Shared UI and overlay components
lib/                         Frontend helpers, shared types, and empty fallback data
backend/                     Flask API
backend/app.py               Flask and SQLAlchemy API implementation
backend/requirements.txt     Python dependencies
package.json                 Frontend scripts and dependencies
```

## Frontend Overview

The frontend uses the Next.js App Router.

| Route | Purpose |
| --- | --- |
| `/` | Campus feed and post creation entry point. |
| `/clubs` | Club discovery and club creation entry point. |
| `/marketplace` | Student item listings. |
| `/games` | Game discovery page. |
| `/chat` | Chat view. |
| `/messages` | Messages page. |
| `/club` | Redirects to `/clubs`. |
| `/auth` | Login and student sign-up page. |
| `/[user]` | Dynamic profile page. |

Server-rendered pages fetch persisted data through `lib/campus-api.ts`. If the backend is unavailable, pages fall back to empty local data from `lib/app-data.ts` so the app shell still renders without sample content.

Client-side overlays submit directly to the Flask backend:

- `components/create-post-overlay.tsx` posts to `/api/posts`
- `components/create-club-overlay.tsx` posts to `/api/clubs`

Protected routes are enforced by `middleware.ts`. All app pages except `/auth` require a valid `campusNexusToken` cookie. The login and sign-up page stores the backend token in both `localStorage` and that cookie, and header logout controls clear both stores.

The backend seeds a common development account on startup:

```text
username: admin
password: 12345678
```

## Backend Overview

The backend is a Flask app in `backend/app.py`. It exposes JSON endpoints for the frontend, creates missing PostgreSQL tables on startup, and starts content tables empty. The only startup seed is the common `admin` account.

After configuring Neo4j, initialize the relationship graph once with `backend\venv\Scripts\python.exe backend\update_feed_graph.py --bootstrap`. Run the same command without `--bootstrap` whenever PostgreSQL-backed graph data and PageRank should be refreshed.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Backend health check. |
| `GET` | `/api/feed` | Feed cards, trending topics, and suggested people. |
| `POST` | `/api/posts` | Creates a persisted feed post. |
| `GET` | `/api/clubs` | Spotlight clubs, club cards, and club stats. |
| `POST` | `/api/clubs` | Compatibility alias that creates a persisted club card. |
| `GET` | `/api/games` | Game cards, top-rated games, and recent activity. |
| `GET` | `/api/marketplace` | Marketplace listings. |
| `POST` | `/api/marketplace` | Compatibility alias that creates a persisted marketplace item. |
| `POST` | `/api/marketplace/items` | Alias for creating a marketplace item. |
| `GET` | `/api/messages` | Conversations and chat messages. |
| `POST` | `/api/auth/signup` | Creates a student account and returns a session token. |
| `POST` | `/api/auth/login` | Verifies credentials and returns a session token. |
| `GET` | `/api/auth/me` | Returns the current authenticated user from a bearer token. |
| `POST` | `/api/auth/logout` | Invalidates the current bearer token. |
| `GET` | `/api/profile/<user>` | Stored profile data for a user identifier, or `404` when unknown. |

Persisted CRUD resources are users, posts, club items and members, game items, marketplace items, message items, and profiles. Direct conversations support create/read/delete; events support create/read/update/delete through their collection and item routes; Signal Bar currently supports create/read/update. See `backend/README.md` for the exact method matrix and authorization rules.

The old denormalized trending, suggested-people, spotlight, club-stats, top-rated, and recent-activity routes are compatibility endpoints rather than CRUD resources: collection reads are empty and mutations/item routes return `410`.

## Onboarding Notes

Start with these files:

1. `app/layout.tsx` for global fonts and app metadata.
2. `app/page.tsx` for the main feed page pattern.
3. `lib/campus-api.ts` for server-side backend calls and fallback behavior.
4. `lib/app-data.ts` for shared frontend payload types and empty fallback data.
5. `backend/app.py` for API payload shapes, route handlers, and database lifecycle code.

Important implementation details:

- Tailwind is compiled locally through `tailwind.config.js`, `postcss.config.js`, and `app/globals.css`.
- The backend uses SQLAlchemy directly rather than Flask-SQLAlchemy.
- Route protection validates the browser cookie token against `GET /api/auth/me`.
- The backend CORS policy defaults to `*` for local development convenience.
- Fallback frontend data is intentionally empty; real content should come from PostgreSQL through the API.
- Authentication exists, but no role or permission model has been added yet.

## Development Workflow

For UI work:

1. Run the backend and frontend together.
2. Update or add route files under `app/`.
3. Keep shared UI behavior in `components/`.
4. Add or adjust shared payload types and empty fallback shapes in `lib/app-data.ts` when a page should still render without the backend.
5. Mirror any new API payload shape in `backend/app.py`.

For API work:

1. Add or update the Flask route in `backend/app.py`.
2. Keep request parsing defensive; client forms may send empty values.
3. Return JSON responses with stable property names that match frontend types.
4. Update this README if a new endpoint, command, or environment variable is added.

## Current Limitations

- No role or permission model
- No real-time chat transport
- No marketplace payment or transaction handling
- No automated test suite currently defined in `package.json`

## Troubleshooting

### Frontend renders fallback data

Confirm the backend is running:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/health
```

If the backend runs on another port, set `CAMPUS_NEXUS_API_URL` and `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL`.

### Browser form submissions fail

Check that `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` points to the Flask backend and that the backend terminal is still running.

### Backend cannot connect to PostgreSQL

Confirm PostgreSQL is running, the `campus_nexus` database exists, and `DATABASE_URL` matches your local username, password, host, port, and database name.
