# Campus Nexus

Campus Nexus is a student-focused campus social hub built with a Next.js frontend and a lightweight Flask demo backend. It includes a campus feed, club discovery, student marketplace listings, games discovery, chat views, and profile pages.

The current backend is intentionally simple: it stores data in memory and resets whenever the Flask process restarts. Treat it as a demo API, not a production persistence layer.

## Quick Start

### Prerequisites

- Node.js 20 or newer
- npm
- Python 3.9 or newer

### 1. Install frontend dependencies

```powershell
npm install
```

### 2. Install backend dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

### 3. Run the backend

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
npm run dev:backend  # Start the Flask demo backend
npm run build        # Build the Next.js app
npm run start        # Start the production Next.js server after a build
npm run lint         # Run linting if the local Next.js lint command is available
```

## Environment Variables

The app works with defaults for local development.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `CAMPUS_NEXUS_API_URL` | Next.js server components | `http://127.0.0.1:5000` | Backend base URL for server-side data fetches. |
| `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` | Browser/client components | `http://127.0.0.1:5000` | Backend base URL for form submissions from the browser. |
| `PORT` | Flask backend | `5000` | Backend port. |
| `FLASK_DEBUG` | Flask backend | unset | Set to `1` to enable Flask debug mode. |
| `CORS_ORIGIN` | Flask backend | `*` | Allowed CORS origin returned by the demo API. |

Example:

```powershell
$env:CAMPUS_NEXUS_API_URL="http://127.0.0.1:5000"
$env:NEXT_PUBLIC_CAMPUS_NEXUS_API_URL="http://127.0.0.1:5000"
```

## Project Structure

```text
app/                         Next.js App Router pages and global layout
components/                  Shared UI and overlay components
lib/                         Frontend helpers and demo fallback data
backend/                     Flask demo API
backend/app.py               In-memory API implementation
backend/requirements.txt     Python dependencies
FUNCTIONAL_NON_FUNCTIONAL_REQUIREMENTS.md
                             Product and system requirements
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
| `/[user]` | Dynamic profile page. |

Server-rendered pages fetch demo data through `lib/campus-api.ts`. If the backend is unavailable, pages fall back to local demo data from `lib/demo-data.ts`.

Client-side overlays submit directly to the Flask backend:

- `components/create-post-overlay.tsx` posts to `/api/posts`
- `components/create-club-overlay.tsx` posts to `/api/clubs`

## Backend Overview

The backend is a Flask app in `backend/app.py`. It exposes JSON endpoints for the demo frontend and keeps all records in process memory.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Backend health check. |
| `GET` | `/api/feed` | Feed cards, trending topics, and suggested people. |
| `POST` | `/api/posts` | Creates an in-memory feed post. |
| `GET` | `/api/clubs` | Spotlight clubs, club cards, and club stats. |
| `POST` | `/api/clubs` | Creates an in-memory club. |
| `GET` | `/api/games` | Game cards, top-rated games, and recent activity. |
| `GET` | `/api/marketplace` | Marketplace listings. |
| `POST` | `/api/marketplace` | Creates an in-memory marketplace item. |
| `POST` | `/api/marketplace/items` | Alias for creating a marketplace item. |
| `GET` | `/api/messages` | Conversations and sample chat messages. |
| `GET` | `/api/profile/<user>` | Demo profile data for a user slug. |

## Onboarding Notes

Start with these files:

1. `FUNCTIONAL_NON_FUNCTIONAL_REQUIREMENTS.md` for product scope and expected behavior.
2. `app/layout.tsx` for global fonts and app metadata.
3. `app/page.tsx` for the main feed page pattern.
4. `lib/campus-api.ts` for server-side backend calls and fallback behavior.
5. `backend/app.py` for API payload shapes and demo data.

Important implementation details:

- Tailwind is compiled locally through `tailwind.config.js`, `postcss.config.js`, and `app/globals.css`.
- The backend has no database. New posts, clubs, and marketplace items disappear after restart.
- The backend CORS policy defaults to `*` for local demo convenience.
- Images in the demo data mostly reference remote URLs.
- There is no authentication or authorization layer in the current demo.

## Development Workflow

For UI work:

1. Run the backend and frontend together.
2. Update or add route files under `app/`.
3. Keep shared UI behavior in `components/`.
4. Add or adjust fallback demo data in `lib/demo-data.ts` when a page should still render without the backend.
5. Mirror any new API payload shape in `backend/app.py`.

For API work:

1. Add or update the Flask route in `backend/app.py`.
2. Keep request parsing defensive; client forms may send empty values.
3. Return JSON responses with stable property names that match frontend types.
4. Update this README if a new endpoint, command, or environment variable is added.

## Current Limitations

- No persistent database
- No authentication
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

### Backend changes disappear

That is expected for created records. The backend stores demo data in memory only.
