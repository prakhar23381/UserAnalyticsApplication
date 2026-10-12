# Status Log — CausalFunnel

*Permanent record, newest first. Append only: never edit or delete past entries.*

## 2026-10-12 — Housekeeping
- Deleted the stray `~/.cache/mongodb-binaries` (148 MB `mongod`, from the
  Phase 1 smoke-test incident) after the user confirmed twice. It held only
  `mongod-arm64-darwin-8.2.6` and its `.md5`.
- Found that Homebrew on this Mac is the Intel install under Rosetta (see
  recovery context §3).
- The user installed OrbStack (Docker 29.8.2 arm64, Compose v5.5.0).
  `docker compose config` validates `docker-compose.yml`. `docker compose
  up -d` started MongoDB 7.0.43 on :27017.
- First run against a real MongoDB (database `causalfunnel_smoke`, URI
  passed inline): startup builds the 3 indexes; curl checks pass for
  `/health` headers, JSON and text/plain ingestion (with a reported
  reject), URL normalization, device buckets, sessions, journey, pages,
  heatmap and read-CORS blocking. SIGTERM shutdown exits 0.

## 2026-10-12 — Phase 1: server (Express + MongoDB)
- `server` workspace via `npm init -w server` from the root: ESM, `engines`
  `>=22.12` (root too, for `vitest@5`). Deps: express 5.3, mongoose 9.11,
  helmet 8.3, cors, dotenv 18; dev: vitest 5, supertest 7,
  mongodb-memory-server 11. `dev` script uses `node --watch`, not nodemon.
- `9f4d0fc` scaffold: `config.js` (fails fast without `MONGODB_URI`;
  `DASHBOARD_ORIGIN` as a comma-separated list), `db.js`, `createApp()` in
  `app.js` (helmet with overrides for the heatmap iframe, cross-origin
  `/tracker.js` and localhost; 64kb JSON; `/health`; static `public/`; JSON
  404 and error handler that hides 500 details in production), `index.js`
  (connect → `Event.createIndexes()` → listen; SIGTERM shutdown), the Event
  model with its 3 indexes, and `normalizeUrl` / `deviceFor` / `validateEvent`.
- `4960705` `POST /api/events`: JSON or text/plain, batch or single event,
  ≤ 50 per request (413), each validated separately, `202 { accepted,
  rejected, errors? }`, 400 when nothing is valid. Open CORS.
- `c7eb908` reads: `GET /api/sessions` (aggregated on read, paginated,
  most recent first), `GET /api/sessions/:id/events` (journey sorted by
  `{ timestamp, _id }`), `GET /api/pages` (for the heatmap picker),
  `GET /api/heatmap` (normalized `page` param, device filter, newest 5000
  clicks + uncapped `total_clicks`). Dashboard-only CORS. Repeated query
  params rejected.
- Tests (pulled forward from Phase 5): 85 passing across 7 files: one
  in-memory mongod per run, one database per test file.
- Verified: every query shape uses an index (`explain()`); the server boots
  against an in-memory mongod, answers `/health`, exits 0 on SIGTERM, and
  fails fast without `MONGODB_URI`. Not verified: a real MongoDB (Docker not
  installed).
- Moved the seed script (TODO §3.7) to after Phase 3. Aligned the Phase 4
  `types.ts` plan with the actual responses (`viewport_w` in heatmap clicks,
  `{ data }` around pages).
- Incident: an ad-hoc smoke test ran mongodb-memory-server with plain `node`
  from `server/`, which downloaded a second 148 MB `mongod` to
  `~/.cache/mongodb-binaries` (outside the repo). Left in place pending the
  user's decision; the cause is recorded in `CLAUDE.md` §2 and the recovery
  context.

## 2026-10-12 — Phase 0: setup
- `git init -b main`. Moved the spec to `docs/assignment.md` (sha256
  unchanged) and pointed `CLAUDE.md` / `TODO.md` at the new path.
- Initial commit `b7c2bb9`: spec, build plan, agent rules, bookkeeping,
  `.gitignore`.
- Root `package.json`: workspaces `server` + `dashboard`; scripts `dev`
  (`concurrently`, prefixed `api` / `dashboard`), `test`, `seed` (trailing
  `--` so `npm run seed -- --reset` forwards the flag). Root devDependency
  `concurrently@^10.0.6`.
- Raised the Node floor to 22+ (`engines`, `CLAUDE.md`, `TODO.md`):
  `concurrently@10` requires it, and Node 20 is EOL.
- `docker-compose.yml` (`mongo:7`, named volume `mongo-data`). Not validated:
  Docker isn't installed on this machine.
- `server/.env.example` (`PORT`, `MONGODB_URI`, `DASHBOARD_ORIGIN`).
  `dashboard/.env.local.example` moved to Phase 4, after the
  `create-next-app` scaffold.
- Verified `server/.env` and `dashboard/.env.local` are git-ignored and the
  `*.example` files aren't.
- Added remote `origin` → `https://github.com/prakhar23381/UserAnalyticsApplication.git`
  (created empty on github.com). Not pushed.

## 2026-10-12
- Analysed the assignment spec. Found gaps the spec leaves open: when a session
  expires, click coordinates differing across screen sizes, which URL variants
  count as the same page, the page-list endpoint the heatmap implies, and
  client vs server timestamps.
- Wrote `TODO.md`: a phased build plan (Phases 0–8) with the repo layout,
  schema, API contracts, tracker design, dashboard components, tests,
  deployment and README outline.
- Set up agent rules: `CLAUDE.md` adapted from `AGENT_RULES_TEMPLATE.md`, a
  subagent symlink at `.claude/agents/causalfunnel-engineer.md`, the
  bookkeeping files (`STATUS_LOG.md`, `.agent_recovery_context.md`), and a
  `.gitignore` covering Node/Next build output, env files, `artifacts/` and
  `scratch/`.
- Removed `AGENT_RULES_TEMPLATE.md` from the repo now that `CLAUDE.md`
  replaces it. It was moved to the macOS Trash, not deleted permanently.
