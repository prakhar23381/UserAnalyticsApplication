# Status Log — CausalFunnel

*Permanent record, newest first. Append only: never edit or delete past entries.*

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
