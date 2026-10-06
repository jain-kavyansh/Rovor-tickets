# Projects & Tickets

A small project/ticket management app built for the RovorAI.com Full Stack Developer assignment.
Next.js (App Router) + TypeScript, PostgreSQL via Drizzle ORM, TanStack Query on the client.

## Features
- Dashboard of project cards: name, description, ticket counts (Todo / In Progress / Done), 3 most recently updated tickets, **Open project**, **+** (create ticket), **Create project**.
- Project page: summary + counts, ticket list, **backend-powered** search, status and priority filters (all combinable), create/open/edit tickets, GitHub **Repository insights**.
- Ticket page: view and edit; `updatedAt` changes on every update.
- GitHub insights via the backend only, cached 5 minutes in Postgres, with stale-on-error fallback.
- Loading skeletons, empty states, error states with retry, field-level validation messages, disabled submit while saving, toasts.

## Architecture
```
src/
  app/                     UI routes + REST route handlers (app/api/**) — thin: parse → call service → respond
  components/              UI components (forms, project card, repo insights, ui primitives)
  lib/                     client-only: typed API client, React Query hooks, formatting, shared constants
  server/
    db/                    Drizzle schema + lazy pg pool
    services/              business logic (projects, tickets) — the only code that queries the DB
    github/                repo-input normalizer + GitHub client/cache service
    validation/            zod schemas (single source of input rules)
    errors.ts, http.ts     central error → HTTP mapping; id parsing
drizzle/                   generated SQL migrations
scripts/seed.ts            seed data
tests/                     vitest (validation, GitHub service, forms, pages)
```
Frontend → `/api/*` (route handlers) → services → Drizzle → Postgres. The browser never talks to GitHub.

### API
| Method | Path | Notes |
|---|---|---|
| GET | `/api/projects` | projects + counts + recent tickets (3 queries total, no N+1) |
| POST | `/api/projects` | 201 / 400 |
| GET | `/api/projects/:id` | project + counts; 400 malformed id, 404 unknown |
| GET | `/api/projects/:id/tickets?search=&status=&priority=` | filters combine; invalid filter values are ignored |
| POST | `/api/projects/:id/tickets` | 201 / 400 / 404 |
| GET | `/api/projects/:id/github` | insights; 404 no repo, 429 rate limited, 502 GitHub failure |
| GET / PATCH / PUT | `/api/tickets/:id` | PUT behaves like PATCH (partial update) |

Errors always look like `{ "error": { "code", "message", "fields?" } }`. Unexpected failures return a generic 500; details are only logged server-side.

## Data model
`projects(id uuid, name, description, github_repo nullable "owner/repo", created_at, updated_at)`
`tickets(id uuid, project_id → projects ON DELETE CASCADE, title, description, status enum TODO|ACTIVE|DONE, priority enum LOW|MEDIUM|HIGH, created_at, updated_at)`
`github_repo_cache(repo pk, payload jsonb, fetched_at, expires_at)`
Indexes on `tickets(project_id, status)`, `(project_id, priority)`, `(project_id, updated_at)`. Counts use one `GROUP BY`; recent tickets use one window query.
Search is `ILIKE` on title/description with `%`, `_`, `\` escaped so they match literally; everything is parameterized by the ORM.

## State management
TanStack Query holds server state; the server is the source of truth. Mutations invalidate `projects`, `project:<id>` and `tickets:<id>`, so the dashboard and project page refetch the saved state with no manual refresh. Filter changes use `keepPreviousData` (list dims instead of flashing empty), search is debounced 300 ms, and stale in-flight requests are cancelled via `AbortSignal`.

## GitHub integration & 5-minute cache
Input accepts `owner/repo`, `https://github.com/owner/repo`, trailing slash, `.git`, `www.`; it is normalized and validated on project creation **and** again before any GitHub call.
Cache lives in Postgres (works across serverless instances): fresh row (`expires_at > now`) → served without calling GitHub; otherwise fetch, upsert, `expires_at = fetched_at + 5 min`. If the refresh fails with a transient error (network, timeout, 5xx, rate limit, bad payload) and an old row exists, it is returned with `source: "stale"` and a warning. A 404/inaccessible repo is **not** served stale. Cache read/write failures are logged and never break the page. Responses are validated with zod (incomplete payloads → `UNEXPECTED_RESPONSE`).

## Local setup
```bash
npm install
cp .env.example .env            # set DATABASE_URL (and optionally GITHUB_TOKEN)
npm run db:migrate              # apply migrations
npm run db:seed                 # 3 projects, 18 tickets (resets data!)
npm run dev                     # http://localhost:3000
```
Other scripts: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

### Environment variables
| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `GITHUB_TOKEN` | no | Server-side only. Raises GitHub limit from 60/h to 5000/h. Without it the app works but rate limits quickly on shared IPs |

## Deployment (Vercel)
1. Create a Postgres database (e.g. Neon/Supabase) and add `DATABASE_URL` (+ optional `GITHUB_TOKEN`) in Vercel project settings.
2. Import the repo. `vercel-build` runs `drizzle-kit migrate && next build`.
3. Run the seed once from your machine against that database: `DATABASE_URL=... npm run db:seed`.

## Trade-offs & assumptions
- Drizzle + `pg` instead of Prisma (see AI section). Route handlers instead of a separate backend: one deployable, clear layering.
- Duplicate project names are allowed. Whitespace is trimmed; empty description is allowed for tickets, required for projects.
- Status is stored as `TODO | ACTIVE | DONE`, displayed as Todo / In Progress / Done.
- Search is `ILIKE`, not full-text: simple and fine at this scale; a `pg_trgm` index would be the next step.
- No pagination, delete, or auth (out of scope), so no destructive confirmations exist.

## Known limitations
- **Not deployed**: I had no Vercel access in my build environment, so there is no live link yet.
- **A live successful GitHub fetch was not verified** in the build environment (its shared IP had exhausted GitHub's unauthenticated limit; I did observe the real 403 rate-limit response handled correctly). The success path, cache hit/expiry, stale fallback and every error mapping are covered by unit tests with a mocked `fetch`, and the DB cache read/stale path was checked against real Postgres.
- **UI was not tested in a real browser** (none available): behavior is covered by jsdom component/page tests; responsive layout (Tailwind, `break-words`, `line-clamp`, no fixed widths) has not been visually checked on a phone.
- No cache stampede protection: concurrent requests after expiry may each call GitHub once.
- No API rate limiting.

## AI tools used
Claude was used to scaffold the project, write the services, API, UI and tests, and to run the checks. I reviewed and tested the output.

### An AI suggestion that was changed (and why)
The first ticket-update schema was written as the create schema made partial (`.partial()`), with `description` defaulting to `""`. Manual testing showed `PATCH {"status":"DONE"}` silently **erased the ticket's description**, because the default was applied to the omitted field, and `PATCH {}` returned 200. I rewrote the update schema with no defaults and a "at least one field" rule, and added a regression test (`tests/validation.test.ts`). Lesson: defaults belong on create, never on partial updates.

Other changes: Prisma was replaced by Drizzle because Prisma's engine binaries could not be downloaded in my environment (and Drizzle's pure-JS driver is lighter on serverless); form error messages were moved out of `<label>` after a test showed they polluted the input's accessible name.
