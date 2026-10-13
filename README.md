# CausalFunnel: User Analytics

A small full-stack analytics app, built as the take-home for CausalFunnel's
Full Stack Engineer role. A dependency-free script (`tracker.js`) records
`page_view` and `click` events on any web page and sends them to a Node/Express
API, which validates them and stores them in MongoDB. A Next.js dashboard lists
the sessions, replays each one as an ordered user journey, and draws a
per-page click heatmap over the page itself. A three-page demo shop (Acme
Roasters, fictional) and a seed script supply data to look at.

## Contents

- [Screenshots](#screenshots)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally)
- [Embedding the tracker](#embedding-the-tracker)
- [Seed script](#seed-script)
- [API reference](#api-reference)
- [Data model and indexes](#data-model-and-indexes)
- [Assumptions and trade-offs](#assumptions-and-trade-offs)
- [What I'd do next](#what-id-do-next)
- [Project layout](#project-layout)

## Screenshots

**Sessions.** Every session, with event counts, most recent activity first.
The list refreshes every 5 seconds.

![Sessions list](docs/images/sessions.png)

**User journey.** One session's events in order, grouped by page visit. The
header shows the traffic source (`utm_source`, else the referrer).

![User journey](docs/images/journey.png)

**Heatmap.** Clicks drawn over the live page at a fixed width per device,
as dots or a 40 px grid.

![Click heatmap](docs/images/heatmap.png)

## How it works

```text
   any web page                          Express API  (server/)                MongoDB
  +---------------------+  POST /api/events  +---------------------------+     +------------+
  | <script tracker.js> | -----------------> | validate each event,      | --> |   events   |
  | page_view, click    |  text/plain beacon | normalize the URL, derive |     | collection |
  +---------------------+                    | the device, store         |     | (3 indexes)|
                                             |                           | <-- |            |
  +---------------------+  GET, every 5 s    | GET /api/sessions         |     +------------+
  | Next.js dashboard   | -----------------> | GET /api/sessions/:id/... |
  | Sessions, Journey,  | <----------------- | GET /api/pages            |
  | Heatmap             |  JSON              | GET /api/heatmap          |
  +---------------------+                    |                           |
            |                                | static: /tracker.js,      |
            +--- sandboxed iframe ---------> | /demo/  (the demo shop)   |
                 ?cf_preview=1               +---------------------------+
```

1. **Tracking.** `tracker.js` loads with `defer`. It reads or creates the
   session in `localStorage` and records a `page_view`. Clicks are caught on
   `document` in the capture phase, so page code that stops propagation can't
   hide them.
2. **Sending.** Events are queued and sent in batches: at 10 events, 5 seconds
   after the first one, or when the page is hidden or unloaded. Batches go out
   with `navigator.sendBeacon` as `text/plain`, which needs no CORS preflight
   and still sends while the page navigates away. If the beacon is refused,
   `fetch` with `keepalive` sends the batch instead.
3. **Ingestion.** The API validates each event on its own and keeps the valid
   ones. It normalizes `page_url` (the browser's URL is kept as `raw_url`),
   derives `device` from the viewport width, adds the server's `received_at`
   and the request's `User-Agent`, and inserts the batch. It answers `202`
   with accepted and rejected counts.
4. **Reading.** The dashboard fetches from the browser with SWR and re-fetches
   every 5 seconds, so new visits appear without a reload. Sessions are
   aggregated from the events at read time.
5. **Heatmap.** The page itself is shown in a sandboxed iframe (no scripts, no
   navigation) at the device's reference width, with `?cf_preview=1` so the
   tracker on it stays off. The clicks are drawn on top.

### How the heatmap places clicks

Visitors click at whatever window size they have, but each device's heatmap is
drawn at one reference width: 1280 px for desktop, 768 for tablet, 375 for
mobile. Each click is mapped onto that layout
([`dashboard/src/lib/heatmap.ts`](dashboard/src/lib/heatmap.ts)):

| | Desktop | Tablet and mobile |
|---|---|---|
| **x** | Keeps its distance from the page centre: `x + (1280 − doc_w) / 2`. Desktop sites are usually a centred column. | Keeps its share of the width: `x / doc_w × 768` (or 375). Phone and tablet layouts are usually fluid. |
| **y** | As recorded. A fixed-width column doesn't reflow. | Keeps its share of the page height: `y × refHeight / doc_h`. Text reflows with width, which moves everything below it. |

- `refHeight` is the page's height at the reference width: the most common
  `doc_h` among clicks recorded in a window exactly that wide (the taller one
  on a tie).
- `doc_h` is the document's `scrollHeight`. On a page shorter than the window,
  that is the window's height, not the page's. So only clicks on pages taller
  than their window (`doc_h > viewport_h`) set `refHeight` or get scaled.
- Clicks that land off the canvas are counted and reported, not drawn.

Two versions came before this one. The first scaled `y` by width, which put
clicks on the About page's bottom button 273 px too high at 1440 px. The second kept `y`
as recorded on every device, which missed by 23 px on a 390 px phone in the
end-to-end check. The current rules put every checked click on its element.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Tracker | Vanilla JavaScript (ES5 syntax), no dependencies, no build step | Works on any page as a single `<script>` tag: 7 KB, about 3 KB gzipped |
| API | Node.js 22, Express 5, ESM JavaScript, helmet, cors | Same language as the tracker and the dashboard, and no build step to deploy |
| Database | MongoDB 7 with Mongoose 9 | Schema, validation and indexes are declared in one place |
| Dashboard | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, SWR | Polling with SWR makes the dashboard live without websockets |
| Tests | Vitest, supertest, mongodb-memory-server, happy-dom | Real MongoDB queries without a running database. The tracker runs in a simulated browser |
| Hosting (target) | Render (API, tracker, demo pages), Vercel (dashboard), MongoDB Atlas M0 | All free tiers |

The spec allows Node.js or Flask. This project uses Node only.

## Run it locally

**Prerequisites:** Node.js 22.12 or newer, and Docker with Compose (Docker
Desktop, OrbStack, or similar) for the local MongoDB. Any MongoDB 7 instance
works if you point `MONGODB_URI` at it instead.

```bash
git clone https://github.com/prakhar23381/UserAnalyticsApplication.git
cd UserAnalyticsApplication

docker compose up -d                                  # MongoDB 7 on localhost:27017
cp server/.env.example server/.env                    # API settings
cp dashboard/.env.local.example dashboard/.env.local  # dashboard -> API URL
npm install                                           # all workspaces, from the repo root
npm run seed                                          # optional: 40 fake sessions
npm run dev                                           # API on :4000 and dashboard on :3000
```

Then open:

| | URL |
|---|---|
| Demo shop (tracked) | http://localhost:4000/demo/ |
| Dashboard | http://localhost:3000 |
| API health check | http://localhost:4000/health |

Browse the demo shop and click around. The session shows up on the dashboard
within about 10 seconds: up to 5 s for the tracker to send, plus up to 5 s
for the dashboard to poll.

`npm install` also downloads a MongoDB binary (about 150 MB) for the
in-memory test database, into `node_modules/.cache`.

### Configuration

| File | Variable | Meaning |
|---|---|---|
| `server/.env` | `MONGODB_URI` | Required. The API exits at startup without it. |
| | `PORT` | API port. Default `4000`. |
| | `DASHBOARD_ORIGIN` | Comma-separated origins allowed to call the read endpoints. The same list goes into the CSP `frame-ancestors`, which lets the dashboard show the demo pages in an iframe. Default `http://localhost:3000`. |
| | `NODE_ENV` | `production` hides the messages of 500 errors and turns on `upgrade-insecure-requests`. |
| `dashboard/.env.local` | `NEXT_PUBLIC_API_URL` | Required. Base URL of the API. It is inlined at build time, so a build without it fails, and changing it needs a rebuild. |

Only the `*.example` files are committed.

### Tests and checks

```bash
npm test                         # server: API tests (supertest + in-memory MongoDB) and tracker tests (happy-dom)
npm test -- --project tracker    # one Vitest project only
npm -w dashboard test            # dashboard: unit tests for the heatmap math, formatting and journey grouping
npm -w dashboard run typecheck   # next typegen && tsc --noEmit
npm -w dashboard run lint
npm -w dashboard run build
```

The server tests need no running MongoDB: each run starts one in-memory
`mongod`, with a separate database per test file. The tracker tests load the
real `public/tracker.js` through a `<script src>` tag in happy-dom. They check,
among other things, that every event it sends passes the API's validator.

## Embedding the tracker

```html
<script src="http://localhost:4000/tracker.js" defer></script>
```

The script sends events to its own origin's `/api/events`. To serve the file
from somewhere else, give it the API's endpoint:

```html
<script src="https://cdn.example.com/tracker.js"
        data-endpoint="https://api.example.com/api/events" defer></script>
```

**What each event carries:**

| Field | Events | Notes |
|---|---|---|
| `session_id` | all | From `localStorage` key `cf_session`. A new one starts after 30 minutes without events. The tabs of one browser share it. If storage is blocked, it is kept in memory for the page's lifetime. |
| `type` | all | `page_view` or `click` |
| `page_url` | all | `location.href`. The server stores a normalized copy and keeps the original as `raw_url`. |
| `timestamp` | all | Client clock, ISO 8601 UTC |
| `referrer` | all | `document.referrer`, when there is one |
| `viewport_w`, `viewport_h` | all | Window size in CSS px |
| `doc_w`, `doc_h` | all | Document `scrollWidth` and `scrollHeight` |
| `x`, `y` | click | `pageX` and `pageY`: document coordinates in CSS px, rounded. A keyboard or scripted click has no pointer position, so it is placed at the element's centre. |
| `target` | click | The nearest link, button or form field (else the clicked element): `tag`, `id`, `classes`, and `text` for links, buttons and labels only, cut to 80 characters |

**Privacy.** Form field values are never read. Element text is collected only
for links, buttons and labels. No cookies are set, and the API doesn't store
IP addresses. The demo's newsletter form uses POST, so a typed email can never
end up in a URL, and so never in a tracked `page_url`.

**Behaviour.**

- The tracker never throws into the host page: every entry point is wrapped.
- It does nothing inside an iframe or when the URL has `?cf_preview=1`. This
  keeps the dashboard's heatmap preview from recording visits.
- A page restored from the back/forward cache counts as a new `page_view`.
- Loading the script twice is harmless.

## Seed script

The seed script adds fake but realistic visits to the demo shop, so the
dashboard has something to show:

```bash
npm run seed                      # add 40 sessions to MONGODB_URI (from server/.env)
npm run seed -- --reset           # first delete earlier seeded sessions, then add
npm run seed -- --sessions 80     # 1 to 1000 sessions
```

- **Sessions.** They are spread over the past 7 days, with a device mix of
  50% desktop, 35% mobile and 15% tablet. They vary their entry page and
  their traffic source (UTM tags and referrers). Visitors browse, add to cart
  and sign up for the newsletter. About 40% leave after one page.
- **Clicks.** Every click lands on a real element. The positions come from
  the demo pages, measured at the heatmap's reference widths (1280, 768,
  375). If the demo markup or CSS changes, the positions need measuring again.
- **Validation.** Every event goes through the API's validator before it is
  stored.
- **Safe re-seeding.** Seeded session ids start with `seed_`, and `--reset`
  deletes only those. Real visits survive a re-seed.
- **Remote databases.** The script refuses to write to a database that isn't
  on localhost unless you pass `--allow-remote`. `--base-url` sets the host
  in the seeded page URLs (default `http://localhost:4000`).

## API reference

Base URL locally: `http://localhost:4000`. JSON field names are snake_case,
the same as in the database.

- **CORS.** `POST /api/events` accepts any origin, without credentials. The
  read endpoints allow only the origins in `DASHBOARD_ORIGIN`.
- **Errors.** Every error body is `{ "error": "message" }`.
- **Query parameters.** A parameter repeated in the query (`?page=1&page=2`)
  gets a `400`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/events` | Receive and store events |
| `GET` | `/api/sessions` | Sessions with event counts |
| `GET` | `/api/sessions/:id/events` | One session's events, in order |
| `GET` | `/api/pages` | Every tracked page, for the heatmap's page picker |
| `GET` | `/api/heatmap` | Click positions on one page |

The server also serves `GET /health` (`{ "ok": true }`), `GET /tracker.js` and
the demo shop at `/demo/`.

### `POST /api/events`

The body is `{ "events": [ ... ] }` with 1 to 50 events, or a single event
object (handy with curl). The tracker sends `Content-Type: text/plain`, and
`application/json` works too. Bodies are limited to 64 KB.

```bash
curl -X POST http://localhost:4000/api/events \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"readme-test","type":"click","page_url":"http://localhost:4000/demo/","timestamp":"2026-10-14T09:00:00Z","x":120,"y":340,"viewport_w":1280,"viewport_h":800,"doc_w":1280,"doc_h":920}'
```

```json
{ "accepted": 1, "rejected": 0 }
```

Each event is validated on its own:

| Field | Rule |
|---|---|
| `type` | `page_view` or `click` |
| `session_id` | 1–64 characters of `A-Z a-z 0-9 _ -` |
| `page_url` | An http(s) URL of up to 2048 characters |
| `timestamp` | ISO 8601, no more than 24 hours in the future |
| `viewport_w`, `viewport_h`, `doc_w`, `doc_h` | Numbers from 0 to 100 000 |
| `x`, `y` | Clicks only: numbers from 0 to 100 000 |

Unknown fields are dropped and long strings are truncated.

| Status | When | Body |
|---|---|---|
| `202` | At least one event was valid | `accepted`, `rejected`, and `errors` if any event was rejected |
| `400` | No valid events, or the body isn't valid JSON | `error`, plus the counts and `errors` when events were rejected |
| `413` | More than 50 events, or a body over 64 KB | `error` |

`errors` lists the first 10 rejected events, as `[{ "index": 3, "error": "type must be one of: page_view, click" }]`.

### `GET /api/sessions`

| Parameter | Default | Notes |
|---|---|---|
| `page` | `1` | |
| `limit` | `20` | 1 to 100; out-of-range values are clamped |

Sorted by most recent activity. `device` is the device of the session's first
event.

```json
{
  "data": [
    {
      "session_id": "1c7f99e5-4872-4765-bbab-22477e7b2fb4",
      "event_count": 21,
      "page_views": 9,
      "clicks": 12,
      "first_seen": "2026-10-13T05:05:40.142Z",
      "last_seen": "2026-10-13T05:06:05.388Z",
      "duration_ms": 25246,
      "entry_page": "http://localhost:4000/demo",
      "pages_visited": 3,
      "device": "desktop"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 48
}
```

### `GET /api/sessions/:id/events`

All of the session's events, oldest first. Ties are broken by `_id`, so events
from the same millisecond keep their insertion order. An id in the wrong
format gets `400`, and an unknown session gets `404`.

```json
{
  "session_id": "seed_jzsqovvli6m0",
  "events": [
    {
      "_id": "6acd602016277a5f837f5f6a",
      "session_id": "seed_jzsqovvli6m0",
      "type": "page_view",
      "page_url": "http://localhost:4000/demo",
      "raw_url": "http://localhost:4000/demo/?utm_source=newsletter",
      "timestamp": "2026-10-08T21:23:02.005Z",
      "received_at": "2026-10-08T21:23:05.901Z",
      "viewport_w": 1280,
      "viewport_h": 800,
      "doc_w": 1280,
      "doc_h": 920,
      "device": "desktop",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
    },
    {
      "_id": "6acd602016277a5f837f5f6b",
      "session_id": "seed_jzsqovvli6m0",
      "type": "click",
      "page_url": "http://localhost:4000/demo",
      "raw_url": "http://localhost:4000/demo/?utm_source=newsletter",
      "timestamp": "2026-10-08T21:23:09.450Z",
      "received_at": "2026-10-08T21:23:10.617Z",
      "x": 318,
      "y": 416,
      "target": { "tag": "a", "id": "cta-learn", "classes": "btn btn-secondary", "text": "Learn more" },
      "viewport_w": 1280,
      "viewport_h": 800,
      "doc_w": 1280,
      "doc_h": 920,
      "device": "desktop",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
    }
  ]
}
```

### `GET /api/pages`

Every tracked page, most-clicked first.

```json
{
  "data": [
    { "page_url": "http://localhost:4000/demo/products.html", "page_views": 58, "clicks": 109, "last_seen": "2026-10-13T05:06:05.746Z" },
    { "page_url": "http://localhost:4000/demo/about.html", "page_views": 24, "clicks": 32, "last_seen": "2026-10-13T05:06:05.045Z" },
    { "page_url": "http://localhost:4000/demo", "page_views": 30, "clicks": 19, "last_seen": "2026-10-13T05:06:05.388Z" }
  ]
}
```

### `GET /api/heatmap`

| Parameter | Default | Notes |
|---|---|---|
| `page` | required | A page URL. It is normalized the same way as stored events, so `/demo/index.html?utm_source=x` finds `/demo`. |
| `device` | `all` | `all`, `desktop`, `tablet` or `mobile` |

Returns the newest 5000 clicks at most. `total_clicks` is the uncapped count.
Each click carries only the fields the heatmap needs.

```json
{
  "page_url": "http://localhost:4000/demo/products.html",
  "device": "desktop",
  "total_clicks": 40,
  "clicks": [
    { "x": 552, "y": 31, "viewport_w": 1512, "viewport_h": 900, "doc_w": 1512, "doc_h": 1144, "device": "desktop" },
    { "x": 1173, "y": 929, "viewport_w": 1512, "viewport_h": 900, "doc_w": 1512, "doc_h": 1144, "device": "desktop" }
  ]
}
```

## Data model and indexes

All data lives in one collection, `events`, with one document per event
([`server/src/models/Event.js`](server/src/models/Event.js)):

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | From the tracker |
| `type` | `page_view` \| `click` | |
| `page_url` | string | Normalized: `origin + pathname`, without query, hash, trailing slash or `index.html`. Heatmaps group by it. |
| `raw_url` | string | Exactly what the browser had, including UTM tags |
| `timestamp` | Date | Client clock |
| `received_at` | Date | Server clock |
| `x`, `y`, `target` | number, number, object | Clicks only |
| `viewport_w`, `viewport_h`, `doc_w`, `doc_h` | number | CSS px |
| `device` | `mobile` \| `tablet` \| `desktop` | Derived on the server from `viewport_w`: under 768 is mobile, under 1024 is tablet. Never taken from the client. |
| `referrer` | string | Optional |
| `user_agent` | string | From the request header, not the body |

| Index | Used by |
|---|---|
| `{ session_id: 1, timestamp: 1 }` | The sessions list (its `$group` walks this index in order), a session's journey, and the seed script's `--reset` (an anchored `^seed_` prefix match) |
| `{ page_url: 1, type: 1, device: 1 }` | The heatmap query and its count, and the pages list |
| `{ timestamp: -1 }` | No current endpoint. It is there for time-range queries, such as recent activity or a retention job |

Mongoose's automatic index builds are off. The API builds the indexes with
`Event.createIndexes()` at startup, before it starts listening, so they
exist before the first query. Unlike `syncIndexes()`, this never drops an
index created outside the schema.

Sessions are not stored separately: the list is aggregated from the events at
read time. That stays simple and is always consistent, and it's fine at this
scale. See the trade-offs below.

## Assumptions and trade-offs

**Sessions and identity**

- A session is a 30-minute inactivity window, kept in `localStorage` and
  shared by the browser's tabs. The id is generated by the client and trusted
  (it only has to match the id format).
- A page is identified by `origin + pathname`. UTM variants merge, as they
  should. Pages that differ only by query string (`?id=1`, `?id=2`) merge too.
- Client clocks can be wrong, so the server's `received_at` is stored next to
  the client's `timestamp`. Journeys are ordered by the client's clock, which
  is the order the visitor saw.

**Tracker**

- It does nothing inside an iframe, which is what keeps the heatmap preview
  from recording visits. A real page that is legitimately shown in an iframe
  isn't tracked either.
- Batches are fire-and-forget: a batch that fails to send is not retried. A
  retry would need idempotent ingestion (an `event_id` with a unique index),
  which is listed under next steps.
- There is no single-page-app support. The demo is a multi-page site, so only
  full page loads and back/forward-cache restores count as page views.
- `navigator.doNotTrack` is not honoured. It is deprecated, and Safari has
  removed it.

**Heatmap**

- Clicks are placed by device bucket at one reference width per device, as
  [described above](#how-the-heatmap-places-clicks). That is exact for
  centred-column desktop sites and close for fluid phone layouts. It is wrong
  for full-width or left-aligned desktop layouts. Positions relative to the
  clicked element would be the next step.
- There is no "all devices" heatmap. Drawing phone clicks on the desktop
  layout would put them on the wrong elements. The API still accepts
  `device=all`.
- The background is the live page in a sandboxed iframe. It shows the page as
  it is now, not as it was at click time, and as served, before any script
  changes it. For example, submitting the newsletter form replaces it with a
  shorter line, so the button below moves up 12 px for the visitor, but not
  in the preview.
- Ingestion is open, so a stored `page_url` is untrusted input. The dashboard
  only frames http(s) URLs, with `sandbox=""`.
- Each heatmap shows the newest 5000 clicks; the total is still reported.

**Backend and data**

- One `events` collection, with sessions aggregated at read time. At larger
  scale, a `sessions` collection updated on ingest, or a periodic
  pre-aggregation, would replace the `$group` over all events.
- There is no authentication, no multi-site `site_id` and no API keys, and the
  ingestion endpoint is open to any origin with no rate limit. The read
  endpoints are limited to the dashboard's origin by CORS. That stops other
  websites from reading the data in a browser, but it is not access control.
- `helmet`'s defaults are adjusted in three places: `frame-ancestors` instead
  of `X-Frame-Options` (for the heatmap iframe), a cross-origin resource policy
  so other sites can load `/tracker.js`, and no `upgrade-insecure-requests`
  outside production (Safari would otherwise fetch `http://localhost` over
  https).

**Dashboard**

- It polls every 5 seconds instead of holding a websocket open. That is
  simpler, fine for a demo, and SWR pauses polling in hidden tabs.
- Data is fetched in the browser, never in server components. The server
  renders only the page shell, so a sleeping API shows a "waking up" note
  instead of a blank page that hangs.

**Hosting and tooling**

- The target hosting is free tiers. Render's free web service sleeps when
  idle, so the first request after a quiet spell takes 30–50 seconds. Atlas's
  free tier is reached over the internet, so its IP allowlist has to be open
  (`0.0.0.0/0`), with access protected by the database user's credentials.
- `npm audit` reports a `braces` advisory through `eslint-config-next`. It is
  a lint-time dependency that never ships, and npm's suggested "fix"
  downgrades to Next 14's config.

## What I'd do next

- **Multi-site support:** a `site_id` on every event, API keys for ingestion
  and reads, and authentication for the dashboard.
- **Abuse protection:** rate limiting on `POST /api/events` and bot filtering.
- **Reliable ingestion:** a client `event_id` with a unique index, so the
  tracker can retry failed batches without creating duplicates.
- **Better heatmaps:** store each click relative to its element (a CSS
  selector plus an offset), so clicks map onto any layout. Also scroll-depth
  events.
- **Scale:** a `sessions` collection maintained on ingest, and a TTL index for
  data retention.
- **Tracker:** single-page-app support (`history.pushState` and `popstate`).
- **Live updates:** server-sent events or websockets instead of polling.
- **Tests:** a Playwright smoke test of the dashboard in a real browser.

## Project layout

```text
.
├── docker-compose.yml          local MongoDB 7
├── package.json                npm workspaces: server, dashboard
├── docs/
│   ├── assignment.md           the original spec
│   └── images/                 README screenshots
├── server/                     Express API (ESM JavaScript, Node 22.12+)
│   ├── src/
│   │   ├── index.js            connect, build indexes, listen; graceful shutdown
│   │   ├── app.js              helmet, CORS, static files, routers
│   │   ├── models/Event.js     schema and the 3 indexes
│   │   ├── lib/                normalizeUrl, device, validateEvent
│   │   ├── middleware/         CORS, errors
│   │   └── routes/             events, sessions, pages, heatmap
│   ├── public/
│   │   ├── tracker.js          the tracking script, served as is at /tracker.js
│   │   └── demo/               the demo shop, served at /demo/
│   ├── scripts/seed.js
│   └── test/                   Vitest: API (supertest + in-memory MongoDB) and tracker (happy-dom)
└── dashboard/                  Next.js 16 (App Router, TypeScript, Tailwind 4, SWR)
    └── src/
        ├── app/                /sessions, /sessions/[id], /heatmap
        ├── components/         tables, journey timeline, heatmap canvas, states
        └── lib/                API client, types, heatmap math, formatting, with unit tests
```

The repo also holds my working notes from the build: `TODO.md` (open work),
`STATUS_LOG.md` (a dated log of what was built and checked) and
`.agent_recovery_context.md` (the decision record). `CLAUDE.md` holds the
rules I gave the coding agent I worked with.
