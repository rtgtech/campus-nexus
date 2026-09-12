# Campus Nexus

Campus Nexus is a campus social platform for student profiles, posts, clubs, events, marketplace listings, games, notifications, and direct messages.

The application has three runtime parts:

- Next.js 15 and React 19 frontend at `http://localhost:3000`
- Flask and SQLAlchemy API at `http://127.0.0.1:5000`
- SQLite for persistent application data, with Neo4j used for friendships and feed-graph signals

## Prerequisites

Install these tools before cloning the repository:

- [Git](https://git-scm.com/)
- Node.js 20 or newer with npm
- Python 3.10 or newer
- Neo4j or AuraDB if friendship and graph-ranking features are required
- Windows PowerShell for the automated backend startup script

The backend creates `backend/campus_nexus.db` and any missing tables automatically. The repository also includes the structure-only SQLite baseline in `campus_nexus_schema.sql` for reference.

## Clone and run on Windows

### 1. Clone the repository

```powershell
git clone https://github.com/rtgtech/campus-nexus.git
cd campus-nexus
```

If the repository is private, authenticate with GitHub before cloning or use the configured SSH remote.

### 2. Install frontend dependencies

```powershell
npm install
```

### 3. Prepare SQLite

No database service or manual schema command is required. On first backend startup, Campus Nexus creates `backend/campus_nexus.db` from the SQLAlchemy models. The database and its journal files are ignored by Git.

### 4. Configure the backend

Create the local environment file:

```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

At minimum, replace these values:

```dotenv
JWT_SECRET=replace-with-a-unique-random-secret-of-at-least-32-characters
ALLOWED_EMAIL_DOMAINS=your-college.edu
```

`DATABASE_URL` is optional. To keep the SQLite file elsewhere, set an SQLite URL such as `sqlite:///D:/data/campus_nexus.db`. PostgreSQL URLs are rejected.

If Neo4j is available, also configure:

```dotenv
NEO4J_URI=neo4j://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password
NEO4J_DATABASE=neo4j
```

Keep `backend/.env` private. It is ignored by Git and must never be committed.

### 5. Start the backend

```powershell
npm run dev:backend
```

On its first run, this command:

1. Creates `backend/venv`.
2. Copies `backend/.env.example` if `backend/.env` is still missing.
3. Installs the Python packages from `backend/requirements.txt` when required.
4. Creates or opens `backend/campus_nexus.db` and ensures its tables exist.
5. Starts Flask at `http://127.0.0.1:5000`.

Verify the backend from another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/health
```

A healthy database returns an HTTP `200` response.

### 6. Initialize Neo4j

Skip this step if only the SQLite-backed parts of the app are needed. Without Neo4j, feed requests degrade gracefully, while friendship operations and graph-specific behavior may be unavailable.

For an empty Neo4j database, bootstrap the graph once:

```powershell
backend\venv\Scripts\python.exe backend\update_feed_graph.py --bootstrap
```

For later synchronization runs:

```powershell
backend\venv\Scripts\python.exe backend\update_feed_graph.py
```

### Share a consistent development snapshot

Stop `npm run dev:backend` and keep Neo4j running, then create a matched SQLite and Neo4j snapshot:

```powershell
npm run dev:backup
```

The command writes a timestamped directory under `backups/` containing `campus_nexus.db`, `neo4j_graph.json`, and a checksummed `manifest.json`. Share that entire directory with your teammate through a secure channel; snapshots contain application data and are ignored by Git.

After placing the directory under `backups/` on another machine, stop that machine's backend, start its configured Neo4j instance, and overwrite both local databases from the newest compatible snapshot:

```powershell
npm run dev:sync
```

Select a particular snapshot when needed:

```powershell
npm run dev:sync -- --snapshot backups\campus_nexus_snapshot_YYYYMMDD_HHMMSS_microseconds
```

Before any overwrite, sync verifies file hashes, the expected SQLite table set, SQLite integrity and foreign keys, and agreement between active SQLite user/club IDs and Neo4j nodes and edges. SQLite is staged with a rollback copy, while the Neo4j replacement is a single transaction protected by uniqueness constraints. If validation or the graph transaction fails, the previous SQLite database is restored. A backup is rejected when the graph is stale; run `backend\venv\Scripts\python.exe backend\update_feed_graph.py` and retry.

### Import an existing PostgreSQL dump

Install the PostgreSQL client tools so `pg_restore` is available, then run:

```powershell
backend\venv\Scripts\python.exe backend\import_postgres_dump.py .\path\to\campus_nexus.dump
```

The importer reads a custom-format `pg_dump` archive without a running PostgreSQL server. It builds and validates a temporary SQLite database, imports current tables and columns, skips the retired `auth_sessions` table, and backs up the existing SQLite file before replacing it. Tables added after the dump remain empty and new columns receive their SQLAlchemy defaults.

### 7. Start the frontend

Keep the backend running and open a second terminal in the repository root:

```powershell
npm run dev
```

Open `http://localhost:3000` in a browser. The authentication page is available at `http://localhost:3000/auth`.

The local administrator account is:

```text
username: admin
password: 12345678
```

These credentials are for local development only and must be changed before any real deployment.

## macOS and Linux backend setup

The provided `npm run dev:backend` command uses the Windows-specific `backend/run.ps1`. On macOS or Linux, prepare and run the backend manually:

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
python backend/app.py
```

Edit `backend/.env` before the final command. The frontend commands remain the same:

```bash
npm install
npm run dev
```

## Frontend API configuration

No frontend environment file is required when the services use their default ports. If the backend is hosted elsewhere, create `.env.local` in the repository root:

```dotenv
CAMPUS_NEXUS_API_URL=http://127.0.0.1:5000
NEXT_PUBLIC_CAMPUS_NEXUS_API_URL=http://localhost:5000
```

- `CAMPUS_NEXUS_API_URL` is used by server-rendered Next.js code and middleware.
- `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` is used by browser-side forms and API clients.
- `CORS_ORIGIN` in `backend/.env` must match the browser-visible frontend origin exactly.

Restart the frontend after changing `.env.local`.

## Environment variables

### Backend: `backend/.env`

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | No | `backend/campus_nexus.db` | Optional SQLite SQLAlchemy URL. |
| `JWT_SECRET` | Yes | None | JWT signing secret; must contain at least 32 characters. |
| `ALLOWED_EMAIL_DOMAINS` | Yes | Empty | Comma-separated signup email domains. |
| `NEO4J_URI` | For graph features | None | Neo4j Bolt URI. |
| `NEO4J_USERNAME` | For graph features | None | Neo4j username. |
| `NEO4J_PASSWORD` | For graph features | None | Neo4j password. |
| `NEO4J_DATABASE` | No | `neo4j` | Neo4j database name. |
| `PORT` | No | `5000` | Flask API port. |
| `FLASK_DEBUG` | No | Disabled | Set to `1` for Flask debug mode. |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Comma-separated frontend origins allowed by the API. |
| `JWT_EXPIRES_HOURS` | No | `24` | Authentication token lifetime. |
| `JWT_COOKIE_SECURE` | No | `0` | Set to `1` when using HTTPS. |

### Frontend: `.env.local`

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `CAMPUS_NEXUS_API_URL` | No | `http://127.0.0.1:5000` | Server-side API URL. |
| `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` | No | `http://localhost:5000` | Browser-side API URL. |

## Common commands

Run these commands from the repository root:

```powershell
npm run dev
npm run dev:backend
npm run dev:backup
npm run dev:sync
npm run build
npm run start
node --test lib/post-time.test.mjs
backend\venv\Scripts\python.exe -m unittest discover -s backend\tests -p "test_*.py"
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run dev:backend` | Prepare and start the Flask backend on Windows. |
| `npm run dev:backup` | Create a validated, matched SQLite and Neo4j snapshot. |
| `npm run dev:sync` | Overwrite both local databases from the latest validated snapshot. |
| `npm run build` | Create and validate a production frontend build. |
| `npm run start` | Run the production frontend after a successful build. |
| `node --test lib/post-time.test.mjs` | Run the focused frontend utility test documented by the project. |
| `backend\venv\Scripts\python.exe -m unittest discover -s backend\tests -p "test_*.py"` | Run all backend tests. |

## Project structure

```text
app/                    Next.js App Router pages, layouts, and global CSS
components/             Reusable React components and UI primitives
lib/                    Frontend API clients, shared types, and utilities
backend/                Flask API, SQLAlchemy models, graph integration, and tests
backend/schema_app.py   Current relational models and API implementation
backend/graph_store.py  Neo4j persistence operations
backend/tests/          Python unittest suite
campus_nexus_schema.sql Structure-only SQLite schema reference
DATABASE_ERD.md         Mermaid diagrams of the relational schema
```

See [backend/README.md](backend/README.md) for API endpoints and backend behavior. See [DATABASE_ERD.md](DATABASE_ERD.md) for the current database relationships.

## Troubleshooting

### Backend rejects `DATABASE_URL`

Remove an old PostgreSQL URL from `backend/.env`, or replace it with an SQLite URL. When the variable is unset, the backend uses `backend/campus_nexus.db`.

### SQLite reports that the database is locked

Stop duplicate backend processes and confirm the account running Flask can write to `backend/` or to the directory containing the configured database. SQLite uses WAL mode and waits up to 30 seconds for competing writes.

### Frontend shows fallback or empty data

Check the backend health endpoint and confirm both frontend API URLs point to Flask. Restart Next.js after changing `.env.local`.

### Browser mutations return a CORS or origin error

Set `CORS_ORIGIN` to the exact frontend origin, normally `http://localhost:3000`, and restart Flask.

### Friendship operations return `503`

Confirm Neo4j is running, verify all `NEO4J_*` values, and bootstrap or synchronize the graph.

### PowerShell blocks the backend script

Run the script directly with the same execution-policy override used by npm:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend\run.ps1
```

## Production notes

- Replace the development administrator password before deployment.
- Use a unique, randomly generated `JWT_SECRET` containing at least 32 characters.
- Set `JWT_COOKIE_SECURE=1` behind HTTPS.
- Restrict `CORS_ORIGIN` to trusted frontend origins.
- Keep SQLite database files, Neo4j data, `.env`, backups, and credentials outside version control.
- Run `npm run build` and the backend test suite before deploying.
