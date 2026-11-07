# Campus Events

Starter project for **Advanced Development** (Thomas More – International Experience Design, year 3).

A small but complete web app: students browse campus events and register for them.

- **api/** : REST API: Node.js, Express 5, Sequelize + SQLite, Zod
- **web/** : frontend: Vue 3, Vue Router, Vite

It works out of the box, and it has tests. It is also the kind of code you will meet in your first job:
the whole API is one long file. Your job is to **clean it up, ship it to production, fix it and add the hard
parts**

## Quick start

You need **Node.js 22.12 or newer** (`node -v`) and Git.

```bash
git clone <your-fork-url>
cd campus-events
npm install        # installs api + web in one go
npm run dev        # starts both
```

Open **http://localhost:5173**. The API runs on http://localhost:3000/api.
The first start fills the database with demo events. `npm run seed` resets it.

Later parts need a few services. You never need them to run the tests.

| Service | Local | Setting in `api/.env` |
|---|---|---|
| SMTP email | your SMTP provider | `SMTP_URL`, `EMAIL_FROM`, optional `EMAIL_TIMEOUT_MS` |
| RabbitMQ | `docker compose up -d rabbitmq` | `AMQP_URL` |
| Redis | `docker compose up -d redis` | `REDIS_URL` |
| Identity provider | a free Auth0 tenant | `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_CLIENT_ID` |

## Scripts (run from the root folder)

| Script | What it does |
|---|---|
| `npm run dev` | API + frontend with auto-reload |
| `npm test` | All tests: API (node:test + supertest) and frontend (Vitest) |
| `npm run lint` | ESLint for the whole project |
| `npm run check` | Lint + tests. **The pipeline runs exactly this. It must be green before you hand in.** |
| `npm run seed` | Reset the database to the demo data |
| `npm run build` | Production build of the frontend |

## How it fits together

```
browser ──► web (Vite, :5173) ──/api/*──► api (Express, :3000) ──► SQLite (api/data/events.sqlite)
```

In development Vite forwards every `/api/...` request to the API (see `web/vite.config.js`),
so the browser only talks to one address and you don't need CORS.

### api/

**Today** the whole API lives in one file:

```
api/src/app.mjs      settings, database + models, validation, routes, business rules, error handling
api/src/server.mjs   starts the app (and adds demo data to an empty database)
api/src/seed.mjs     npm run seed: reset the database
```

Prefered:

```
routes/        URL + validation → controller        (no logic)
controllers/   HTTP in/out, picks the status code    (thin)
services/      business rules, throws AppErrors      (no Express, no SQL)
repositories/  data access via Sequelize             (no rules)
models/ db/    tables, connection, demo data
config/        the only place that reads process.env
```

The integration tests in `api/tests/integration` only talk HTTP. They pass before your refactoring,
and they must still pass after it, without changing them.

| Method | URL | |
|---|---|---|
| GET | `/api/health` | Health check |
| GET / POST | `/api/events` | List / create |
| GET / PATCH / DELETE | `/api/events/:id` | One event (incl. `registered`, `spotsLeft`) |
| GET / POST | `/api/events/:id/registrations` | List / register `{ name, email }` |
| GET | `/api/stats` | Occupancy per event |

Errors always have this shape: `{ "error": { "code", "message", "details?" } }`.

#### Registration confirmation email

Copy `api/.env.example` to `api/.env` and configure `SMTP_URL` and `EMAIL_FROM` to send a
plain-text confirmation after a registration is saved. `EMAIL_TIMEOUT_MS` sets the overall delivery
timeout and defaults to 3000 ms. Missing configuration, provider errors and timeouts do not undo the
registration or change its successful `201` response.

Email delivery is best-effort: failures are logged without SMTP credentials or raw provider errors.
Failed messages are not queued or retried automatically.

#### GET response cache

Successful event lists, event details, event registrations and stats are cached in memory for up to
5 seconds. The cache holds at most 100 entries. Health checks and error responses are never cached.

Creating, updating or deleting an event immediately clears every affected entry. Saving a
registration clears its event detail, registration list and stats before confirmation email delivery
starts. Stats also expire when the next future event starts, so an event can change from `open` to
`past` without waiting for the full cache TTL.

This cache belongs to one Node.js process: it is empty after a restart and is not shared between
multiple API instances.

### web/

```
api/          client.js (fetch + ApiError) and events.js (one function per endpoint)
views/        one component per page, registered in router.js
components/   reusable pieces: EventCard, SeatMeter, RegistrationForm, ErrorMessage
styles.css    design tokens at the top, change those first
```
