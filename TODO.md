# CausalFunnel — TODO

Tracker script → Node API → MongoDB → Next.js dashboard. Spec: `docs/assignment.md`.
Built, deployed and seeded (2026-10-14); every spec requirement checked on the
live site. Live links are at the top of `README.md`.

Priority tags: **[M]** must (spec requirement) · **[S]** should · **[X]** stretch

> **Outstanding work only** (CLAUDE.md §9). When an item is done, log it in `STATUS_LOG.md` and **delete** its line here. Don't tick it.
> Decisions: `.agent_recovery_context.md` §4 · File structure: CLAUDE.md §3 · History: `STATUS_LOG.md`.

---

## 1. Submission

- [ ] **[M]** (user) Submit the repo link and the live links
- [ ] **[S]** (user) UptimeRobot monitor on `https://useranalytics-api.onrender.com/health` every 5 min (option a, chosen 2026-10-14). Keeps the free Render API awake: one service 24/7 uses ≤ 744 of the 750 free hours a month; don't run a second always-on free service in the same workspace
- [ ] **[S]** (user, after submitting) Rotate the Atlas database user's password (it was pasted into the chat) and update `MONGODB_URI` on Render
- [ ] **[S]** (agent, needs push approval) Push `da87007` (`*.env` in `.gitignore`). Not urgent: the ignore rule already protects the local `atlas-credentials.env`

---

## 2. Open from the build

- [ ] **[S]** Tracker opt-outs, found while reviewing an embed on another site (Akshara, 2026-10-15, skipped): needed before embedding on sites with PIN pads or ids in query strings
  - `data-cf-ignore` on an element: clicks on or inside it aren't recorded at all (button text and tap positions would otherwise reveal a PIN)
  - `data-strip-query` on the `<script>` tag: send page URLs and referrers without query or hash (the API's reads have no login, so ids in URLs are public)
- [ ] **[X]** Tracker: SPA support (patch `history.pushState`, listen to `popstate` → `page_view`). Today, client-side route changes in React/Next sites aren't page views
- [ ] **[X]** Tracker: client `event_id` + unique index → idempotent ingestion, so failed batches can be retried
- [ ] **[X]** Tracker: respect `navigator.doNotTrack === '1'` (deprecated; Safari dropped it)
- [ ] **[X]** Tests: one Playwright smoke test of the dashboard (sessions list renders, heatmap shows dots)

---

## 3. Phase 9 — Feature expansion (PLANNING)

Requested 2026-10-15. **Nothing here is approved for implementation:** each
item goes through Plan → Ask (CLAUDE.md §5) with its own decisions. Every new
query must hit an index, and a new event type means updating the Mongoose enum,
`validateEvent.js`, `EventBadge` and the README (CLAUDE.md §4).

### Shared groundwork
- **G1 Page-view id.** A client `page_view_id` on every event, so clicks, scroll
  depth and attention can be tied to one page view. Also the base for `event_id`.
- **G2 Page-exit summary event.** One event per page view, sent when the page is
  hidden or unloaded, carrying max scroll depth and time per band. Decision: one
  `engagement` type, or separate `scroll` and `attention` types. Mobile browsers
  don't always fire `pagehide`, so send on `visibilitychange` and dedupe by G1.
- **G3 Element identity.** The tracker records a stable selector (`target.selector`)
  and the clicked element's box at click time (`target.box`: document x, y, w, h).
  Existing clicks lack both, so element views cover new data only (the seed
  regenerates).
- **G4 Seed data.** Generate the new fields and events from the measured layout, so
  production views aren't empty.

### Features
- [ ] **[S] 1. Top-ranked elements per page.** Elements ranked by clicks, with share of
  the page's clicks and unique sessions, per page and device.
  - API `GET /api/elements?page=&device=`: `$group` by element over the
    `{page_url, type, device}` index
  - Needs G3 for reliable identity; older clicks fall back to `tag#id.classes` + text
  - Dashboard: a table beside the heatmap; selecting a row highlights that element's clicks
- [ ] **[S] 2. Element click heatmap.** Outline each clicked element on the preview,
  coloured and labelled by its click count.
  - The preview is a cross-origin sandboxed iframe, so the dashboard can't read
    element boxes from it; they come from G3's recorded boxes, mapped to the
    reference width like clicks
  - Replaces "element-relative heatmaps" in the README's next steps
- [ ] **[S] 3. Scroll heatmap.** The share of page views that reached each depth,
  drawn as bands over the preview, with the average fold line.
  - Data: G2's max scroll depth (px, and % of `doc_h`) per page view
  - API `GET /api/scroll?page=&device=` returns a depth histogram
  - Pages shorter than the window count as 100%; fixed-viewport apps don't scroll
- [ ] **[S] 4. Area heatmap.** Drag a rectangle on the heatmap to count the clicks
  inside it and their share of the page.
  - Dashboard only, on existing data: a helper in `lib/heatmap.ts` with unit tests;
    no tracker or schema change. The smallest feature, and a good first step
  - Decision: count the ≤ 5000 clicks already loaded, or ask the server for the
    full total
- [ ] **[S] 5. Attention map.** Where visitors spend time on the page.
  - Tracker: while the tab is visible and the visitor is active, sample the visible
    part of the page (e.g. every second) and add up milliseconds per 50 px band;
    send the totals in G2's summary
  - API: time per band, normalized per page view; dashboard: an intensity overlay
  - Decisions: band size, idle rule (e.g. no input for 30 s), payload cap
- [ ] **[S] 6. Dashboard UI improvements.** Scope with the user first. Candidates:
  - an overview page: sessions, page views, clicks, average duration, top pages,
    sessions over time
  - filters (date range, device, traffic source) and session search
  - one heatmap page with modes: Clicks · Elements · Scroll · Areas · Attention,
    with a legend, opacity control and counts
  - a consistent visual system (spacing, type scale, colour tokens), a better
    phone layout, focus states and contrast
  - Constraints (CLAUDE.md §3): no UI component library beyond Tailwind without
    asking; charts mean either a new dependency or hand-made SVG (decision)

**Suggested order:** 4 (no tracker change) → G3, 1, 2 → G1, G2, 3, 5 → the UI
pass alongside. Each feature ships with tracker tests (happy-dom has no layout,
so sizes must be stubbed), API tests, `lib/` unit tests, a seed update and README
changes (data model, API reference, trade-offs).
