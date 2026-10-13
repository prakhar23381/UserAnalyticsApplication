# CausalFunnel Assignment — Build TODO

Full Stack Engineer take-home: tracker script → Node API → MongoDB → Next.js dashboard.
Spec: `docs/assignment.md`

Priority tags: **[M]** must (spec requirement) · **[S]** should (quality signal) · **[X]** stretch (only if time allows)

> **Outstanding work only** (CLAUDE.md §9). When an item is done, log it in `STATUS_LOG.md` and **delete** its line here. Don't tick it.

---

## 0. Locked decisions

| Area | Choice | Why |
|---|---|---|
| Backend | Node 22+ · Express · ESM JavaScript | Spec heading says Node.js; one language across the stack. 22+ because Node 20 is EOL and `concurrently@10` needs 22 |
| DB | MongoDB · Mongoose | Schema + validation + indexes declared in one place ("structured format") |
| Dashboard | Next.js (App Router) · TypeScript · Tailwind · SWR | SWR gives polling for "live" updates with almost no code |
| Tracker | Vanilla JS IIFE, zero deps | Must be droppable into any page |
| Tests | Vitest · supertest · mongodb-memory-server | Real Mongo queries without a running DB |
| Hosting | MongoDB Atlas (M0) · Render (server + demo + tracker) · Vercel (dashboard) | All free tiers |
| Ports (local) | server `4000` · dashboard `3000` · mongo `27017` | |

Key design rules (carry through every phase):
- **Session** = localStorage id with **30-min inactivity timeout**.
- **Page identity** = normalized URL (`origin + pathname`, no query/hash/trailing slash/`index.html`). Store raw URL too.
- **Click coords** = `pageX/pageY` + `viewport_w/h` + `doc_w/h`; server derives `device` bucket; heatmap renders `x` as % of `doc_w`, filtered by device.
- **Timestamps** = client `timestamp` + server `received_at`.

---

## 1. Repo structure

```
CausalFunnel/
├── README.md
├── CLAUDE.md                    # agent rules ✅ exists
├── .claude/agents/causalfunnel-engineer.md   # symlink → ../../CLAUDE.md ✅ exists
├── TODO.md  STATUS_LOG.md  .agent_recovery_context.md   # bookkeeping ✅ exist
├── package.json                 # npm workspaces: server, dashboard; `npm run dev` runs both ✅ exists
├── docker-compose.yml           # mongo:7 ✅ exists
├── .gitignore                   # ✅ exists
├── docs/
│   └── assignment.md            # the spec ✅ exists
├── server/                      # src/ + test/ ✅ exist (Phase 1)
│   ├── package.json             # ✅ exists
│   ├── .env.example             # ✅ exists
│   ├── vitest.config.js         # ✅ exists
│   ├── src/
│   │   ├── index.js             # boot: connect DB → ensure indexes → listen
│   │   ├── app.js               # builds & exports the express app (used by tests)
│   │   ├── config.js            # reads/validates env
│   │   ├── db.js                # mongoose connect/disconnect
│   │   ├── models/
│   │   │   └── Event.js
│   │   ├── routes/
│   │   │   ├── events.js        # POST /api/events
│   │   │   ├── sessions.js      # GET /api/sessions, GET /api/sessions/:id/events
│   │   │   ├── pages.js         # GET /api/pages
│   │   │   └── heatmap.js       # GET /api/heatmap
│   │   ├── lib/
│   │   │   ├── normalizeUrl.js
│   │   │   ├── device.js        # viewport_w → mobile | tablet | desktop
│   │   │   └── validateEvent.js
│   │   └── middleware/
│   │       ├── cors.js
│   │       └── errorHandler.js
│   ├── public/
│   │   ├── tracker.js           # THE tracking script (served at /tracker.js) ✅ exists
│   │   └── demo/                # ✅ exists (+ demo.js)
│   │       ├── index.html       # landing
│   │       ├── products.html    # product grid, add-to-cart buttons
│   │       ├── about.html       # long page (tests y-scroll)
│   │       └── demo.css
│   ├── scripts/
│   │   └── seed.js              # fake sessions so the hosted dashboard isn't empty ✅ exists
│   └── test/
│       ├── globalSetup.js       # one in-memory mongod per run
│       ├── setup.js             # a database per test file
│       ├── factories.js         # stored-event builders
│       └── {app,normalizeUrl,validateEvent,events,sessions,pages,heatmap,demo,tracker,seed}.test.js
└── dashboard/                   # ✅ exists (Phase 4); file list in CLAUDE.md §3
```

> Tracker + demo live inside `server/public/` so one Render deploy serves API, tracker and demo — no copy/build step.

---

## 3. Phase 1 — Server (Express + MongoDB)

Done except the stretch item below (see `STATUS_LOG.md`).

- [ ] **[X]** `express-rate-limit` on `POST /api/events` (e.g. 120 req/min/IP)

---

## 4. Phase 2 — Tracker (`server/public/tracker.js`)

Done except the stretch items below (see `STATUS_LOG.md`). Skipped for now by
decision; list them in the README as next steps.

- [ ] **[X]** Respect `navigator.doNotTrack === '1'` (deprecated; Safari dropped it)
- [ ] **[X]** SPA support: patch `history.pushState` + listen to `popstate` → emit `page_view`
- [ ] **[X]** Client `event_id` + unique index → idempotent ingestion on retries

---

## 5. Phase 3 — Demo pages (`server/public/demo/`)

Done, including the seed script (see `STATUS_LOG.md`).

- [ ] **[S]** `products.html`: the "Our coffee" heading sits outside the container's 20 px padding (80 px from the edge at 1280, 0 px at 768 and 375; the header and cards are padded). Found in the Phase 4 heatmap preview. The fix can change text wrapping on mobile, so re-measure the seed's `LAYOUT` afterwards (`scratch/measure-layout.mjs`) and re-run `seed.test.js`.

---

## 6. Phase 4 — Dashboard (Next.js)

Done (see `STATUS_LOG.md`).

---

## 7. Phase 5 — Tests

Server tests were written with Phase 1, dashboard unit tests for `src/lib/` with Phase 4 (see `STATUS_LOG.md`). New code adds its tests in the same change.

- [ ] **[X]** Dashboard: one Playwright smoke test (sessions list renders, heatmap shows dots)

---

## 8. Phase 6 — Local end-to-end check

- [ ] `docker compose up -d` → `npm install` → `npm run dev`
- [ ] Open `http://localhost:4000/demo/`, navigate all 3 pages, click buttons
- [ ] DevTools → Network: batches go out as `text/plain`, 202 responses, beacon on navigation
- [ ] Dashboard `/sessions` shows the session within ~5s; journey is in the right order
- [ ] Heatmap: dots line up with the buttons you clicked (desktop), then resize to mobile, click, check Mobile tab
- [ ] Wait 30+ min (or temporarily set timeout to 1 min) → new session id created
- [ ] `npm test` and `npm -w dashboard test` green

---

## 9. Phase 7 — Deploy

- [ ] **[S] MongoDB Atlas**: M0 cluster → DB user → Network Access `0.0.0.0/0` (note as trade-off) → copy URI
- [ ] **[S] Render** (Web Service):
  - root dir `server` · build `npm ci` · start `node src/index.js` · health check `/health`
  - env: `MONGODB_URI`, `DASHBOARD_ORIGIN=https://<app>.vercel.app`, `NODE_ENV=production`
  - note: free tier sleeps → first request ~30–50s (mention in README)
- [ ] **[S] Vercel**: import repo, root dir `dashboard`, env `NEXT_PUBLIC_API_URL=https://<server>.onrender.com`
  - the only lockfile is the root `package-lock.json` (npm workspaces): check that Vercel installs from the repo root
  - a build without `NEXT_PUBLIC_API_URL` fails on purpose (`lib/api.ts`)
  - Render's `DASHBOARD_ORIGIN` must be the exact Vercel origin: it is both the CORS allow-list and the CSP `frame-ancestors` the heatmap iframe needs
- [ ] **[S]** Set `PRODUCTION_DASHBOARD_URL` in `server/public/demo/demo.js` (until then the footer dashboard link is hidden off localhost). The tracker needs no change: demo pages load the same-origin `/tracker.js`
- [ ] **[S]** Seed production once so reviewers see data immediately:
  `MONGODB_URI=<atlas uri> npm run seed -- --base-url https://<server>.onrender.com --allow-remote`
  (an env var beats `server/.env`; needs the user's double confirmation, CLAUDE.md §10)
- [ ] **[S]** Production smoke test: demo → dashboard → heatmap iframe loads (frameguard/CSP OK) → CORS OK

---

## 10. Phase 8 — README

- [ ] **[M]** Title + one-paragraph summary
- [ ] **[S]** Live links: Demo site · Dashboard · API health
- [ ] **[S]** Screenshot / GIF: Sessions list, Journey, Heatmap
- [ ] **[S]** Architecture diagram (ASCII):
  ```
  demo page + tracker.js ──beacon──▶ Express API ──▶ MongoDB
                                         ▲
                     Next.js dashboard ──┘ (sessions, journey, pages, heatmap)
  ```
- [ ] **[M]** Tech stack (table from §0)
- [ ] **[M]** Setup steps: prerequisites (Node 22+, Docker) → `docker compose up -d` → copy env files → `npm install` → `npm run dev` → `npm run seed` → URLs
- [ ] **[S]** Embedding the tracker (snippet + what's collected)
- [ ] **[S]** Seed script: what it generates; `--reset` deletes only `seed_` sessions; `--sessions`, `--base-url`, `--allow-remote`; click positions measured at 1280 / 768 / 375, so they need re-measuring if the demo pages change
- [ ] **[S]** API reference (5 endpoints, params, sample responses). Include: `POST /api/events` also returns `errors: [{ index, error }]` (first 10) when events are rejected; `GET /api/pages` is wrapped as `{ data: [...] }`; repeated query params → 400; error bodies are `{ error }`
- [ ] **[S]** Data model + indexes and why
- [ ] **[M]** Assumptions & trade-offs:
  - Session = 30-min inactivity window, shared across tabs, client-generated & trusted
  - URL normalization drops query/hash (UTM variants merge; genuinely different `?id=` pages merge too)
  - Heatmap places clicks by device bucket, drawn at 1280 / 768 / 375: `y` as recorded; desktop `x` measured from the page centre (exact for centred-column sites at any width), tablet/mobile `x` as a share of the width (fluid layouts). Wrong for full-width or left-aligned desktop layouts; clicks off the canvas are counted, not drawn. Element-relative coords would be the next step
  - No "All devices" heatmap: mixing layouts would put clicks on the wrong elements (the API still accepts `device=all`)
  - Heatmap background is the live page in a sandboxed iframe (no scripts, no navigation, `cf_preview=1`, http(s) only). It shows the page as it is now, not as it was when clicked; ingestion is open, so a stored `page_url` is untrusted
  - Dashboard fetches from the browser (SWR); its pages are static shells, so a sleeping API shows a "waking up" note instead of a blank page
  - `npm audit` reports a `braces` advisory via `eslint-config-next` (lint-time only, not shipped); npm's "fix" downgrades to Next 14's config
  - Sessions list is aggregated on read; at scale → maintain a `sessions` collection on ingest or pre-aggregate
  - Heatmap capped at 5000 newest clicks
  - Client timestamps can be skewed; `received_at` kept for that reason
  - No auth, no multi-site `site_id`, open ingestion endpoint (rate-limit only if implemented)
  - Atlas IP allowlist open for free-tier hosting
  - Polling (5s) instead of websockets
  - The tracker does nothing inside an iframe (that keeps the heatmap preview from recording visits), so a customer page legitimately shown in an iframe isn't tracked either
- [ ] **[S]** "What I'd do next": site_id + API keys, element-relative heatmaps, scroll-depth events, retention via TTL index, websockets, bot filtering

---

## 11. Final submission checklist

- [ ] Repo is **public**; no `.env` or secrets committed
- [ ] Fresh clone → README steps work end to end
- [ ] All [M] items above checked
- [ ] Live links in README work (and server is awake)
- [ ] Seeded data present in production
- [ ] Tests pass; lint clean
- [ ] Commit history is readable (one commit per phase/feature, not one giant commit)
- [ ] Submit repo link + live links
