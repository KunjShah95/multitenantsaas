# Plan execution protocol

Use this folder to direct implementation agents. Say: **“Start Phase 04 from
`plans/phase-04-quotes.md`.”** The agent must follow that file exactly.

## Mandatory agent protocol

1. Read `plans/PHASES.md`, the chosen phase file, and only the docs listed in
   its **Required reading** section. Do not load the entire docs folder.
2. Inspect repository status and relevant existing code before editing. Preserve
   unrelated user changes. Do not delete the legacy proof of concept unless the
   phase explicitly says so.
3. Check every **Owner prerequisite**. If a required cloud account/secret or
   product choice is absent, implement only safe non-secret work and report the
   exact blocker; do not invent credentials or silently switch to local SQLite.
4. Implement every item under **Do in this phase**, but nothing under **Do not
   do**. Keep changes narrow: no opportunistic redesign, package spree, or
   unrelated formatting migration.
5. Add/update tests, run every command under **Validation**, and report actual
   result. A command that cannot run must be reported with cause, never claimed
   as passed.
6. Update the specified API/OpenAPI/docs only when the phase says to. A change
   to contract, status, or security decision must update its authoritative doc.
7. Stop after all **Definition of done** bullets pass. The next phase is not
   implicit authorization.

## Global non-negotiables

- Neon PostgreSQL is the only authoritative database. Never introduce local
  SQLite/JSON/in-memory persistence for new production paths.
- All tenant records are tenant-scoped; authorization and RLS are both required.
- Server owns commercial/financial/stock calculations and workflow transitions.
- No secret in tracked files, logs, test fixtures, docs, or commit messages.
- New command = validation + authorization + error handling + idempotency/
  revision where applicable + audit + tests + API documentation.
- Keep the application a modular monolith; do not add Redis, microservices,
  GraphQL, a second ORM, or unrelated frameworks without an explicit plan/doc
  change approved by the owner.

The phase index is [PHASES.md](PHASES.md).
