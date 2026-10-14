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
├── README.md                    # ✅ exists (Phase 8)
├── CLAUDE.md                    # agent rules ✅ exists
├── .claude/agents/causalfunnel-engineer.md   # symlink → ../../CLAUDE.md ✅ exists
├── TODO.md  STATUS_LOG.md  .agent_recovery_context.md   # bookkeeping ✅ exist
├── package.json                 # npm workspaces: server, dashboard; `npm run dev` runs both ✅ exists
├── docker-compose.yml           # mongo:7 ✅ exists
├── .gitignore                   # ✅ exists
├── docs/
│   ├── assignment.md            # the spec ✅ exists
│   └── images/                  # README screenshots ✅ exist
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

Done, including the rate limit on `POST /api/events` (see `STATUS_LOG.md`).

---

## 4. Phase 2 — Tracker (`server/public/tracker.js`)

Done except the stretch items below (see `STATUS_LOG.md`). Skipped for now by
decision; list them in the README as next steps.

- [ ] **[X]** Respect `navigator.doNotTrack === '1'` (deprecated; Safari dropped it)
- [ ] **[X]** SPA support: patch `history.pushState` + listen to `popstate` → emit `page_view`
- [ ] **[X]** Client `event_id` + unique index → idempotent ingestion on retries

---

## 5. Phase 3 — Demo pages (`server/public/demo/`)

Done, including the seed script and the products heading fix (see `STATUS_LOG.md`).

---

## 6. Phase 4 — Dashboard (Next.js)

Done (see `STATUS_LOG.md`).

---

## 7. Phase 5 — Tests

Server tests were written with Phase 1, dashboard unit tests for `src/lib/` with Phase 4 (see `STATUS_LOG.md`). New code adds its tests in the same change.

- [ ] **[X]** Dashboard: one Playwright smoke test (sessions list renders, heatmap shows dots)

---

## 8. Phase 6 — Local end-to-end check

Done, including the phone/tablet `y` fix it found (see `STATUS_LOG.md`); rerun with `node scratch/e2e-check.mjs` (needs `npm run dev` and a fresh headless Brave profile).

---

## 9. Phase 7 — Deploy

Deployed and smoke-tested 2026-10-14 (see `STATUS_LOG.md`). Only seeding remains.

- [ ] **[S]** (double confirmation, CLAUDE.md §10) Seed production once:
  `MONGODB_URI='<atlas uri>' npm run seed -- --base-url https://useranalytics-api.onrender.com --allow-remote`
- [ ] **[S]** (user, after submitting) Rotate the Atlas database user's password (it was pasted into the chat) and update `MONGODB_URI` on Render

---

## 10. Phase 8 — README

Done, including the live links (see `STATUS_LOG.md`).

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
