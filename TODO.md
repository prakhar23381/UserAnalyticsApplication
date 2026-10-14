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

- Privacy opt-outs and single-page-app page views moved into Phase 9, M6.
- [ ] **[X]** Tracker: client `event_id` + unique index → idempotent ingestion, so failed batches can be retried
- [ ] **[X]** Tracker: respect `navigator.doNotTrack === '1'` (deprecated; Safari dropped it)
- [ ] **[X]** Tests: one Playwright smoke test of the dashboard (sessions list renders, heatmap shows dots)

---

## 3. Phase 9 — Trailmark v2 (planned)

Plan and decisions: `docs/v2-plan.md` (approved direction 2026-10-15). Work on the
`v2` branch; `main` stays the submitted version. **Each milestone needs its own
detailed plan and approval before code changes.**

- [ ] **[S] M2** (in progress 2026-10-15: M2a server, M2b dashboard filters, M2c saved segments + watchlist; detail in `docs/v2-plan.md` → M2) Segments: `sessions` collection updated on ingest + backfill, browser/OS/country/campaign enrichment, every filter on every tab (heatmaps count only matching sessions), saved segments, default segment, watchlist (browser storage); check whether Render forwards `CF-IPCountry`
- [ ] **[S] M3** Insights: rage clicks, quick backs (server), dead clicks (tracker); Overview insight cards; session insight chips
- [ ] **[S] M4** Heatmaps v2: Heat display, legend and counts, element identity (selector + box), ranked elements with badges, element heatmap, area tool, CSV export
- [ ] **[S] M5** Engagement: page-view id, end-of-visit summary, scroll heatmap, attention map, excessive scrolling
- [ ] **[S] M6** Custom tags (`window.trailmark.tag`), session labels, comparing two segments, privacy opt-outs (`data-cf-ignore`, `data-strip-query`), single-page-app page views
