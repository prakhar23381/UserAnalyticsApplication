# Status Log — CausalFunnel

*Permanent record, newest first. Append only: never edit or delete past entries.*

## 2026-10-15 — v2 M1a: Trailmark look, one-page layout, UI lab (branch `v2`)
- **Pushed `main` first** (user asked): `da87007` and `8577f33` → `origin/main` = `8577f33`,
  the submitted version. All v2 work is on the local branch `v2`; the plan is
  `docs/v2-plan.md` (`2939c8d`).
- **Brand:** Trailmark name, logo mark (dotted trail into a ring), favicon (`#4f39f6`, the
  brand-600 oklch converted to hex), titles, README title and intro, tracker and demo-page
  comments. The demo footer sentence is unchanged on purpose: it's accurate, and changing its
  length could rewrap the phone layout under the seed's measured positions.
- **Design system** (`globals.css`): brand scale (Tailwind indigo values, `@theme static`),
  role tokens (canvas, surface, surface-2, line, ink 1–3, accent) for light and dark; dark
  mode via `data-theme` set before paint (`?theme=` forces it); Inter through `next/font`.
- **Icons:** `lucide-react` 1.49.0 (newest release older than two weeks; lockfile pinned),
  always with a text label: device labels, tabs, toggles, states, pagination.
- **One page** (`/`): top bar, tabs (Overview · Sessions · Heatmaps) in `?tab=`; journeys
  open inside the Sessions tab (`?session=`); the list page is `?p=`. `lib/url.ts` (+11
  tests) builds the URLs; `/sessions`, `/sessions/[id]` and `/heatmap` redirect (307) with
  their parameters. Overview is a placeholder until M1b.
- **UI lab** at `/lab` (user request): Screens (the real dashboard in frames at 1280 / 768 /
  390, light and dark, zoom, extra query), Components (each piece in its states with sample
  data), Tokens. `next start` on the production build returns 404 for it.
- **Bugs found and fixed on the way:** every page returned 500 because the server-component
  `TopBar` imported `lib/api.ts`, which imports SWR (no default export on the server): the
  constants moved to `lib/config.ts`. The lab logged a hydration mismatch (locale date format,
  server vs browser): its sample components render in the browser only
  (`useSyncExternalStore`).
- Checks: `npm test` 152, `npm -w dashboard test` 68, typecheck, lint and build clean. Brave
  screenshots (light, dark, phone 390 with no sideways overflow) show no console or network
  errors.

## 2026-10-15 — Submission checks, Akshara review, TODO reset
- **Requirements audit** against `docs/assignment.md`, on the live site: every
  item met (tracker events and fields, the 4 APIs, MongoDB, sessions view and
  journey, heatmap page picker with dots/grid, hosting, public repo, README
  with setup, stack and trade-offs). This closes the final-submission
  checklist except the user's submit step: repo public (raw files load without
  sign-in), no secrets in history (scanned), fresh-clone setup verified, tests
  and lint clean, live links work, production seeded.
- Pushed `3a71742` and `2c4d18f` (user-approved). `da87007` adds `*.env` to
  `.gitignore` (local only): a root `atlas-credentials.env` wasn't covered by the
  `.env` rules. An empty root `assignment.md` was deleted at the user's OK.
- **Keep-alive:** the user chose an external monitor (UptimeRobot, 5 min) over
  a GitHub Actions schedule. Render's free tier: 15 min idle → spin-down,
  750 free instance hours a month, suspension rather than billing when hours
  run out.
- **Akshara embed** (user request, then skipped): a read-only review found it
  wouldn't break the app (no `load` listeners, so `async` is safe), but the
  tracker would publish a parent's PIN (PinPad uses digit `<button>`s) and
  child ids from `/report?child=…` on the unauthenticated dashboard. Proposed
  opt-outs (`data-cf-ignore`, `data-strip-query`) are now TODO items. Nothing
  in the Akshara repo was changed.
- `TODO.md` rewritten to outstanding work only: submission steps, items still
  open from the build, and a planning section (Phase 9) for the user's new
  features: top elements, element click heatmap, scroll heatmap, area heatmap,
  attention map and a dashboard UI pass.

## 2026-10-14 — Phase 7: live and smoke-tested
- **Atlas** (user): M0 `Cluster0` on AWS Singapore, a database user, database
  `causalfunnel`. A read-only ping from this Mac with the user's URI
  succeeded. The URI is in Render's environment only, never in a file,
  commit or log.
- **Render** (user): the Blueprint flow asked for a credit card, so the user
  created a free **Web Service** `useranalytics-api` by hand with the
  `render.yaml` settings. It is at https://useranalytics-api.onrender.com, and
  `/health` first answered 200 at 17:22 UTC. README "Deployment" now notes
  this route.
- **HTTP smoke test** (`scratch/prod-smoke.sh`, 10/10): `/health`;
  `/tracker.js` 200 with CORP `cross-origin`; `/demo/` CSP
  `frame-ancestors 'self' https://useranalytics-dashboard.vercel.app` and
  `upgrade-insecure-requests`; reads allowed for the dashboard origin and
  refused for another; `RateLimit` headers, and with a different spoofed
  `True-Client-IP` / `X-Forwarded-For` on each request the remaining count
  still fell 119 → 118 → 117 (one bucket, keyed on the real client); the
  dashboard's `/sessions` returns 200.
- **Browser** (headless Brave, fresh profile): a visit to the live demo
  (`?utm_source=smoke`) plus a click on "Shop now" was stored in Atlas as
  1 session, 3 events, with no console or network errors. The live
  dashboard showed it in the sessions list (1 row), in the journey (2
  visits) and on the Home heatmap: the demo page renders inside the iframe
  and the dot sits on "Shop now". After the previews the count was still
  1 session, 3 events, so preview visits aren't recorded. The demo footer's
  "View dashboard" link is visible and points at the Vercel dashboard.
- **Seeded production** after the user confirmed twice ("seed production 50",
  then "yes"): `npm run seed -- --sessions 50 --base-url
  https://useranalytics-api.onrender.com --allow-remote`, with the URI passed
  as an environment variable for that command only. It inserted 202 events and
  deleted nothing. The live API then reported 52 sessions (50 seeded, the
  smoke-test visit and one other real visit). The live Products heatmap
  draws 54 desktop and 23 mobile dots, each on its element.

## 2026-10-14 — Phase 7: pushes and the Vercel dashboard
- `0e0b415` `chore(deploy)`: `render.yaml` (Blueprint for `useranalytics-api`:
  repo root, `npm ci --omit=dev -w server`, `node server/src/index.js`,
  `/health`, free, Singapore, `NODE_VERSION=22`, `NODE_ENV=production`,
  `CLIENT_IP_HEADER=true-client-ip`; `MONGODB_URI` and `DASHBOARD_ORIGIN` are
  `sync: false`) and `dashboard/vercel.json` (`npm ci -w dashboard
  --include=dev`). Both were tested locally first in a throwaway clone
  (`scratch/deploy-check`): the server-only install is 16 MB and boots in
  production mode; the dashboard-only install builds. README "Deployment"
  section added.
- **First push** (user-approved): a secret scan of all 24 commits found only
  the fake URIs in `seed.test.js`. HTTPS push has no stored credentials, so
  the push went over SSH to the same repo; `main` tracks `origin/main`.
- **Vercel** (user asked the agent to do it): the Vercel CLI was already
  signed in (`prakhar23381-9369`), and the account's GitHub app was
  installed. The project `useranalytics-dashboard` was created with
  `vercel api` (POST `/v11/projects`: Next.js, root `dashboard`, linked to
  `prakhar23381/UserAnalyticsApplication`, `NEXT_PUBLIC_API_URL` for
  production and preview), then PATCHed to Node 22.x. The auto-mode
  classifier blocked this until the user approved it explicitly.
- `f678a6f` `docs`: README live links, "Hosting" row; `demo.js`
  `PRODUCTION_DASHBOARD_URL = https://useranalytics-dashboard.vercel.app`.
  **Second push** (approved) triggered the first production build: the
  custom install ran (411 packages, 19 s), Next 16.4 compiled, and the build
  finished in 34 s. The production alias is `useranalytics-dashboard.vercel.app`,
  publicly reachable (no login wall), with the API URL inlined in the
  client bundle.
- Still open: Atlas and Render (user), the production smoke test, and
  seeding production.

## 2026-10-14 — Server: rate limit on `POST /api/events`
- Closes the TODO §3 stretch item. `express-rate-limit` 8.7.0 (locked to
  8.7.0, about six weeks old; 8.7.1 was 8 days old), in
  `server/src/middleware/rateLimit.js`: 120 requests a minute per client,
  counted in memory per process. It sends standard `RateLimit` and
  `RateLimit-Policy` headers (draft 8), and `429 { error }` with
  `Retry-After` over the limit. It runs after the ingest CORS (so the 429 is
  readable) and before the router parses the tracker's `text/plain` body.
  Read endpoints aren't limited.
- Client key (user decision D2a): `req.ip` by default. With
  `CLIENT_IP_HEADER` set (production on Render: `true-client-ip`), the
  header's value, falling back to `req.ip`. Both go through
  `ipKeyGenerator`, so IPv6 addresses group by /56. Reason: Render keeps a
  client-sent `X-Forwarded-For` and appends to it; the proxy hop count is
  undocumented, and `True-Client-IP` is overwritten by Render's edge (Render
  staff demo `johnbeynon/header-test`).
- `createApp` takes `clientIpHeader` and `ingestLimit` (tests use small
  limits). `config.js` reads `CLIENT_IP_HEADER`, and `server/.env.example`
  documents it, commented out.
- New `test/rateLimit.test.js` (7 tests): default policy headers; 429 body,
  `Retry-After` and CORS, with nothing stored; reads unaffected; spoofed
  headers ignored by default; per-header buckets, /56 grouping and the
  fallback with `clientIpHeader`. `npm test`: 152 passed. The running dev
  API serves the headers (`RateLimit: "120-in-1min"; r=119; t=60`).
- README: configuration row, API reference (rate limit bullet, 429 row),
  trade-offs, next steps (a shared store for several instances), tech stack.

## 2026-10-14 — Demo: products heading aligned
- Closes TODO §5. `.page-title { padding: 40px 0 8px }` came after
  `.container { padding: 0 20px }` and zeroed its side padding. On
  `products.html` both classes are on one element (on `about.html`,
  `.page-title` sits inside the container, so it was fine). Now
  `padding-top` and `padding-bottom` only, like `.nav` and `.products`.
- Re-measured with `scratch/measure-layout.mjs`: only the products `h1`
  moved (x 80→100 at 1280, 0→20 at 768 and 375). Page heights and every
  link and button box are unchanged, so the seed's `LAYOUT` (which has no
  heading box), the seeded data and `seed.test.js` stand.
- `docs/images/heatmap.png` retaken with the aligned heading. `npm test`:
  145 passed.

## 2026-10-14 — Phase 8: README
- `README.md` for hiring reviewers: summary, screenshots, how it works (ASCII
  diagram, event flow, how the heatmap places clicks), tech stack, local
  setup with configuration and test commands, embedding the tracker (fields,
  privacy, behaviour), the seed script, the API reference (5 endpoints with
  parameters, status codes and sample responses taken from the local API),
  the data model and indexes, assumptions and trade-offs (every item from
  the TODO list, plus the 2026-10-14 heatmap `y` rule), what I'd do next,
  and the project layout.
- No live links yet (Phase 7); one TODO item remains for them. The API
  reference stays in the README, with no `docs/api.md`.
- **Screenshots** in `docs/images/` (sessions, journey of
  `seed_ssiege41n1vj`, desktop Products heatmap): 2560 px wide, light mode,
  from the local seeded data. They were taken in headless Brave at device
  scale 2 (`DPR` option added to `scratch/dashboard-check.mjs`), with the
  Next.js dev indicator removed before capture. Total 1.1 MB.
- **Fresh-clone check** of the setup steps, in
  `scratch/readme-check/UserAnalyticsApplication` (a clone of `492f51d`):
  - Steps run: `docker compose up -d` (with `COMPOSE_PROJECT_NAME=causalfunnel`,
    so it reused the running container instead of binding :27017 twice),
    then copying the env files, `npm install` (25 s; the mongod binary,
    141 MB, landed in `node_modules/.cache`), `npm run seed`, and
    `npm run seed -- --reset --base-url http://localhost:4100`.
  - Its own database `causalfunnel_readme` and ports 4100/3100, so the dev
    data and the running dev servers on 4000/3000 were untouched. The API and
    the dashboard were started with the two workspace scripts that
    `npm run dev` combines.
  - Results: `/health`, `/demo/` and `/tracker.js` answer. The README's curl
    example returns `{"accepted":1,"rejected":0}`. A repeated query param
    gets 400, an unknown session 404, and CORS allows the configured origin.
    A visit in headless Brave reached the API by beacon on navigation. The
    clone's dashboard showed the sessions list, the journey and the mobile
    heatmap, with the iframe loading and no console or network errors.
  - In the clone: `npm test` 145 passed (`--project tracker` 24),
    `npm -w dashboard test` 57 passed, and typecheck, lint and build are clean.
- The build shows `/sessions/[id]` as dynamic (rendered on demand), so the
  README says the server renders "only the page shell" rather than "static
  shells".

## 2026-10-14 — Heatmap: phone and tablet `y` scaled by page height
- Closes the one Phase 6 miss (TODO §8). The user chose option B with a fix
  for short pages, and the most common height as the reference.
- **Mechanism** (`dashboard/src/lib/heatmap.ts`): `referenceHeight()` takes
  the most common `doc_h` (the taller on a tie) among clicks recorded in a
  window exactly the reference width (768 tablet, 375 mobile).
  `placeClick()` scales `y` by `refHeight / doc_h`; `layoutClicks()`
  computes the reference once and sizes the canvas from the scaled heights.
  Desktop `y` is never scaled.
- **The flaw found while planning:** `doc_h` is `scrollHeight`, which is the
  window's height when the page is shorter than the window (seeded tablet
  Home: `doc_h` 1024 in a 768×1024 window). Plain scaling would move an
  iPad Air (820×1180) "Shop" click from y 340 to 295, off the button. Only
  clicks with `doc_h > viewport_h` set the reference or get scaled.
- **API change (additive):** `GET /api/heatmap` clicks now include
  `viewport_h`. Same query, sort and index. `HeatmapClick` in
  `dashboard/src/lib/types.ts` gained the field.
- **Checked:** the stored e2e phone click on the About CTA (390×844,
  `y` 3094, `doc_h` 3390) is drawn at (192.3, 3161.5), inside the button's
  375 px box `[112, 3117, 152, 54]`. Before the change it sat 23 px above.
  Confirmed on the live dashboard in headless Brave (Mobile tab, About).
- Tests: `npm test` 145 passed. `npm -w dashboard test` 57 passed (+11:
  `referenceHeight`, phone/tablet scaling, the iPad case, the e2e click; "never
  scales y" became "never scales desktop y"). Typecheck and lint are clean.

## 2026-10-13 — Phase 6: local end-to-end check
- The documented startup works from scratch: `docker compose up -d` →
  `npm install` → `npm run dev`. It starts the API (:4000) and the
  dashboard (:3000) together; `next dev` no longer writes an AGENTS.md. The
  previous session's background API (`node --watch`, since 03:11) was
  stopped first to free the port.
- `scratch/e2e-check.mjs` (git-ignored) drives headless Brave 152 over CDP
  with a fresh profile and real mouse clicks. Final run: **23/24 checks
  pass**. The first run's two "not drawn" failures were the script
  comparing against its own measured points; the dashboard draws the stored
  values, which the browser rounds by up to 0.9 px. Results:
  - **Desktop at 1512 px**, which isn't a reference width: home → products
    (3 adds) → about (newsletter with a typed email) → bottom CTA →
    products.
    - All 12 events were stored in order, with x/y within 1 px of the
      clicks, `doc_w` 1512, `raw_url` keeping `?utm_source=e2e`, and
      `page_url` normalized.
    - The typed email appears in no stored event and no request body.
    - Batches are POST `text/plain` with 202 responses. The home page's
      queued events arrived through the pagehide beacon.
  - **Journey page:** 4 visits in order, with source `e2e`.
  - **Heatmap (desktop):** all 8 desktop clicks are drawn on the 1280
    layout, and each lands on the element that was clicked (centre
    anchoring, Phase 4 D1). Event count was unchanged by the previews
    (262 → 262).
  - **Same visitor at 390 px (phone):** the session is kept, and the 7
    events are stored as `mobile`. All 4 phone dots are drawn, and 3 of 4
    land on their elements.
  - **The miss:** the About page's bottom CTA. The page is 51 px shorter at
    390 than at 375 (text reflow), so with raw `y` the dot sits above the
    button. Scaling `y` by document height (`y × refH / doc_h`, where
    `refH` comes from the seeded 375 px clicks) put all 4 on their
    elements. The decision is with the user (TODO §8).
  - **Script-changed DOM:** submitting the newsletter replaces the form
    with a shorter line, so the desktop CTA below it moved 12 px for the
    visitor. The static preview doesn't show this; the dot still landed on
    the button. Added to the README trade-offs.
  - **Inactivity timeout,** by ageing `cf_session.last_activity` in a
    second tab (no code change): 29 min idle keeps the session, 31 min
    starts a new one, whose first event is the page view.
  - **Live update:** the new session appeared on the already-open
    `/sessions` page without a reload, 8.9 s after the visit (up to 5 s
    tracker flush plus up to 5 s poll). The test keeps that tab focused,
    because SWR doesn't poll hidden tabs.
  - No console errors on the demo pages; every ingest response seen was 202.
- `npm test`: 145 passed. `npm -w dashboard test`: 46 passed.
- The two e2e runs added 4 real tracker sessions to the local `causalfunnel`
  database (now 272 events, 48 sessions).

## 2026-10-13 — Phase 4: dashboard
- `80ee86f` Setup.
  - Scaffolded with `create-next-app@16.4.0` (Next 16.4, React 19.3,
    Tailwind 4, TypeScript 5, ESLint 9), with `--skip-install` and with no
    AGENTS.md, React Compiler, cache components or agent feedback. It was
    then installed from the root (hoisted), and `swr` and `vitest` were
    added to the workspace.
  - Three scaffold traps fixed:
    - The template `.gitignore` ignored `.env*`; it now un-ignores
      `.env*.example`.
    - `typecheck` runs `next typegen` before `tsc`.
    - `next dev` wrote a `dashboard/AGENTS.md`; `agentRules: false` in
      `next.config.ts` stops that, and Next removed the file itself.
  - `lib/`:
    - `api.ts`: fails fast without `NEXT_PUBLIC_API_URL`; `ApiError` carries
      the status; `useApi` polls every 5 s.
    - `heatmap.ts`: the Phase 4 D1 mapping, off-canvas counting, grid
      binning and the `previewUrl` guard.
    - `journey.ts`: page-visit grouping, source, page-view notes.
    - `format.ts`: display helpers.
  - App shell: Nav; `/` → `/sessions`; loading state with a cold-start
    note; error states (full and stale); empty state; favicon.
  - The `create-next-app` empty-folder constraint (Reference Decision of
    2026-10-12) no longer applies: the scaffold came first, then the env
    example.
- `b72e55c` Sessions list and journey.
  - `/sessions`: paginated with `?page=`, polled every 5 s, rows kept while
    the next page loads, the whole row clickable, columns collapse on
    phones.
  - `/sessions/[id]`:
    - Header facts: start, duration, events, pages, device and viewport,
      and source (from `utm_source`, else the referrer).
    - Timeline grouped by page visit: stopwatch offsets, badges, click
      targets with (x, y), the arriving query string and outside referrer,
      and a heatmap link per visit.
    - "Session not found" for an unknown or invalid id.
- `f7da0d4` Heatmap.
  - `/heatmap?page=&device=&mode=`:
    - Page picker: most-clicked page first; the default is pinned into the
      URL, so polling can't switch it.
    - Desktop / Tablet / Mobile tabs (D2) and a Dots / Grid toggle.
  - The stage: the live page in a `sandbox=""` iframe at the reference
    width, with an SVG overlay, scaled to fit.
    - Dots have a white ring so they show on the demo's orange buttons.
    - The stats line shows off-canvas clicks and the 5000 cap.
    - The previous picture stays (dimmed) until the next response arrives.
- Decisions D1 (mapping), D2 (no All tab), D3 (dashboard unit tests) and
  browser-only fetching with a sandboxed iframe are in the recovery context
  §4. Tests: 46 dashboard (`npm -w dashboard test`), 145 server, all green.
  Typecheck, lint and build are clean.
- Browser check in headless Brave 152 (`scratch/dashboard-check.mjs`; API
  and dashboard dev servers on the dev database):
  - Sessions, pagination (page 3, an out-of-range page 9), row click, the
    seeded and real journeys and the not-found page work in light and dark
    themes at 1280 and 375, with no console errors.
  - Heatmap dots and grid land on the demo's buttons, links and photos for
    desktop, tablet and mobile. That includes the real desktop clicks
    recorded at `doc_w` 1425, which the centre anchoring shifts by 72.5 px.
  - Event counts were 228 / 92 page views before and after six heatmap
    previews: the iframe records nothing.
  - The journey → heatmap link opens the right page and device.
- Found, not fixed: the `products.html` heading sits outside the container
  padding (Phase 3 demo CSS). It's a TODO item, because fixing it means
  re-measuring the seed layout.
- `npm audit`: 5 high, all one `braces` advisory reached only through
  `eslint-config-next` (lint time). It was left as is; npm's fix is a
  downgrade to `eslint-config-next@14`.

## 2026-10-13 — Phase 3 closed: seed script
- `b19e238` `server/scripts/seed.js`, run as `npm run seed` (root or `-w server`).
  - **Journeys:** each session has an entry page and a source (direct, Google,
    `?utm_source=newsletter|instagram`, some on `/demo/index.html`). Visitors
    move through real links and CTAs, add products by popularity, sign up for
    the newsletter, bounce (about 40% are single-page), and sometimes click a
    product photo. The cart link shows the running count ("Cart 3"). Events
    are 2–60 s apart, over the last 7 days.
  - **Positions:** each click lands inside an element box measured in headless
    Brave at 1280 / 768 / 375 with scrollbars hidden
    (`scratch/measure-layout.mjs`, git-ignored). Targets are exactly what
    `tracker.js` records.
  - **Shape:** every event goes through `validateEvent`, then gets
    `user_agent` and `received_at` as `POST /api/events` adds them. The script
    throws if `validateEvent` rejects one.
  - **Safety:** session ids start with `seed_`, and `--reset` deletes only
    those (Seed D1; `IXSCAN` on `session_id_1_timestamp_1`). A non-localhost
    URI is refused without `--allow-remote`, and credentials are never
    printed. `--sessions N` (default 40), `--base-url` (default
    `http://localhost:4000`).
  - **Tests:** 22 in `test/seed.test.js`, using a seeded PRNG: validity, ids,
    ordering, coverage at the reference widths (Seed D2), click-in-element,
    link → `page_view` with referrer, cart count, reset scope, URI guard.
    145 tests in total.
- Verified on the local `causalfunnel` database: two `--reset` runs. The 36
  real events from Phase 3 survived both, and the second run replaced the 156
  seeded events instead of adding to them. `/api/sessions` (44 sessions),
  `/api/pages`, `/api/heatmap` for all 3 devices, and a seeded journey through
  `/api/sessions/:id/events` all read back correctly.
- Decisions D1 (reset scope) and D2 (reference widths only) are recorded in
  the recovery context §4.

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
