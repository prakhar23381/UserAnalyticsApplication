# Trailmark v2 — plan

*Approved direction, 2026-10-15. Each milestone still gets its own detailed plan
and approval before any code changes (CLAUDE.md §5). Work happens on the `v2`
branch; `main` stays the submitted version until v2 is ready.*

Trailmark is the new name for the product built for the CausalFunnel take-home:
a tracker script, an API and a dashboard for sessions and heatmaps. Layout ideas
are taken from Microsoft Clarity's heatmap and insights screens, without its
branding.

## Decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Name | **Trailmark**: every visit leaves a trail (sessions), every click a mark (heatmaps). Trademarks and domains not checked |
| D2 | Layout | **One page**: the filter bar (segment) at the top; **Overview · Sessions · Heatmaps** as tabs below it, on the same page |
| D3 | Saved segments, default segment, watchlist | **In each viewer's browser** (localStorage). No accounts: server-side storage would need login, which is out of scope |
| D4 | Session attributes | **A `sessions` collection, updated on every ingest** |
| D5 | Country | **Use `CF-IPCountry` if Render forwards it.** Not documented anywhere; verified in M2 with a real visit. If absent: choose `geoip-lite` (city level, large data file) or no location |
| D6 | Browser and OS | **A small built-in parser** for the main browsers and systems, from the stored user agent |
| D7 | Icons | **`lucide-react`, always with a text label beside the icon** |
| D8 | Charts | **Recharts**: professional defaults (axes, tooltips, legends, responsive) with little configuration, React components, SVG output that follows the colour tokens in light and dark mode. Compatibility with React 19 / Next 16 checked when it is installed |
| D9 | Insight thresholds | Rage: ≥ 3 clicks, each ≤ 700 ms after the last, within 30 px. Dead: no page change, navigation or scroll within 1 s of a click. Quick back: A → B → A with < 7 s on B |
| D10 | New vs returning visitors | **Skipped**: no long-lived visitor id |
| D11 | Branches | **`v2` branch.** Server changes are additive and backward-compatible, so they can reach `main` and Render without breaking the live dashboard. The v2 dashboard is previewed on Vercel against the live API; `main` changes when v2 is ready |

## Layout (D2)

```text
[Trailmark mark] Trailmark                                         Demo site ↗
[Segment: All visitors ▾] [Last 7 days ▾] [Desktop | Tablet | Phone] [+ Filter] [Save] [★ Default]
[ Overview ] [ Sessions ] [ Heatmaps ]          ← tabs on the same page
```

- All state is in the URL (`?tab=…` plus the filters), so any view can be shared
  and the back button works.
- The segment applies to every tab: heatmaps only count the sessions that match
  the filters, and so do the Overview numbers.
- Cross-links: from a heatmap element to "sessions that clicked it" (Sessions tab,
  filtered); from a session's journey to the heatmap of a page with the same segment.
- Old URLs (`/sessions`, `/sessions/[id]`, `/heatmap`) redirect to the new ones.
- Every icon has a text label (D7).

### Overview tab
- Totals for the segment: sessions, page views, clicks, average duration, pages per
  session, bounce rate, each with the change from the previous period.
- Sessions over time (line chart); top pages; devices, browsers, countries.
- **Insights** cards: rage clicks, dead clicks, quick backs, excessive scrolling, each
  as a share of sessions with a session count. A card opens Sessions filtered to it.
- **My watchlist**: pinned segments, pages and tags, each with sessions, insight
  shares and a trend.

### Sessions tab
- Table: session, device (icon and label), browser, country, source, pages, duration,
  events, insight chips (rage / dead / quick back), start time.
- A session opens its journey inside the tab (`?session=<id>`), keeping the filters,
  with insight markers on the timeline.

### Heatmaps tab
- Toolbar (icon + label): page picker; device (Desktop / Tablet / Phone); mode
  (Click / Scroll / Area / Attention); display (Dots / Grid / Heat); Export.
- Left: elements ranked by clicks (selector or text, clicks, share, "sessions ↗").
- Right: the live page with the overlay; numbered badges on the top elements; a
  hot-to-cold legend; page views and clicks in the footer.
- The device switch picks the layout to draw; devices excluded by the segment's
  device filter are disabled.

## Insights

| Insight | How it's found | Tracker change |
|---|---|---|
| Rage clicks | From stored clicks, per page view (D9) | No |
| Dead clicks | The tracker watches the page for 1 s after a click (DOM mutation, navigation, scroll); otherwise the click is sent with `dead: true` | Yes |
| Quick backs | From the order of page views (D9) | No |
| Excessive scrolling | Scroll distance far beyond the page height, from the end-of-visit summary | Yes (M5) |

## Filters

Date range, device, browser, OS, country (D5), traffic source (referring domain),
campaign (`utm_source`, `utm_medium`, `utm_campaign`), entry page, exit page, visited
page, session duration, pages per session, clicks, has rage click / dead click /
quick back / excessive scrolling, custom tag.

**Segments** (D3): a named set of filters, saved in the browser. One can be the
default, applied on every visit. **My watchlist** pins segments, pages and tags to
the Overview tab.

## Backend

1. **`sessions` collection** (D4), upserted on every ingest batch: first and last
   seen, duration, page views, clicks, pages, entry and exit page, device, browser,
   OS, country, referrer domain, campaign, tags, and insight counts. A one-off
   backfill builds it from existing events; running that on production needs the
   user's double confirmation (CLAUDE.md §10).
2. **Enrichment on ingest:** browser and OS from the user agent (D6), country (D5),
   campaign from the landing page's UTM tags. IP addresses are never stored.
3. **One filter parser** (`server/src/lib/segment.js`) shared by every read
   endpoint: it finds the matching sessions in `sessions`, then restricts event
   queries to them. Every new query gets an index (CLAUDE.md §4).
4. **New endpoints:** `/api/overview`, `/api/elements`, `/api/scroll`,
   `/api/attention`, `/api/filters` (values for the filter menus). Existing
   endpoints gain the filter parameters. Responses only add fields.

## Tracker additions

Still zero dependencies, ES5 syntax, never throws, every event validated.

- The clicked element's selector and box (ranked elements, element heatmap).
- Dead-click detection.
- A page-view id, and an end-of-visit summary: maximum scroll depth, time per
  50 px band, active time.
- Page views for single-page-app route changes.
- A custom tags call, `window.trailmark.tag(key, value)`.
- Privacy opt-outs: `data-cf-ignore` on elements, `data-strip-query` on the script tag.
- Internal names (`cf_session`, `cf_preview`, `__cfTracker`) stay as they are, so
  existing sessions and heatmap previews keep working.

## Seed data

New scenarios so the live demo shows every view: rage clicks, dead clicks, quick
backs, campaigns, browsers, countries, scroll depth and attention.

## Milestones

| # | Milestone | Size |
|---|---|---|
| M0 | Current version submitted from `main`; v2 work on `v2` | — |
| M1 | Brand, design system, icons, the one-page layout with tabs; filter bar with date range and device; Overview with totals and charts | M–L |
| M2 | Segments: `sessions` collection and backfill, enrichment, every filter on every tab, saved segments, default, watchlist; D5 check | L |
| M3 | Insights: rage clicks, quick backs, dead clicks; Overview insight cards; session insight chips | M–L |
| M4 | Heatmaps v2: Heat display, legend and counts, element identity, ranked elements with badges, element heatmap, area tool, CSV export | L |
| M5 | Engagement: scroll heatmap, attention map, excessive scrolling | M–L |
| M6 | Custom tags, session labels, comparing two segments, privacy opt-outs, single-page-app page views | M |

Each milestone ships with tests (tracker, API, `lib/`), seed updates, README changes
(data model, API reference, trade-offs) and bookkeeping.

## Not planned

- **Session recordings** (Clarity's "View recordings"): page recording needs a large
  dependency, storage for recordings and heavy privacy masking. The equivalent here
  is "View sessions", the journeys.
- **Accounts and login**: out of scope (CLAUDE.md §3), which is why segments live in
  the browser (D3).

## M2 in detail (approved 2026-10-15)

Three commits on `v2`: **M2a** server, **M2b** dashboard filters, **M2c** saved
segments, default segment and watchlist.

| # | Decision | Choice |
|---|---|---|
| M2-D1 | Keeping `sessions` current | Each session in an ingest batch is **recomputed from its events**; the same function serves ingest, backfill and seed. A recompute with fewer events never overwrites one with more |
| M2-D2 | Backfill | **At server start**, before listening, when `sessions` is empty but events exist; `npm -w server run sessions:rebuild` rebuilds everything |
| M2-D3 | Filters on event-based views | Find the matching session ids in `sessions`, then count only their events. A date range there means "events of sessions that started in the range" |
| M2-D4 | Saved segments | Store the filters **without the date range** |

**Session document:** `session_id` (unique), `first_seen`, `last_seen`,
`duration_ms`, `event_count`, `page_views`, `clicks`, `pages`, `entry_page`,
`exit_page`, `device`, `browser`, `os`, `country`, `referrer` (external host
without `www.`), `utm_source`, `utm_medium`, `utm_campaign`, `source` (UTM
source, else referrer, else `Direct`). Indexes: `session_id` unique,
`first_seen`, `last_seen`.

**Filter parameters** (all optional, combined with AND):

| Parameter | Value |
|---|---|
| `from`, `to`, `devices` | as in M1 |
| `browsers`, `os`, `countries`, `referrers` | comma-separated; `unknown` / `direct` match a missing value |
| `utm_source`, `utm_medium`, `utm_campaign` | one exact value each |
| `entry_page`, `exit_page`, `visited_page` | one page URL each, normalized |
| `min_duration`, `max_duration` (s), `min_pages`, `max_pages`, `min_clicks`, `max_clicks` | whole numbers, inclusive |

**Country (D5):** optional env `COUNTRY_HEADER`, stored on each event as
`country`. The live API answers through Cloudflare (`server: cloudflare`,
`cf-ray`), so `CF-IPCountry` may reach Render; checked with a real visit once
M2a runs there.

**New endpoint:** `GET /api/filters?from=&to=`: the values in the range with
session counts, for the filter menus.

## M3 in detail (approved 2026-10-15)

Three commits on `v2`: **M3a** server and seed, **M3b** tracker (dead clicks),
**M3c** dashboard.

| # | Decision | Choice |
|---|---|---|
| M3-D1 | Rage-click radius | Every click of a burst within 30 px of the burst's **first** click, so a burst can't drift across the page |
| M3-D2 | Dead-click delivery | The tracker **holds a click for 1 s**, then sends it with `dead: true` if nothing changed; a click held when the page is left goes out at once without the flag. No new event type |
| M3-D3 | Which clicks can be dead | All clicks except form fields, labels, `contenteditable` and ctrl/⌘/shift clicks (they focus or open a tab) |
| M3-D4 | Existing sessions | `npm -w server run sessions:rebuild` once on the local databases; production builds its sessions with insights at first start anyway |

**Definitions** (D9), from a session's events sorted by `{ timestamp, _id }`:
- **Rage click:** ≥ 3 consecutive clicks on the same page, each ≤ 700 ms after
  the one before and within 30 px of the first. Counted per burst.
- **Dead click:** a click stored with `dead: true`. Clicks stored before M3b
  have no flag and count as not dead.
- **Quick back:** page views A → B → A (A ≠ B) with < 7 s on B. Counted per B.

**Session fields:** `rage_clicks`, `dead_clicks`, `quick_backs` (counts).
**Filter:** `insights=rage,dead,quick_back`, a list where a session needs
**all** the listed insights. **Responses add:** overview totals
`rage_sessions`, `dead_sessions`, `quick_back_sessions`; the three counts on
session rows; `rage: true` / `quick_back: true` on journey events; an
`insights` facet in `GET /api/filters`.

## M4 in detail (approved 2026-10-15)

Three commits on `v2`: **M4a** element identity (tracker, server, seed), **M4b** Heat
view, ranked-elements sidebar and badges, element heatmap, **M4c** area tool and CSV
export. Display stays **Dots / Grid / Heat**: the spec names dots and grid, so both
stay as they are and Heat is added as a third view.

| # | Decision | Choice |
|---|---|---|
| M4-D1 | Ranking | **`GET /api/elements`**, following the current segment and device: exact over all clicks, with session counts. Shown in a collapsible sidebar, "Ranked by most clicks · N elements", one card per element (rank, name, clicks and share, copy selector) |
| M4-D2 | Element identity | The tracker sends `target.selector` (short CSS path: stops at the nearest `id` or after 5 levels; tags, ids, ≤ 2 classes, `:nth-of-type`; no text or attributes) and `target.box` (`{ x, y, w, h }` in page px). Older clicks are keyed by tag, id, classes and text |
| M4-D3 | Badges | Numbered badges on the **top 10** elements, on all three views; ① in the sidebar is ① on the page. Placed at the recorded box mapped to the reference width, else at the middle of the element's clicks |
| M4-D4 | Heat colours | Classic **blue → green → yellow → red** on a `<canvas>`; legend with words ("Hot ↔ Cold"); exact numbers in the sidebar |
| M4-D5 | "Sessions that clicked it" | **Deferred** (needs an event-based session filter); fits M6 |

Footer: page views and clicks for the page in the segment, plus the legend.
