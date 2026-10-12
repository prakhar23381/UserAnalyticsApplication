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
│   │   ├── tracker.js           # THE tracking script (served at /tracker.js)
│   │   └── demo/
│   │       ├── index.html       # landing
│   │       ├── products.html    # product grid, add-to-cart buttons
│   │       ├── about.html       # long page (tests y-scroll)
│   │       └── demo.css
│   ├── scripts/
│   │   └── seed.js              # fake sessions so the hosted dashboard isn't empty
│   └── test/
│       ├── globalSetup.js       # one in-memory mongod per run
│       ├── setup.js             # a database per test file
│       ├── factories.js         # stored-event builders
│       └── {app,normalizeUrl,validateEvent,events,sessions,pages,heatmap}.test.js
└── dashboard/
    ├── package.json
    ├── .env.local.example
    ├── next.config.ts
    └── src/
        ├── app/
        │   ├── layout.tsx               # shell + <Nav/>
        │   ├── page.tsx                 # redirect → /sessions
        │   ├── sessions/page.tsx        # Sessions View (list)
        │   ├── sessions/[id]/page.tsx   # User journey
        │   └── heatmap/page.tsx         # Heatmap View
        ├── components/
        │   ├── Nav.tsx
        │   ├── SessionsTable.tsx
        │   ├── Pagination.tsx
        │   ├── EventTimeline.tsx
        │   ├── EventBadge.tsx
        │   ├── PageSelector.tsx
        │   ├── DeviceTabs.tsx
        │   ├── Heatmap.tsx              # iframe + SVG overlay
        │   └── EmptyState.tsx
        └── lib/
            ├── api.ts                   # fetcher + endpoint helpers
            ├── types.ts
            └── format.ts                # short ids, durations, relative times
```

> Tracker + demo live inside `server/public/` so one Render deploy serves API, tracker and demo — no copy/build step.

---

## 3. Phase 1 — Server (Express + MongoDB)

Done except the stretch item below (see `STATUS_LOG.md`).

- [ ] **[X]** `express-rate-limit` on `POST /api/events` (e.g. 120 req/min/IP)

---

## 4. Phase 2 — Tracker (`server/public/tracker.js`)

- [ ] **[M]** IIFE, zero deps, guarded against double-load (`if (window.__cfTracker) return;`)
- [ ] **[M]** Config from its own script tag via `document.currentScript`:
  ```html
  <script src="https://<server>/tracker.js" data-endpoint="https://<server>/api/events" defer></script>
  ```
  Default endpoint = script origin + `/api/events`.
- [ ] **[M]** Session id:
  - localStorage key `cf_session` → `{ id, last_activity }`
  - new id if missing or `now - last_activity > 30 min`
  - update `last_activity` on every event
  - id: `crypto.randomUUID()` with `Math.random` fallback (randomUUID needs a secure context).
    The server rejects ids that don't match `^[A-Za-z0-9_-]{1,64}$`, so the fallback must stay within that alphabet
  - wrap storage in try/catch → in-memory fallback (Safari private mode / blocked storage)
- [ ] **[M]** `page_view` on load
- [ ] **[M]** `click` via `document.addEventListener('click', fn, true)` — **capture phase** so page code calling `stopPropagation` can't hide clicks. Capture:
  - `x: e.pageX`, `y: e.pageY`
  - `viewport_w/h: innerWidth/innerHeight`
  - `doc_w/h: documentElement.scrollWidth/scrollHeight`
  - **[S]** `target: { tag, id, classes, text }` (text trimmed to 80 chars) → readable journey
- [ ] **[M]** Every event: `session_id, type, page_url: location.href, timestamp: new Date().toISOString(), referrer`
- [ ] **[S]** Queue + batch: flush when queue ≥ 10, every 5s, and on `visibilitychange → hidden` / `pagehide`
- [ ] **[M]** Send without losing events on navigation:
  ```js
  function send(events) {
    const body = JSON.stringify({ events });
    // text/plain = CORS-safelisted → no preflight, works with sendBeacon cross-origin
    const blob = new Blob([body], { type: 'text/plain' });
    if (navigator.sendBeacon && navigator.sendBeacon(endpoint, blob)) return;
    fetch(endpoint, { method: 'POST', body, keepalive: true,
                      headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  }
  ```
- [ ] **[M]** Never throw into the host page — wrap handlers in try/catch
- [ ] **[S]** **Disable tracking in heatmap previews**: skip if `?cf_preview=1` in URL or `window.top !== window.self` (otherwise the dashboard's iframe pollutes data with fake page_views)
- [ ] **[X]** Respect `navigator.doNotTrack === '1'`
- [ ] **[X]** SPA support: patch `history.pushState` + listen to `popstate` → emit `page_view`
- [ ] **[X]** Client `event_id` + unique index → idempotent ingestion on retries
- [ ] **[S]** Keep it small (target < 3 KB unminified-ish); add a header comment with the embed snippet

---

## 5. Phase 3 — Demo pages (`server/public/demo/`)

- [ ] **[M]** 3 static pages sharing `demo.css` and a nav (Home · Products · About) → generates multi-page journeys
  - `index.html` — hero, 2 CTA buttons ("Shop now", "Learn more")
  - `products.html` — grid of 6–8 product cards each with "Add to cart"
  - `about.html` — long content (> 2 viewports) with a CTA near the bottom → tests `y` beyond the fold
- [ ] **[M]** Each page includes the tracker `<script ... defer>`
- [ ] **[S]** Centered `max-width` layout, distinct visual blocks → heatmap overlay is recognizable
- [ ] **[S]** Small "View dashboard →" link in the footer for reviewers
- [ ] **[S]** Responsive CSS so mobile vs desktop heatmaps actually differ

### 5.1 Seed script (`server/scripts/seed.js`) **[S]** — after the demo pages
*Moved here from Phase 1: the clicks must cluster around the real button
positions of these pages, and running it needs a local MongoDB.*
- [ ] Generate ~40 sessions over the last 7 days across the 3 demo pages and 3 device sizes
- [ ] Clicks clustered around real button positions (+ jitter) so the heatmap looks meaningful
- [ ] `--reset` flag to wipe the collection first (local DB only, CLAUDE.md §10)
- [ ] `"seed"` script in `server/package.json` (the root `seed` script already forwards to it)
- [ ] Insert through `validateEvent` so seeded events have exactly the shape of real ones

---

## 6. Phase 4 — Dashboard (Next.js)

### 6.1 Setup
- [ ] **[M]** `npx create-next-app@latest dashboard --ts --tailwind --app --src-dir --eslint`
- [ ] **[M]** `dashboard/.env.local.example` — only **after** the scaffold (`create-next-app` refuses a non-empty target folder)
  ```
  NEXT_PUBLIC_API_URL=http://localhost:4000
  ```
- [ ] **[M]** `npm i swr -w dashboard` (from root)
- [ ] **[M]** Add `"typecheck": "tsc --noEmit"` to `dashboard/package.json` scripts (CLAUDE.md §2 depends on it)
- [ ] **[M]** `lib/api.ts`: `API_URL = process.env.NEXT_PUBLIC_API_URL`; `fetcher`; helpers `sessionsUrl(page)`, `sessionEventsUrl(id)`, `pagesUrl()`, `heatmapUrl(page, device)`
- [ ] **[M]** `lib/types.ts` — matches the server responses as built in Phase 1:
  ```ts
  export type EventType = 'page_view' | 'click';
  export type Device = 'mobile' | 'tablet' | 'desktop';
  export interface TrackedEvent {
    _id: string; session_id: string; type: EventType;
    page_url: string; raw_url: string; timestamp: string; received_at: string;
    x?: number; y?: number; target?: { tag?: string; id?: string; classes?: string; text?: string };
    viewport_w: number; viewport_h: number; doc_w: number; doc_h: number; device: Device;
    referrer?: string; user_agent?: string;
  }
  export interface SessionEvents { session_id: string; events: TrackedEvent[] }
  export interface SessionSummary {
    session_id: string; event_count: number; page_views: number; clicks: number;
    first_seen: string; last_seen: string; duration_ms: number;
    entry_page: string; pages_visited: number; device: Device;
  }
  export interface Paginated<T> { data: T[]; page: number; limit: number; total: number }
  export interface PageSummary { page_url: string; page_views: number; clicks: number; last_seen: string }
  export interface PagesResponse { data: PageSummary[] }
  export interface HeatmapClick { x: number; y: number; doc_w: number; doc_h: number; viewport_w: number; device: Device }
  export interface HeatmapResponse {
    page_url: string; device: Device | 'all';
    total_clicks: number;   // uncapped; clicks.length ≤ 5000
    clicks: HeatmapClick[];
  }
  export interface ApiError { error: string }
  ```
- [ ] **[M]** `layout.tsx` with `Nav` (Sessions · Heatmap · "Open demo site ↗")
- [ ] **[M]** `app/page.tsx` → `redirect('/sessions')`

### 6.2 Sessions View — `/sessions` **[M]**
- [ ] `SessionsTable` via `useSWR(sessionsUrl(page), { refreshInterval: 5000 })` **[S: live polling]**
- [ ] Columns: Session (short id, monospace) · Events · Page views · Clicks · Device · Started (relative) · Duration · Entry page (path only)
- [ ] Whole row clickable → `/sessions/[id]`
- [ ] `Pagination` (prev/next + "showing x–y of total"); page in query string
- [ ] Loading skeleton, error state, `EmptyState` ("No sessions yet — open the demo site and click around" + link)

### 6.3 Session detail (user journey) — `/sessions/[id]` **[M]**
- [ ] Header: session id, device, started at, duration, # events, # pages
- [ ] `EventTimeline`: vertical list ordered by timestamp
  - offset from session start (`+01:23`) + absolute time on hover
  - `EventBadge` (page_view / click, different colors)
  - page path
  - clicks: `(x, y)` + target summary, e.g. `button#add-to-cart "Add to cart"`
- [ ] **[S]** Group consecutive events under each page visit (page_view starts a group)
- [ ] **[S]** "View heatmap for this page →" link per page group (`/heatmap?page=...`)
- [ ] 404 state for unknown session; back link to list

### 6.4 Heatmap View — `/heatmap` **[M]**
- [ ] `PageSelector`: dropdown from `/api/pages` showing `path (N clicks)`; selection synced to `?page=` query param
- [ ] **[S]** `DeviceTabs`: All · Desktop · Tablet · Mobile (synced to `?device=`)
- [ ] **[M]** `Heatmap` component:
  - reference width per device: desktop `1280`, tablet `768`, mobile `375` (all → desktop)
  - map each click: `rx = (x / doc_w) * refW`, `ry = y * (refW / doc_w)`
  - canvas height = max scaled `doc_h` across clicks
  - **[S]** background: `<iframe src={page_url + '?cf_preview=1'} width={refW} height={H} />` with `pointer-events: none`
  - overlay: `<svg viewBox="0 0 refW H">` absolutely positioned over iframe
  - whole stage scaled to container width with CSS `transform: scale(containerW / refW)`, `transform-origin: top left`
- [ ] **[M]** Mode toggle:
  - **Dots**: `<circle r=8 fill="red" opacity=0.35>` → overlaps show density
  - **[S] Grid**: bin into 40px cells, `<rect>` with opacity ∝ count / maxCount
- [ ] Stats line: total clicks shown, device filter, "x clicks hidden (limit)" if capped
- [ ] Empty states: no page selected / page has no clicks

### 6.5 Polish **[S]**
- [ ] Consistent formatting helpers in `format.ts` (`shortId`, `formatDuration`, `timeAgo`, `pathOf(url)`)
- [ ] Dark-mode-safe Tailwind colors; usable at mobile width
- [ ] Favicon + page titles

---

## 7. Phase 5 — Tests (server)

Server tests were written with Phase 1 (see `STATUS_LOG.md`). New server code adds its tests in the same change.

- [ ] **[X]** Dashboard: one Playwright smoke test (sessions list renders, heatmap shows dots)

---

## 8. Phase 6 — Local end-to-end check

- [ ] `docker compose up -d` → `npm install` → `npm run dev`
- [ ] Open `http://localhost:4000/demo/`, navigate all 3 pages, click buttons
- [ ] DevTools → Network: batches go out as `text/plain`, 202 responses, beacon on navigation
- [ ] Dashboard `/sessions` shows the session within ~5s; journey is in the right order
- [ ] Heatmap: dots line up with the buttons you clicked (desktop), then resize to mobile, click, check Mobile tab
- [ ] Wait 30+ min (or temporarily set timeout to 1 min) → new session id created
- [ ] Open heatmap → confirm the iframe did **not** create new page_views
- [ ] `npm test` green

---

## 9. Phase 7 — Deploy

- [ ] **[S] MongoDB Atlas**: M0 cluster → DB user → Network Access `0.0.0.0/0` (note as trade-off) → copy URI
- [ ] **[S] Render** (Web Service):
  - root dir `server` · build `npm ci` · start `node src/index.js` · health check `/health`
  - env: `MONGODB_URI`, `DASHBOARD_ORIGIN=https://<app>.vercel.app`, `NODE_ENV=production`
  - note: free tier sleeps → first request ~30–50s (mention in README)
- [ ] **[S] Vercel**: import repo, root dir `dashboard`, env `NEXT_PUBLIC_API_URL=https://<server>.onrender.com`
- [ ] **[S]** Update tracker `src`/`data-endpoint` in demo pages if not using the script-origin default
- [ ] **[S]** Run `npm run seed` against Atlas once so reviewers see data immediately
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
- [ ] **[S]** API reference (5 endpoints, params, sample responses). Include: `POST /api/events` also returns `errors: [{ index, error }]` (first 10) when events are rejected; `GET /api/pages` is wrapped as `{ data: [...] }`; repeated query params → 400; error bodies are `{ error }`
- [ ] **[S]** Data model + indexes and why
- [ ] **[M]** Assumptions & trade-offs:
  - Session = 30-min inactivity window, shared across tabs, client-generated & trusted
  - URL normalization drops query/hash (UTM variants merge; genuinely different `?id=` pages merge too)
  - Heatmap uses `x` as % of document width + device buckets; not exact on fluid layouts — element-relative coords would be the next step
  - Sessions list is aggregated on read; at scale → maintain a `sessions` collection on ingest or pre-aggregate
  - Heatmap capped at 5000 newest clicks
  - Client timestamps can be skewed; `received_at` kept for that reason
  - No auth, no multi-site `site_id`, open ingestion endpoint (rate-limit only if implemented)
  - Atlas IP allowlist open for free-tier hosting
  - Polling (5s) instead of websockets
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
