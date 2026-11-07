# Campus Events

Campus Events is a full-stack application for browsing campus events, checking available places and
registering participants. It has a Vue frontend and an Express REST API. The deployed application
uses the same origin for the frontend and API.

- **Live application:** https://campus-events-api-0omf.onrender.com
- **Submission branch:** https://github.com/oliwiakmiecik22-arch/campus-events/tree/feature/render-deployment

## Main features

- list events and view event details;
- create, update and delete events through the API;
- register a participant with duplicate and capacity checks;
- send a plain-text registration confirmation through Brevo;
- calculate event occupancy statistics;
- cache successful GET data with mutation-aware invalidation;
- serve the production Vue build from Express with Vue Router history fallback.

## Technology

- **API:** Node.js 22, Express 5, Sequelize 6, Zod, Winston
- **Frontend:** Vue 3, Vue Router, Vite
- **Local and test database:** SQLite
- **Production database:** Neon PostgreSQL
- **Production email:** Brevo Transactional Email API over HTTPS
- **Tests:** `node:test`, Supertest, Vitest and Vue Test Utils

## Local setup

Node.js 22.12 or newer and Git are required.

```bash
git clone https://github.com/oliwiakmiecik22-arch/campus-events.git
cd campus-events
git switch feature/render-deployment
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to the Express API at
http://localhost:3000. The first API start creates the local SQLite tables and adds demo events if
the events table is empty.

Email is optional in local development. To configure it, copy `api/.env.example` to `api/.env` and
fill in your own Brevo values. Tests do not need credentials and never contact Neon or Brevo.

`npm run seed` deliberately resets the selected database. It is intended for local development only
and must not be used as a production build, pre-deploy or start command.

### Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API and Vite development servers |
| `npm run check` | Run ESLint and all API/frontend tests |
| `npm test` | Run all tests without lint |
| `npm run build` | Build the production Vue application |
| `npm run seed` | Destructively reset the selected database with demo data |

### Environment variables

Only `api/src/config/env.mjs` reads `process.env`.

| Variable | Use |
|---|---|
| `NODE_ENV` | Use `production` on Render |
| `PORT` | API port; Render supplies it automatically |
| `LOG_LEVEL` | Optional Winston log level; defaults to `info` |
| `DB_STORAGE` | Local SQLite path; defaults to `./data/events.sqlite` |
| `DATABASE_URL` | PostgreSQL connection URL; when present it takes precedence over SQLite |
| `BREVO_API_KEY` | Secret key for the Brevo HTTPS API |
| `EMAIL_FROM` | Sender address verified in Brevo |
| `EMAIL_TIMEOUT_MS` | Overall email timeout; defaults to `3000` ms |

Never commit real environment files, connection URLs or API keys.

## Layered API architecture

The API follows this request flow:

```text
route → validation → controller → service → repository → Sequelize model → database
```

- `routes/` declares URLs, validation middleware and controllers.
- `controllers/` translates HTTP requests and service results into status codes and response bodies.
- `services/` contains application rules, cache decisions and orchestration. Services do not import
  Express or Sequelize.
- `repositories/` is the only layer that accesses models.
- `models/` defines Sequelize models and associations.
- `validation/` contains Zod schemas.
- `middleware/` handles validation, errors, logging and the production SPA fallback.
- `config/` contains environment, database, path and logger configuration.

API errors keep the common shape:

```json
{ "error": { "code": "...", "message": "..." } }
```

Validation errors can also include a `details` array.

## Registration and confirmation email flow

Registration deliberately treats the database as more important than email delivery:

1. load the event;
2. reject a duplicate email;
3. reject the registration when `count >= capacity`;
4. save the registration;
5. immediately invalidate the event detail, registration list and statistics cache entries;
6. attempt the Brevo HTTPS request;
7. return the existing successful `201` response.

The Brevo sender is injectable, so automated tests use a fake `fetch` and never contact the real
provider. The email contains the event title, date and location in plain text.

The overall email timeout defaults to about three seconds. On timeout, `AbortController` cancels the
HTTP request and the timer is cleared. Missing configuration, a non-success provider response,
network failure or timeout is reduced to a safe internal error code. Raw provider errors and
credentials are not logged.

Email delivery is best-effort. An email failure does not remove the registration and does not turn
the successful registration into an HTTP error. Failed emails are **not retried or queued**.

## GET cache

Successful event lists, event details, registration lists and statistics are cached in memory.

- default TTL: **5 seconds**;
- maximum size: **100 entries**;
- `/api/health` and error responses are not cached;
- statistics expire earlier when necessary so an event can become `past` at the correct time.

Invalidation happens after a successful database mutation:

| Mutation | Invalidated cached data |
|---|---|
| Create event | Event list and statistics |
| Update event | Event list, event detail and statistics |
| Delete event | Event list, event detail, registrations and statistics |
| Register participant | Event detail, registrations and statistics |

Each invalidation also increments a generation number. A GET operation remembers the generation
from before its database read and only stores its result if the generation is still current. This
prevents an in-flight read from putting stale data back into the cache after a mutation.

The cache belongs to one Node.js process. It is cleared by a restart and is not shared between
multiple application instances. This is appropriate for the current single-instance Render Free
deployment, but it is not a distributed cache.

## Databases and persistence

Without `DATABASE_URL`, Sequelize uses SQLite. Local development uses a file under `api/data`, while
tests set `DB_STORAGE=:memory:` so every test starts with isolated data.

When `DATABASE_URL` is present, Sequelize uses PostgreSQL. Production uses a pooled Neon connection,
a maximum Sequelize pool size of five and TLS with certificate verification enabled. Normal startup
runs `sequelize.sync()` without `force`; it does not reset existing tables.

The production connection, registration flow and real Brevo delivery were manually verified. A
manual Render service restart was also performed: the saved registration and seat count remained
unchanged after the restart. Persistence across that restart is therefore verified. A separate
existing-data redeploy test has not been recorded.

Automated database behaviour tests still run against SQLite. PostgreSQL selection and TLS options
have unit coverage, but the test suite does not connect to the live Neon database.

## Render deployment

The implementation is deployed from `feature/render-deployment`. Express serves `web/dist` in
production, including Vue Router history fallback. Unknown `/api` routes still return JSON 404
responses instead of the Vue page.

| Render setting | Value |
|---|---|
| Branch | `feature/render-deployment` |
| Root Directory | Leave empty |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start -w api` |
| Health Check Path | `/api/health` |

Required Render environment variable names:

- `NODE_ENV=production`
- `DATABASE_URL`
- `BREVO_API_KEY`
- `EMAIL_FROM`

`EMAIL_TIMEOUT_MS` and `LOG_LEVEL` are optional. Render supplies `PORT`. Secrets are configured only
in the Render dashboard and are not stored in this repository. Do not run `npm run seed` during
deployment.

## API endpoints

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET / POST | `/api/events` | List or create events |
| GET / PATCH / DELETE | `/api/events/:id` | Read, update or delete an event |
| GET / POST | `/api/events/:id/registrations` | List or create registrations |
| GET | `/api/stats` | Occupancy and status per event |

## Verification results

The final local verification completed successfully:

- ESLint passed;
- API tests: **39 passed**;
- frontend tests: **10 passed**;
- production build: **passed**.

The deployed application was also checked manually: registration succeeded, the real confirmation
email arrived, and the registration plus seat count survived a manual Render service restart.

## Stack Overflow review references

These answers were consulted during the **final documentation and code review**, not claimed as
sources used earlier during implementation:

1. [Fetch API request timeout — answer 57888548](https://stackoverflow.com/questions/46946380/fetch-api-request-timeout/57888548#57888548)
   explained that a timeout should abort the underlying fetch rather than only win a
   `Promise.race`, and that the timer should be cleared. This helped verify that the Brevo sender
   passes an `AbortController` signal, aborts on timeout and clears its timer in `finally`.
2. [How to update the cache when data changes](https://stackoverflow.com/questions/57160716/how-to-update-the-cache-when-delete-update-or-add-data)
   — the answer by Elliot Blackburn recommended invalidating or updating cached data when the
   underlying mutation succeeds. This helped verify the explicit invalidation calls after event
   mutations and after the registration database save.
3. [Detecting stale asynchronous results — answer 79928424](https://stackoverflow.com/questions/79928209/does-javascript-provide-a-built-in-way-to-detect-stale-async-results/79928424#79928424)
   described using a request/version identifier to ignore results that became stale while awaiting
   asynchronous work. This helped verify the cache generation check that prevents an older in-flight
   read from repopulating data after invalidation.

## AI usage

AI assistance was used for code refactoring, test planning, implementation review, documentation and
finding relevant technical references. Generated suggestions were reviewed against the repository
rules, the code was tested locally, and only the intended files were committed. The student configured
the hosting accounts and secrets privately, deployed the application, and manually verified the live
registration, real email delivery and restart persistence. No credentials were supplied to the AI or
committed to the repository.

## Known limitations

- Render Free can sleep after inactivity, so the first request can be slow.
- The in-memory cache is single-process, is cleared on restart and is not shared across instances.
- Failed confirmation emails are not retried.
- Neon, Render and Brevo free tiers have usage limits and no production SLA for this assignment.
- Automated integration tests use SQLite rather than a temporary PostgreSQL database.
- Database schema changes use `sequelize.sync()`; the project does not have a migration system.
- The capacity check is correct for sequential requests but is not protected by a transaction against
  two truly simultaneous registrations for the final place.
- Restart persistence was manually verified, but an existing-data redeploy persistence check has not
  been recorded separately.
