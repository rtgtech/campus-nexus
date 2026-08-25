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
$psqlUrl = $env:DATABASE_URL -replace '^postgresql\+psycopg://', 'postgresql://'
psql $psqlUrl -v ON_ERROR_STOP=1 -f backend/migrations/001_camel_case_columns.sql
```

Apply the matching Neo4j property migration with Neo4j Browser or `cypher-shell`:

```powershell
cypher-shell -f backend/migrations/002_neo4j_camel_case.cypher
```

Apply the saved-posts migration before deploying the bookmark API:

```powershell
$psqlUrl = $env:DATABASE_URL -replace '^postgresql\+psycopg://', 'postgresql://'
psql $psqlUrl -v ON_ERROR_STOP=1 -f backend/migrations/002_saved_posts.postgresql
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
| `GET` | `/api/saved-posts` | Posts saved by the authenticated user. |
| `GET,POST,DELETE` | `/api/posts/<id>/save` | Read, save, or unsave a post for the authenticated user. |
| `GET` | `/api/clubs` | Spotlight clubs, club cards, and club stats. |
| `GET` | `/api/clubs/<slug>` | Club detail with club info, members, and club posts. |
| `GET` | `/api/clubs/<slug>/members` | Members for a club. |
| `GET` | `/api/games` | Game cards, top-rated games, and recent activity. |
| `GET` | `/api/marketplace` | Marketplace listings. |
| `GET` | `/api/messages` | Conversations and chat messages. |
| `GET` | `/api/signal-bar` | Ordered Signal Bar titles and links. |
| `POST` | `/api/signal-bar` | Create a Signal Bar item (admin only). |
| `PATCH` | `/api/signal-bar/<id>` | Update a Signal Bar item (admin only). |
| `GET` | `/api/users/<identifier>/profile-overview` | Consolidated profile, stats, badges, clubs, marketplace trust, and owner preferences. |
| `GET` | `/api/users/<identifier>/clubs` | Club memberships and owner-only followed clubs. |
| `GET` | `/api/users/<identifier>/badges` | Earned and locked badge definitions. |
| `GET,PATCH` | `/api/users/<identifier>/preferences` | Owner/admin notification and privacy preferences. |
| `POST` | `/api/auth/signup` | Create a student account with `email`, `username`, `name`, `dateOfBirth`, `department`, `yearOfStudy`, and `password`. |
| `POST` | `/api/auth/login` | Login with email or username and password. |
| `GET` | `/api/auth/me` | Return the authenticated user for a bearer token. |
| `POST` | `/api/auth/logout` | Acknowledge client-side logout. JWTs expire automatically. |
| `GET` | `/api/profile/<user>` | Stored profile, or `404` when the user is unknown. |
| `GET` | `/health` | Database-aware readiness check; returns `503` until the required schema migration is present. |

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

Persisted resource endpoints expose the following lifecycles:

| Resource | Collection methods | Item methods |
| --- | --- | --- |
| `/api/users` | `GET`, `POST` | `GET`, `PATCH`, `PUT`, `DELETE` |
| `/api/posts` | `GET`, `POST` | `GET`, `PATCH`, `PUT`, `DELETE` |
| `/api/clubs/items` | `GET`, `POST` | `GET`, `PATCH`, `PUT`, `DELETE` |
| `/api/clubs/<slug>/members` | `GET`, `POST` | `GET`, `PATCH`, `PUT`, `DELETE` |
| `/api/games/items` | `GET`, `POST` | `GET`, `PATCH`, `PUT`, `DELETE` |
| `/api/marketplace/items` | `GET`, `POST` | `GET`, `PATCH`, `PUT`, `DELETE` |
| `/api/messages/conversations` | `GET`, `POST` | `GET`, `DELETE` |
| `/api/messages/items` | `GET`, `POST` | `GET`, `PATCH`, `PUT`, `DELETE` |
| `/api/profiles` | `GET`, `POST` | `GET`, `PATCH`, `PUT`, `DELETE` (resets profile fields) |
| `/api/events` | `GET`, `POST` | `PATCH`, `DELETE` |
| `/api/signal-bar` | `GET`, `POST` | `PATCH` |

The former denormalized collections under `/api/feed/trending`, `/api/feed/suggested-people`, `/api/clubs/spotlight`, `/api/clubs/stats`, `/api/games/top-rated`, and `/api/games/recent-activity` are not CRUD resources. Their collection reads return an empty compatibility array and mutations/item routes return `410`.

Compatibility aliases are preserved:

- `POST /api/clubs` creates a club card.
- `POST /api/marketplace` creates a marketplace item.
- `POST /api/marketplace/items` also creates a marketplace item.

`POST`, `PATCH`, `PUT`, and `DELETE` requests for `/api/clubs` and `/api/clubs/items` require admin access.
Club member create, update, and delete requests under `/api/clubs/<slug>/members` also require admin access.
Club posts and announcements use `/api/posts` with `type: 1` or `type: 3` plus `clubSlug` or `clubId`; club leaders can publish both, and admins can grant or revoke a member's post access with `PATCH /api/clubs/<slug>/members/<id>` and `{"canPost": true|false}`.
Regular posts accept mixed image/MP4 arrays in `mediaUrls`; announcements require exactly one image in `mediaUrls` as their poster.

Student account creation remains public through `POST /api/auth/signup`. The lower-level `POST /api/users` endpoint is admin-only because it does not accept a login password. Creating a post requires a student session and always binds the post to the authenticated student. Updating or deleting a post requires its owner or an administrator. Creating, updating, and deleting game records requires administrator access.

Profile and user mutations require the profile owner or administrator. `GET /api/posts` accepts `authorId`, `limit`, and `cursor`. `GET /api/marketplace` accepts `sellerId`, `status`, `limit`, and `cursor`, includes `sellerId` on each item, and returns `sellerSummary` when filtering by a seller.

Direct conversations require authentication and are created idempotently with:

```http
POST /api/messages/conversations
Content-Type: application/json

{"participantUserId": "42", "threadType": "direct"}
```

Only thread participants can read a conversation or create messages in it.

## Schema migration

New databases can use the root `campus_nexus_schema.sql`. Existing PostgreSQL databases must apply `backend/migrations/001_frontend_api_requirements.postgresql` before starting the updated backend. Startup now validates the required tables, columns, time-zone-aware timestamps, and migration marker instead of attempting to upgrade an existing database with `create_all()`.

The migration is transactional and idempotent. It also repairs databases where SQLAlchemy already created the new tables with naive timestamps, missing server defaults, or missing cascade actions. Apply it with PostgreSQL's client after taking a database backup:

```powershell
$psqlUrl = $env:DATABASE_URL -replace '^postgresql\+psycopg://', 'postgresql://'
psql $psqlUrl -v ON_ERROR_STOP=1 -f backend/migrations/001_frontend_api_requirements.postgresql
```

An opt-in PostgreSQL integration test creates and removes an isolated schema and runs the migration twice. Point it only at a disposable test database:

```powershell
$env:TEST_POSTGRES_DATABASE_URL="postgresql://user:password@localhost:5432/campus_nexus_test"
backend\venv\Scripts\python.exe -m unittest backend.tests.test_postgresql_migration -v
```
