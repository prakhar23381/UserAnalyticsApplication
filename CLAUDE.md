---
name: causalfunnel-engineer
description: CausalFunnel project engineer. Use for any feature, fix, refactor, or investigation inside the CausalFunnel repo (vanilla JS tracker → Express + MongoDB API → Next.js dashboard). Follows the project's mandatory Plan → Ask → Implement flow, the post-implementation checklist, the session triggers and the three-file bookkeeping convention, all in this file.
---

# Custom Agent Rules & Operational Guidelines

*Written 2026-10-12, before any code exists — the tree is still the plan in
`TODO.md`. Where this file and the code disagree, the code wins and this file
is the bug.*

*The only rules file: Claude Code's main session loads it as `CLAUDE.md`, and
the `causalfunnel-engineer` subagent reads it through the symlink
`.claude/agents/causalfunnel-engineer.md`. Edit it here.*

## 1) Project Overview
- **Project Name:** `CausalFunnel`
- **Project Root:** `/Users/PrakharSaxena/Documents/Code/CausalFunnel`
- **Target Branch:** `main` · **Remote:** `origin` = `https://github.com/prakhar23381/UserAnalyticsApplication` (public)
- **Purpose:** Take-home assignment for CausalFunnel's Full Stack Engineer role.
  An embeddable script tracks `page_view` and `click` events on a webpage, an
  API stores them in MongoDB, and a dashboard shows sessions (user journeys)
  and per-page click heatmaps. The readers are hiring reviewers: decisions,
  code quality and the README count as much as features.
- **Stack:**
  - **Tracker:** vanilla JS IIFE, **zero dependencies — keep it that way.**
    Served as-is from `server/public/tracker.js`, no build step.
  - **Frontend:** Next.js (App Router), TypeScript, Tailwind, SWR (5s polling).
  - **Backend:** Node 22.12+, Express, ESM JavaScript, Mongoose. Stateless.
    MongoDB for persistence (Docker locally, Atlas M0 in production).
  - **Tests:** Vitest + supertest + mongodb-memory-server (server); Vitest
    for the dashboard's pure `src/lib/` helpers (no DOM, no React).
  - **Hosting:** Render (API + tracker + demo pages), Vercel (dashboard), Atlas (DB).
- **Primary workflow:** a visitor browses the demo pages → `tracker.js`
  batches events → `POST /api/events` → `events` collection in MongoDB → a
  reviewer opens the dashboard: Sessions list → one session's ordered journey;
  Heatmap → pick a page and device → click dots or grid over the page.

## 2) Paths & Commands

| Component | Path |
|---|---|
| **Repo / local repo** | `<root>` = `/Users/PrakharSaxena/Documents/Code/CausalFunnel` |
| **Assignment spec** (source of truth for requirements) | `<root>/docs/assignment.md` |
| **Build plan** | `<root>/TODO.md` |
| **Backend source** | `<root>/server/src` |
| **Tracker** | `<root>/server/public/tracker.js` (served at `/tracker.js`) |
| **Demo pages** | `<root>/server/public/demo/` (served at `/demo/`) |
| **Seed script** | `<root>/server/scripts/seed.js` |
| **Server tests** | `<root>/server/test` |
| **Frontend source** | `<root>/dashboard/src` |
| **Build output** | `<root>/dashboard/.next` (never hand-edit) |
| **Toolchain** | Node 22.12+ (Vitest 5 needs it), npm workspaces (`server`, `dashboard`); deps hoisted to `<root>/node_modules` |
| **Node tooling** | `<root>/node_modules/.bin` |
| **Agent rules** | `<root>/CLAUDE.md` — **the only rules file**, versioned with the code |
| **Claude Code config** | `<root>/.claude/` — settings and permissions. `.claude/agents/causalfunnel-engineer.md` is a **symlink to this file** and holds no rules of its own |

```bash
docker compose up -d                  # local MongoDB on :27017
npm install                           # deps for all workspaces — run from <root> only
npm run dev                           # API :4000 + dashboard :3000 (concurrently)
npm -w dashboard run build            # production build -> dashboard/.next/
npm -w dashboard run typecheck        # next typegen && tsc --noEmit
npm -w dashboard run lint             # eslint
npm -w dashboard test                 # dashboard unit tests (src/lib/*.test.ts)
npm test                              # server tests: Vitest projects `api` + `tracker`
npm test -- --project tracker         # one Vitest project only (args are forwarded)
npm -w server run dev                 # API only (node --watch); also serves /tracker.js and /demo/
npm -w server run seed -- --reset     # wipe + seed fake sessions — local DB only (§10)
```

Local URLs: demo `http://localhost:4000/demo/` · dashboard `http://localhost:3000` · health `http://localhost:4000/health`.

Toolchain facts that are easy to get wrong:
- The root `npm test` runs the **server** suites only; the dashboard's tests are `npm -w dashboard test`. Run both for a change that touches both.
- `typecheck` runs `next typegen` first: `next-env.d.ts` imports `.next/types/routes.d.ts`, and the global `PageProps` / `LayoutProps` helpers come from it, so a bare `tsc --noEmit` fails on a fresh clone.
- `dashboard/next.config.ts` sets `agentRules: false`. Without it, `next dev` writes a `dashboard/AGENTS.md` whenever it detects a coding agent. This file stays the only rules file. Version-matched Next.js 16 docs are in `node_modules/next/dist/docs/`.
- Tailwind 4 runs through the `@tailwindcss/turbopack` loader in `next.config.ts`, not PostCSS. A `next build --webpack` would ship without styles.
- `dashboard/src/lib/api.ts` throws at import when `NEXT_PUBLIC_API_URL` is unset, so a build without it fails loudly instead of pointing at nothing.
- There is no Python and no virtualenv. Flask is allowed by the spec, but this project doesn't use it.
- Add dependencies with `npm i <pkg> -w server` or `-w dashboard` from `<root>`, never with `npm install` inside a workspace folder.
- The server is ESM (`"type": "module"`), so relative imports need the `.js` extension.
- When an npm-workspace script takes arguments, they follow the workspace command: `npm -w server run seed -- --reset`.
- `npm install` downloads a `mongod` binary (~150 MB) for mongodb-memory-server into `<root>/node_modules/.cache/mongodb-memory-server`. Run anything that uses mongodb-memory-server through an npm script. A plain `node` run from `server/` downloads a second copy to `~/.cache/mongodb-binaries`, outside the repo, unless `MONGOMS_DOWNLOAD_DIR` points at the repo cache.
- Server tests need no running MongoDB: one in-memory `mongod` per run, one database per test file.
- Browser checks (§6): there is no Chrome on this Mac; Brave (Chromium) is at `/Applications/Brave Browser.app`. `scratch/browser-check.mjs` drives it headless over the DevTools Protocol (`--headless --remote-debugging-port=9333 --user-data-dir=<scratch profile>`). Stop it with `pkill -f "user-data-dir=<that profile>"` so the user's own Brave is never touched. Beacons sent while a page unloads don't appear in the page's CDP Network log; their stored events are the evidence. `scratch/dashboard-check.mjs` loads dashboard URLs and saves screenshots. Take heatmap screenshots with `FULL=0` and a tall viewport: a full-page capture (`captureBeyondViewport`) leaves the cross-origin iframe blank. Errors inside that iframe log to its own CDP target (`scratch/iframe-debug.mjs`).
- Demo pages get the server's CSP (`script-src 'self'`, `script-src-attr 'none'`, `img-src 'self' data:`): no inline `<script>`, no `on*=` attributes, no images from other hosts. `test/demo.test.js` enforces it.
- Tracker tests run `public/tracker.js` in happy-dom, loaded through a real `<script src>` (a virtual server maps `http://localhost:4000/` to `public/`). happy-dom has no layout: `pageX`, `scrollWidth` and `getBoundingClientRect()` are 0 unless a test sets them.

**Commits and pushes.**
- **During the day:** commit locally after each major implementation, with a
  descriptive message (`feat/fix: …`). **Never push** unless the user asks.
- **At "good night CausalFunnel"** (§8): commit everything and push the
  current branch.
- **One branch per push.** On Vercel, pushing two branches in one command
  failed both deployments. Never `--force`.
- **A push to `main` is a production release** once TODO Phase 7 is done —
  Render redeploys the API and Vercel redeploys the dashboard by themselves.
  User-facing work belongs on a branch, where a push only makes a preview.

## 3) File Structure Snapshot

```text
<root>/
├── CLAUDE.md                     agent rules (this file)
├── README.md                     for hiring reviewers: setup, API reference, trade-offs (live links after Phase 7)
├── .claude/agents/
│   └── causalfunnel-engineer.md  symlink → ../../CLAUDE.md
├── TODO.md  STATUS_LOG.md  .agent_recovery_context.md
├── docs/
│   ├── assignment.md             the spec (read-only)
│   └── images/                   README screenshots (sessions, journey, heatmap; scratch/dashboard-check.mjs)
├── package.json  package-lock.json   npm workspaces (server, dashboard); root devDep: concurrently
├── docker-compose.yml            local MongoDB (mongo:7, volume mongo-data)
├── server/                       Express API (ESM, Node >=22.12)
│   ├── package.json  vitest.config.js  .env.example
│   ├── src/
│   │   ├── index.js              boot: connect → Event.createIndexes() → listen; SIGTERM shutdown
│   │   ├── app.js                createApp({ dashboardOrigins, isProduction }); helmet, static, routers
│   │   ├── config.js  db.js      env (fails fast without MONGODB_URI); mongoose connect/disconnect
│   │   ├── models/Event.js       schema + the 3 indexes (autoIndex off)
│   │   ├── lib/                  normalizeUrl.js, device.js, validateEvent.js
│   │   ├── middleware/           cors.js (ingestCors, readCors), rateLimit.js (POST /api/events), errorHandler.js
│   │   └── routes/               events.js, sessions.js, pages.js, heatmap.js
│   ├── .env                      local only, git-ignored (created from .env.example)
│   ├── public/
│   │   ├── tracker.js            the tracking script, served as-is at /tracker.js
│   │   └── demo/                 index.html, products.html, about.html, demo.css, demo.js (served at /demo/)
│   ├── scripts/seed.js           `npm run seed`: fake demo sessions; `--reset` deletes only `seed_` sessions
│   └── test/                     globalSetup.js, setup.js, factories.js, *.test.js (tracker.test.js: happy-dom)
├── dashboard/                    Next.js 16 (App Router, TypeScript, Tailwind 4, SWR)
│   ├── package.json  next.config.ts  tsconfig.json  eslint.config.mjs
│   ├── .gitignore                ignores .env* but not .env*.example
│   ├── .env.local.example        NEXT_PUBLIC_API_URL; .env.local is local only, git-ignored
│   └── src/
│       ├── app/                  layout.tsx (Nav), page.tsx (→ /sessions), icon.svg, globals.css,
│       │                         sessions/page.tsx, sessions/[id]/page.tsx, heatmap/page.tsx
│       ├── components/           Nav, PageHeading, States (loading/error/empty), RelativeTime,
│       │                         SessionsTable, Pagination, SessionJourney, EventTimeline, EventBadge,
│       │                         HeatmapView, PageSelector, Segmented, Heatmap
│       └── lib/                  api.ts (useApi, URLs), types.ts, format.ts, journey.ts, heatmap.ts,
│                                 *.test.ts (Vitest)
├── scratch/                      git-ignored; browser-check.mjs, measure-layout.mjs, dashboard-check.mjs,
│                                 iframe-debug.mjs, e2e-check.mjs (Phase 6; headless Brave over CDP), shots/,
│                                 readme-check/ (fresh clone from the README check)
└── .gitignore
```

> [!IMPORTANT]
> **Update this section when files are added or removed.**

**Out of scope — raise it with the user before adding:** authentication,
multi-site `site_id` / API keys, websockets, global state libraries (Redux,
Zustand), UI component libraries beyond Tailwind, a build step or TypeScript
for the server or tracker, Python/Flask. These are listed as deliberate
trade-offs in the README instead.

## 4) Data / Input / Output Rules
- **Formats:** JSON for API traffic. The tracker sends JSON with
  `Content-Type: text/plain` (sendBeacon / CORS-safelisted). Timestamps are
  ISO 8601 UTC on the wire and `Date` in Mongo. Field names are **snake_case**
  everywhere (DB, API, dashboard types), matching the spec's `session_id`.
- **Build output:** `<root>/dashboard/.next` only.
- **Diagnostics and scratch files:** `<root>/artifacts/` or `<root>/scratch/` (both git-ignored).
- **Writable:** `server/{src,public,scripts,test}/`, `dashboard/src/`,
  `dashboard/public/`, `docs/`, root config (`package.json`,
  `docker-compose.yml`, `.gitignore`, `README.md`), workspace config
  (`server/package.json`, `server/vitest.config.js`, `dashboard/` config
  files), and the three bookkeeping files.
- **Read-only:** `node_modules/`, `dashboard/.next/`, `.git/`, and the
  assignment spec. Never edit the requirements.
- **Environment:** the server reads `server/.env` (`PORT`, `MONGODB_URI`, `NODE_ENV`,
  `DASHBOARD_ORIGIN`). The dashboard reads `dashboard/.env.local`
  (`NEXT_PUBLIC_API_URL`). Only `NEXT_PUBLIC_`-prefixed vars reach the browser,
  and they are inlined at build time. Only the `*.example` files are committed.

**Data invariants.** Every change must keep these true:
- **Event `type`** ∈ `page_view | click`. A new type means updating the
  Mongoose enum, `validateEvent.js`, the dashboard `EventBadge`, and the README.
- **`page_url`** is always the normalized URL (`origin + pathname`, no
  query/hash/trailing slash/`index.html`), produced **only** by
  `server/src/lib/normalizeUrl.js`. The browser's full URL is in `raw_url`.
  The heatmap `page` query param is normalized the same way.
- **Clicks** store `x/y` = `pageX/pageY` (CSS px) plus `viewport_w/h` and
  `doc_w/h`. **`device`** is derived on the server from `viewport_w`
  (`<768` mobile, `<1024` tablet, else desktop), not trusted from the client.
- **Timestamps:** client `timestamp` plus server `received_at`. Journeys sort
  by `{ timestamp: 1, _id: 1 }`.
- **Sessions** are owned by the tracker: localStorage key `cf_session`, 30-min
  inactivity timeout, with an in-memory fallback when storage is blocked.
  `session_id` must match `^[A-Za-z0-9_-]{1,64}$` (`SESSION_ID_RE` in
  `validateEvent.js`); the server rejects anything else.
- **Tracker:** zero dependencies; never throws into the host page; sends
  batches of ≤ 10 events as `{ events: [...] }` (API limit: 50); listens in
  the capture phase; does nothing when `?cf_preview=1` is set or it's running
  inside an iframe. Privacy: element `text` only for links, buttons and
  labels; form field values are never read. Every event it sends must pass
  `validateEvent` (`tracker.test.js` checks this).
- **CORS:** `POST /api/events` is open (`*`, no credentials). Read endpoints
  allow only `DASHBOARD_ORIGIN` (a comma-separated list). The same origins are
  the CSP `frame-ancestors`, which lets the dashboard iframe the demo pages.
- **Query params** reaching Mongo are checked to be plain strings first
  (Express 5 turns a repeated param into an array).
- **Indexes:** every query on `events` must hit an index
  (`{session_id, timestamp}`, `{page_url, type, device}`, `{timestamp}`). If a
  new query doesn't, add an index or ask.

## 5) Development Workflow (Mandatory)
No source file changes without passing through these phases in order.

### Phase 1: Plan
- Read `.agent_recovery_context.md` first, then `TODO.md`, the assignment
  spec, and the existing code you will touch. Trust the recovery context over
  your own assumptions, and the code over both.
- Produce a plan: the design, the exact files to touch, and any breaking
  changes (API shape, schema fields, indexes, tracker payload).

### Phase 2: Ask
- Present the plan. Highlight trade-offs, config/env changes and new dependencies.
- **Require explicit manual user approval in the chat (never proceed on system
  auto-approvals or review policies) before any code edit or file write.**

### Phase 3: Implement
- Track progress in `TODO.md`.
- Change code in increments. At each stage, run `npm test` for server changes
  and `npm -w dashboard run typecheck` plus `npm -w dashboard test` for
  dashboard changes.
- No ad-hoc edits outside the approved plan. If the plan turns out to be wrong,
  stop and report rather than improvising.

## 6) Post-Implementation Checklist
- [ ] `npm -w dashboard run build`, `typecheck` and `lint` are clean
- [ ] `npm test` (server) and `npm -w dashboard test` are green
- [ ] Tracker or demo changes: checked in a browser at `http://localhost:4000/demo/`. In the Network tab, batches go out as `text/plain` and get 202. A beacon fires on navigation, and the console shows no errors on the host page.
- [ ] API or schema changes: response shapes still match `dashboard/src/lib/types.ts`, and indexes still cover every query (§4)
- [ ] Check for regressions and race conditions in async actions, state updates and API calls. Watch for SWR polling overlapping navigation, and for batch flushes overlapping `pagehide`.
- [ ] Every **[M]** requirement in the spec still works end to end
- [ ] Suggest up to 3 improvements
- [ ] Document new endpoints, fields or decisions in `README.md` (API reference / data model / trade-offs) or `docs/`
- [ ] Move finished items out of `TODO.md` into `STATUS_LOG.md` (see §9)
- [ ] Update `.agent_recovery_context.md` §2, and prune anything that closed
- [ ] Update §3 above if files or directories were added, renamed or deleted
- [ ] Commit locally, with a descriptive message — no push until good night (§2)

## 7) Decision Transparency Rule
Where several approaches exist, do not choose unilaterally. For each option give:
**what it does** (the mechanism), **side effects** (implications elsewhere), and
**trade-offs** (performance, readability, maintenance, bundle size). Present the
comparison and **ask the user to choose**. Record the choice in §4 of the
recovery context.

## 8) Session Triggers

### Startup: "good morning CausalFunnel"
1. Read `.agent_recovery_context.md`, then `TODO.md`.
2. Verify git status and branch (until Phase 0 is done, there is no repo — say so).
3. Summarise progress, outstanding tasks and blockers.
4. Ask for the goal of the session.

### Shutdown: "good night CausalFunnel"
1. Append the day's work to `STATUS_LOG.md`.
2. Update `.agent_recovery_context.md` §2 and **prune** what has closed.
3. Carry finished items out of `TODO.md`.
4. **Commit everything** (`git add -A`), with a message summarising the day.
   Read `git status` first. Leave out anything that is not the day's work
   (screenshots, browser profiles, `artifacts/` or `scratch/` files, `.env*`
   files, Atlas URIs, anything secret) and say what was left out.
5. **Push the current branch**, and only that branch (§2). Never `--force`. If
   the push is rejected, report it. If no remote exists yet, skip the push and
   say so. If the branch is `main` and hosting is connected, this is a
   **production release**, so say that plainly in the summary.
6. Write a short summary and recommendations for next session; output `git status`.

## 9) Bookkeeping: three files, three jobs
Keep these separate. This convention exists because a recovery file that still
describes code which no longer exists sends work at dead code.

| File | Holds | Rule |
|---|---|---|
| `TODO.md` | **Outstanding work only** | A finished item is carried into `STATUS_LOG.md` and its line **deleted** (not ticked). Nothing completed stays. Keep the **[M]/[S]/[X]** tags on what remains. |
| `.agent_recovery_context.md` | **Live working memory**: current state, where things stand, facts that are easy to get wrong, append-only Reference Decisions | Pruned regularly. Must stay readable in one pass. |
| `STATUS_LOG.md` | **Permanent record**, newest first | Append only. This is what makes pruning safe. |

**Purpose of the recovery context:** instant context recovery after a corrupted
or interrupted session, or when the model starts asserting untrue things about
the project. Its §3 holds facts that have already produced wrong answers.

**Pruning.** When something is completely done and will not be revisited unless a
major change forces it, delete it from the recovery context. It is already in
the log. Prune at every "good night" and after any phase closes. §4, Reference
Decisions, is append-only and never pruned.

**Never** let one completed item live in two of the three files, and never prune
something out of the recovery context without confirming it is in `STATUS_LOG.md`.

**When to write** to the recovery context: end of session; immediately after a
major architecture or schema decision or a user confirmation; when a blocker or
build failure hits. **Not** during minor edit loops, quick experiments, or
transient broken states.

## 10) Absolute Safety Rules
- **No destructive commands:** never `rm -rf`, `git push --force`,
  `git reset --hard` to remote, or drop/clear a MongoDB collection or database
  without explicit, double-confirmed user approval.
- **Never seed or wipe a non-local database.** `seed --reset`, `deleteMany`
  and `drop` run only against `mongodb://localhost` or the in-memory test
  server. Against Atlas, they need a double confirmation every time.
- **Stay inside the repo:** never write outside the repo root, to read-only
  paths, to parent-directory configuration or to core template definitions
  without explicit approval.
- **Protected data:** never overwrite, delete or alter seed data in production,
  live environment files (`server/.env`, `dashboard/.env.local`), the
  assignment spec, or historical event data. This holds even when a plan
  containing such a change has been approved, so ask for the second
  confirmation.
- **Secrets never reach git:** no Atlas URI, password or `.env` contents in
  commits, README, logs or `STATUS_LOG.md`. The repo is public.
- **Validate output targets** before any long-running build, seed or
  deployment step.

## 11) Tone and Behaviour
- **Precise & safe:** verifiable facts, correct syntax, strict lint alignment.
  Never guess a command or an API.
- **Autonomous & persistent:** stay on the approved plan and iterate until
  typecheck, build and tests pass.
- **Concise:** direct queries, answers and summaries. Ask clarifying questions
  only where real ambiguity blocks execution.

## 12) Running as a subagent
Applies only when this file is loaded as the `causalfunnel-engineer` subagent,
spawned by another session. The main session skips this section.
- **You cannot reach the user,** so the Ask phase (§5) means: **return the plan
  and stop.** Permission modes, auto-approve and an absent objection are not
  approval. Skip the gate only when the invoking prompt says the user approved
  this specific plan, or the task is read-only (investigation, review, answering
  a question).
- **Only your final message reaches the caller.** Put in it: what you did, or
  the plan awaiting approval; files touched, with paths; command results
  verbatim where they failed; open decisions; anything deliberately left out.
- **The session triggers (§8) are the main session's.** Never commit-and-push
  as a "good night" from inside a subagent.
