# Campus Nexus Backend

Flask API for the local Campus Nexus app, backed by SQLAlchemy ORM models and SQLite. The aggregate endpoints keep the response shapes used by the Next.js frontend, while collection endpoints expose CRUD access to the persisted rows.

## Setup

```powershell
python -m venv backend\venv
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

The repo includes `backend/.env` for local development. Edit it to configure authentication, allowed email domains, or an optional custom SQLite path:

```powershell
notepad backend\.env
```

The backend explicitly loads `backend/.env`, creates `backend/campus_nexus.db` and any missing tables on startup, and leaves content tables empty. The development administrator identity is handled by the application and is not a persisted seed row.

## Run

```powershell
npm run dev:backend
```

`npm run dev:backend` runs `backend/run.ps1`, which creates `backend/venv` when missing, installs backend dependencies when needed, copies `.env.example` to `.env` when missing, and starts Flask. Browser requests default to `http://localhost:5000`. Override with `CAMPUS_NEXUS_API_URL` for server-side page fetches and `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL` for browser form submissions.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `backend/campus_nexus.db` | Optional SQLite SQLAlchemy URL loaded from `backend/.env`. |
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

## Feed graph maintenance

Neo4j is the friendship source of truth. Bootstrap the graph once to import existing accepted SQLite friendships:

```powershell
backend\venv\Scripts\python.exe backend\update_feed_graph.py --bootstrap
```

Run the normal update whenever SQLite-backed users, clubs, memberships, followers, relationship weights, and PageRank should be reconciled:

```powershell
backend\venv\Scripts\python.exe backend\update_feed_graph.py
```

Friend and unfriend requests update Neo4j immediately. Other graph topology changes appear after the next normal update. Feed requests fall back to engagement and recency ranking when Neo4j is unavailable; friendship endpoints return `503`.

## Backing up and synchronizing local data

To share a matched copy of both databases, stop the Flask backend, keep the configured Neo4j instance running, and run from the repository root:

```powershell
npm run dev:backup
```

This creates `backups\campus_nexus_snapshot_<timestamp>` with a SQLite backup, a logical Neo4j export, and a manifest containing file hashes and row counts. Copy the complete snapshot directory to the teammate's `backups\` directory through a secure channel. These files may contain credentials and private application data and must not be committed.

On the destination machine, stop Flask, start its local Neo4j instance, and run:

```powershell
npm run dev:sync
```

The latest compatible snapshot is selected by default. Use `npm run dev:sync -- --snapshot <directory>` to select one explicitly. Sync validates checksums, the expected SQLite table set, SQLite `integrity_check`, all SQLite foreign keys, Neo4j uniqueness, edge endpoints, and exact user/club agreement across stores before overwriting anything. SQLite is staged with a rollback copy; Neo4j is replaced in one transaction. A graph failure restores the previous SQLite file.

Only snapshots containing `campus_nexus.db`, `neo4j_graph.json`, and the version-2 `manifest.json` can be used by `dev:sync`. Older native `neo4j.dump` snapshots remain useful for manual disaster recovery but are intentionally not selected by this developer synchronization command.

## Importing a PostgreSQL backup

With PostgreSQL client tools installed, import a custom-format `pg_dump` archive directly into SQLite:

```powershell
backend\venv\Scripts\python.exe backend\import_postgres_dump.py backups\campus_nexus.dump
```

The command does not require a running PostgreSQL server. It creates and validates a temporary SQLite database, copies compatible table data, applies model defaults for newer columns, skips retired tables, and backs up the current `backend/campus_nexus.db` before replacing it. Stop the backend first so no SQLite WAL files are active.

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
| `DELETE` | `/api/signal-bar/<id>` | Delete a Signal Bar item (admin only). |
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
| `/api/signal-bar` | `GET`, `POST` | `PATCH`, `DELETE` |

The former denormalized collections under `/api/feed/trending`, `/api/feed/suggested-people`, `/api/clubs/spotlight`, `/api/clubs/stats`, `/api/games/top-rated`, and `/api/games/recent-activity` are not CRUD resources. Their collection reads return an empty compatibility array and mutations/item routes return `410`.

Compatibility aliases are preserved:

- `POST /api/clubs` creates a club card.
- `POST /api/marketplace` creates a marketplace item.
- `POST /api/marketplace/items` also creates a marketplace item.
- `GET /api/marketplace/items/<id>/interest` returns the signed-in user's interest state; `POST` expresses interest and notifies the seller once. Own, unavailable, and blocked listings reject interest.
- `GET /api/marketplace/interests` returns interest received on the signed-in seller's listings, including interested users and whether they can be messaged. The profile Marketplace tab displays this inbox; interest notifications link to it and can be dismissed from either view.
- Interest is stored in the new `marketplace_interests` SQLite table with one row per listing/user pair. Backend initialization creates the table on restart; no environment changes are required.

`POST`, `PATCH`, `PUT`, and `DELETE` requests for `/api/clubs` and `/api/clubs/items` require admin access.
Deleting a club permanently removes its club row, memberships, and follows so its name and slug can be reused. Its posts are soft-deleted and existing club chat threads are retained without the deleted club association.
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

Conversation responses include `unread`, the number of non-deleted incoming messages
after that participant's persisted `lastReadAt`. `GET /api/messages/unread` returns
`{"unreadFriends": N}`, counting distinct senders with unread messages, not total
messages. Both endpoints require authentication.

`POST /api/messages/conversations/<threadId>/read` with `{"messageId": 123}` marks
messages through the displayed message as read for the authenticated participant.
History requests do not change read status. The chat page acknowledges messages
only while visible, focused, and at the end of the conversation. This uses the
existing `chat_participants.lastReadAt` column; no schema migration is needed.

## Database schema

SQLite startup creates any missing tables directly from the SQLAlchemy metadata. The root `campus_nexus_schema.sql` file is a structure-only SQLite reference baseline; it contains no application data or migration marker.
