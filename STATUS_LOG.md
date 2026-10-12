# Status Log — CausalFunnel

*Permanent record, newest first. Append only: never edit or delete past entries.*

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
