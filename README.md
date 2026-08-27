# Campus Nexus

Campus Nexus is a campus social platform for student profiles, posts, clubs, events, marketplace listings, games, notifications, and direct messages.

The application has three runtime parts:

- Next.js 15 and React 19 frontend at `http://localhost:3000`
- Flask and SQLAlchemy API at `http://127.0.0.1:5000`
- PostgreSQL for persistent application data, with Neo4j used for friendships and feed-graph signals

## Prerequisites

Install these tools before cloning the repository:

- [Git](https://git-scm.com/)
- Node.js 20 or newer with npm
- Python 3.10 or newer
- PostgreSQL 14 or newer
- Neo4j or AuraDB if friendship and graph-ranking features are required
- Windows PowerShell for the automated backend startup script

The PostgreSQL database must already contain the current Campus Nexus schema and the `004_department_options` entry in `schema_migrations`. The backend validates this schema but does not create or migrate a blank PostgreSQL database. Obtain a current schema-only dump or database backup from the project maintainer before setting up a new machine.

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

### 3. Prepare PostgreSQL

Create the database if it does not exist:

```powershell
createdb campus_nexus
```

Restore the current schema or backup supplied by the project maintainer. For a schema SQL file, the command is:

```powershell
psql -d campus_nexus -v ON_ERROR_STOP=1 -f C:\path\to\campus_nexus_schema.sql
```

Confirm that the final schema marker exists:

```powershell
psql -d campus_nexus -c 'SELECT version FROM schema_migrations ORDER BY version;'
```

The result must include `004_department_options`.

### 4. Configure the backend

Create the local environment file:

```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

At minimum, replace these values:

```dotenv
DATABASE_URL=postgresql+psycopg://postgres:your-password@localhost:5432/campus_nexus
JWT_SECRET=replace-with-a-unique-random-secret-of-at-least-32-characters
ALLOWED_EMAIL_DOMAINS=your-college.edu
```

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
4. Starts Flask at `http://127.0.0.1:5000`.

Verify the backend from another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/health
```

A healthy database returns an HTTP `200` response.

### 6. Initialize Neo4j

Skip this step if only the PostgreSQL-backed parts of the app are needed. Without Neo4j, feed requests degrade gracefully, while friendship operations and graph-specific behavior may be unavailable.

For an empty Neo4j database, bootstrap the graph once:

```powershell
backend\venv\Scripts\python.exe backend\update_feed_graph.py --bootstrap
```

For later synchronization runs:

```powershell
backend\venv\Scripts\python.exe backend\update_feed_graph.py
```

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
| `DATABASE_URL` | Yes | Local PostgreSQL URL | SQLAlchemy connection string. |
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
npm run build
npm run start
node --test lib/post-time.test.mjs
backend\venv\Scripts\python.exe -m unittest discover -s backend\tests -p "test_*.py"
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run dev:backend` | Prepare and start the Flask backend on Windows. |
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
DATABASE_ERD.md         Mermaid diagrams of the relational schema
```

See [backend/README.md](backend/README.md) for API endpoints and backend behavior. See [DATABASE_ERD.md](DATABASE_ERD.md) for the current database relationships.

## Troubleshooting

### Backend reports that the database schema is not ready

The configured PostgreSQL database is blank, incomplete, or does not record `004_department_options`. Restore a current schema-complete backup and verify that `DATABASE_URL` selects the expected database.

### PostgreSQL authentication fails

Confirm that PostgreSQL is running and that the username, password, host, port, and database in `DATABASE_URL` are correct. Special characters in credentials must be URL-encoded.

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
- Keep PostgreSQL, Neo4j, `.env`, backups, and credentials outside version control.
- Run `npm run build` and the backend test suite before deploying.
