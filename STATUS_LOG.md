# Status Log — CausalFunnel

*Permanent record, newest first. Append only: never edit or delete past entries.*

## 2026-10-12 — Phase 3: demo pages + tracker browser check
- `964f3f7` the root `test` script forwards arguments (`npm test --
  --project tracker`). TODO: README trade-off for the tracker's iframe guard.
- `481b218` `server/public/demo/`: Acme Roasters (fictional).
  - **Pages:** `index.html` (hero, Shop now / Learn more), `products.html`
    (8 cards, `#add-*` buttons), `about.html` (2707 px tall at 1440 px;
    newsletter form mid-page, Visit the shop CTA at the bottom).
  - **`demo.css`:** breakpoints at 768 / 1024 px, the same as the device
    buckets.
  - **`demo.js`:** cart badge, button feedback, newsletter thanks, and the
    dashboard link.
  - **`test/demo.test.js`:** pages are served with the tracker, `/demo`
    redirects, and no inline scripts, handlers or remote images (CSP).
    123 tests in total.
- Created `server/.env` from `.env.example` (local values, git-ignored).
- Browser check in **headless Brave 152** over the DevTools Protocol
  (`scratch/browser-check.mjs`, throwaway profile, API on the dev database):
  - **Journeys:** both arrived complete and in order. Desktop: 12 events
    across home → products (3 adds) → about (newsletter) → bottom CTA →
    products. Mobile at 390 px: its own session, device `mobile`.
  - **Coordinates:** stored click positions match the elements' real
    page coordinates within 1 px. The about-page CTA is at y = 2455.
  - **Privacy:** a typed email never appeared in any payload.
  - **Preview mode:** `?cf_preview=1` sent nothing.
  - **Console and blocking:** no console errors or warnings, no failed or
    blocked loads (Brave Shields didn't interfere on localhost).
  - **Network:** a timer-sent beacon shows as `POST` / `Ping` /
    `text/plain` / **202**. Beacons sent during navigation don't appear in
    the page-level CDP log; their stored events are the evidence.
  - No fixes were needed.

## 2026-10-12 — Phase 2: tracker
- `154f048` `server/public/tracker.js` (served at `/tracker.js`): zero
  dependencies, ES5 syntax.
  - **Events:** `page_view` on load and on back/forward-cache restores.
    Capture-phase clicks with pageX/pageY, viewport and document size, and
    the nearest interactive element. Text is recorded for links, buttons and
    labels only; form values never. Keyboard clicks are placed at the
    element's centre.
  - **Session:** localStorage `cf_session` with a 30-min inactivity
    rollover. In-memory fallback when storage is blocked. `randomUUID` with
    a fallback id that fits the API's alphabet.
  - **Sending:** batches at 10 events, 5 s, or on `pagehide` /
    `visibilitychange`. `sendBeacon` as text/plain, with a `fetch`
    keepalive fallback.
  - **Safety:** off in iframes and with `?cf_preview=1`. Runs once if
    included twice. Never throws.
- Size: 7.3 KB with comments, 5.1 KB code only, **2.9 KB gzipped**. TODO's
  "< 3 KB unminified-ish" target is met only gzipped; no minification,
  since there's no build step.
- Tests: `happy-dom` 21 devDependency. Vitest split into projects `api`
  (in-memory MongoDB) and `tracker` (happy-dom, no DB). 24 tracker tests
  load the real file via `<script src>`. One asserts that every event the
  tracker sends passes the API's `validateEvent`. Plus an app test that
  `/tracker.js` is served as JavaScript with CORP `cross-origin`.
  110 tests in total.
- Mutation-checked the tracker tests:
  - An unguarded throwing click handler: "never throws" caught 12 errors.
  - The bubble phase instead of capture, a missing iframe guard, and a
    60-min timeout each failed their matching test.
- Not done: a real-browser check; it moves to the end of Phase 3 (TODO §5).
  Stretch items (DNT, SPA, `event_id`) skipped by decision.

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
