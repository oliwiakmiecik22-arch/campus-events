# Campus Events

Starter project for **Advanced Development** (Thomas More – International Experience Design, year 3).

A small but complete web app: students browse campus events and register for them.

- **api/** : REST API: Node.js, Express 5, Sequelize + SQLite/PostgreSQL, Zod
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
| Database | SQLite file | optional `DATABASE_URL` selects PostgreSQL |
| Confirmation email | disabled without configuration | `BREVO_API_KEY`, `EMAIL_FROM`, optional `EMAIL_TIMEOUT_MS` |
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

## Production deployment on Render

The production API serves the built Vue application, so one Render Web Service can host the complete
app on a single origin. The free deployment uses three services:

- the existing Render Free Web Service for Express and the built Vue files;
- Neon Free PostgreSQL for data that survives Render restarts and redeployments;
- Brevo Free Transactional Email API over HTTPS, because Render Free blocks SMTP ports.

Configure the existing Render service from the repository root:

| Render setting | Value |
|---|---|
| Runtime | Node |
| Root Directory | leave empty |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start -w api` |
| Health Check Path | `/api/health` |

Set these environment variables in the Render dashboard:

| Variable | Required value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Secret pooled connection string copied from Neon |
| `BREVO_API_KEY` | Secret API key generated in Brevo |
| `EMAIL_FROM` | Sender verified in Brevo, e.g. `Campus Events <address@example.com>` |
| `EMAIL_TIMEOUT_MS` | Optional; defaults to `3000` |
| `LOG_LEVEL` | Optional; defaults to `info` |

Render supplies `PORT`; it does not need a custom value. Do not set `DB_STORAGE` or `SMTP_URL` on
Render. Do not add `npm run seed` as a build or pre-deploy command: it is deliberately destructive.
Normal startup uses `sequelize.sync()` without `force`, so it creates missing tables without resetting
existing records. Demo data is added only when the events table is empty.

### Connect Neon

1. Create a Neon Free project and open its **Connect** panel.
2. Select the pooled connection and copy its connection string.
3. Save it as the secret `DATABASE_URL` in Render. Never commit it to a file.

PostgreSQL connections use TLS and verify Neon's certificate with the system certificate authorities;
the application never sets `rejectUnauthorized: false`. The Sequelize pool is limited to five
connections. Neon, rather than Render's ephemeral filesystem, stores the production records.

### Connect Brevo

1. Create a Brevo Free account and activate transactional email if Brevo asks for it.
2. Add a sender and verify its address or domain.
3. Generate an API key and save it as the secret `BREVO_API_KEY` in Render.
4. Set `EMAIL_FROM` in Render to the verified sender.

The application calls Brevo over HTTPS with a bounded timeout. Registration is already stored and
GET cache entries are already invalidated before the call begins. A missing key, provider error or
timeout therefore keeps the existing successful `201` response. Failed emails are not retried.

Render Free has no persistent disk, blocks SMTP ports and sleeps after inactivity. Neon and Brevo
also have free-tier limits. Review the current [Render Free limitations](https://render.com/docs/free),
[Neon plans](https://neon.com/docs/introduction/plans) and
[Brevo Free limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
before deployment.

### What has been tested

Automated API tests continue to use SQLite `:memory:` and never contact Neon or Brevo. Unit tests
verify PostgreSQL selection, certificate-verifying TLS options and Brevo request/error/timeout
behaviour with fake `fetch`. A real Neon connection and real Brevo delivery still need a manual
smoke test after the dashboard secrets are configured.

## How it fits together

```
local:      browser ──► Vite (:5173) ──/api/*──► Express (:3000) ──► SQLite
production: browser ──► Render Express + Vue ──► Neon PostgreSQL / Brevo HTTPS
```

In development Vite forwards every `/api/...` request to the API (see `web/vite.config.js`),
so the browser only talks to one address and you don't need CORS.

In production Express serves `web/dist` and returns its `index.html` for frontend history routes.
Unknown `/api` routes still return the JSON API error format.

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

Copy `api/.env.example` to `api/.env` and configure `BREVO_API_KEY` and a Brevo-verified
`EMAIL_FROM` to send a plain-text confirmation after a registration is saved. `EMAIL_TIMEOUT_MS`
sets the overall delivery timeout and defaults to 3000 ms. Missing configuration, provider errors
and timeouts do not undo the registration or change its successful `201` response.

Email delivery is best-effort: failures are logged without API credentials or raw provider errors.
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
