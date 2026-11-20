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

## Assignment deployment (Render)

`render.yaml` deploys one free Node web service. Express serves the production Vue build, REST API,
SSE stream, and remote MCP endpoint from the same HTTPS origin. SQLite is ephemeral on Render Free;
the server initializes demo events whenever it starts with an empty database. Registrations and
created events can be lost when the instance restarts or redeploys.

1. Push the assignment branch to the GitHub repository.
2. Sign in to Render and connect the GitHub account that can access this repository.
3. In Render, create a **Blueprint** from `render.yaml` and deploy the `campus-events` service.
   Render will build the Vue app and generate the `MCP_AUTH_TOKEN` secret automatically.
4. After deployment, open the service URL. The frontend is at `/`, the API health check is
   `/api/health`, the SSE stream is `/api/events/stream`, and remote MCP uses
   `https://<service>.onrender.com/mcp` with Streamable HTTP.
5. To connect an external MCP client, copy `MCP_AUTH_TOKEN` from the Render service's
   environment settings into that client's secret store and send it as
   `Authorization: Bearer <MCP_AUTH_TOKEN>`. Never commit the production token or put it in a URL.

Render Free services can sleep when idle, so the first request after inactivity may take longer.
The SQLite file is stored under `api/data/` in the service's ephemeral filesystem and is seeded
with demo data on startup when empty. Data does not survive all restarts or deploys.

The service uses Render's HTTPS endpoint and generated secret for remote MCP authorization.
The public REST API remains public for the Vue app and its registration flows; attendee details
are not included in SSE messages.

Later parts need a few services. You never need them to run the tests.

| Service | Local | Setting in `api/.env` |
|---|---|---|
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
browser ──► web (Vite, :5173) ──/api/*──► api (Express, :3000) ──► SQLite
                                     ├── SSE: /api/events/stream
external MCP client ──HTTPS/Streamable HTTP──► /mcp (Bearer token)
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

### web/

```
api/          client.js (fetch + ApiError) and events.js (one function per endpoint)
views/        one component per page, registered in router.js
components/   reusable pieces: EventCard, SeatMeter, RegistrationForm, ErrorMessage
styles.css    design tokens at the top, change those first
```
