# Owner setup: accounts, cloud database, and environment files

This document is for the repository owner. Complete it before asking an agent
to start any implementation phase. It does **not** require writing application
code and does not put any secret into Git.

## Required now: Neon development database

1. Create/sign in to a [Neon account](https://neon.com/).
2. Create a project named, for example, `dealflow360-dev` in a region close to
   the future API host. Select PostgreSQL; do not create a local database.
3. In the Neon dashboard, obtain both connection strings for the development
   branch:

   - the **pooled** connection string for `DATABASE_URL`;
   - the **direct/unpooled** connection string for `DATABASE_URL_UNPOOLED`.

   Never publish either string in a chat, issue, commit, screenshot, or API
   response. A pooled string is used by the web API; the direct string is only
   used by the migration command/CI.
4. Do not enable Neon Auth for this plan. The application owns membership and
   portal authorization; introducing a second identity system would complicate
   the data model.
5. Create a low-privilege runtime database role and a separate migration role
   only in Phase 1, where the exact SQL/RLS setup is implemented and reviewed.

Neon's free plan is appropriate for development/demo activity, but limits are
not guaranteed product capacity. Check the current provider pricing before
production. See [02-technology-decisions.md](02-technology-decisions.md).

## Accounts to defer until their phase

| Account | Needed in | What to create | Do not do yet |
| --- | --- | --- | --- |
| Resend | Phase 2 only if real invites/magic links must be delivered | Account, verified development sender, API key | Do not commit key or claim email is production-reliable. |
| Cloudflare R2 | Phase 9 only if exports need persisted download files | R2 bucket and scoped access key | Do not create public bucket or upload customer files. |
| Payment provider | Phase 8 only after provider is chosen | Sandbox account, webhook secret, test credentials | Do not collect real cards or enable live payment. |
| Error tracking | Phase 10/staging | Project and DSN | Do not add every optional vendor SDK beforehand. |
| Deployment host | Before staging | Choose a host that can run API and, later, a worker | Do not assume a free suspended host can run billing jobs. |

## Files and exact ownership

| File/path | Tracked? | Owner/action | Purpose |
| --- | --- | --- | --- |
| `.env.example` | Yes | Phase 0 agent creates/redacts | All variable names with safe example values/comments. |
| `.env` | **No** | You create locally from `.env.example` | Your development secrets and origins. |
| `.env.test` | **No** | CI/test owner creates when needed | Disposable Neon branch credentials; never shared production values. |
| Deployment secret store | Outside Git | You/CI owner configures before staging/production | Environment-specific secrets. |
| `db/migrations/` | Yes | Agents create/review in later phases | SQL schema history; contains no credentials. |
| `db/seed-demo.ts` | Yes | Later agent creates | Idempotent fake data only. |

Phase 0 must add `.env`, `.env.*`, and any provider credential files to
`.gitignore`, while keeping `.env.example` tracked. If the existing `.gitignore`
has project-specific entries, preserve them.

## Development `.env` template

Create `.env` at the **repository root** (`/Users/swet/Developer/Project/multitenantsaas/.env`) by copying `.env.example` once Phase 0 has created it. Fill in:

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://...pooled-neon-connection...
DATABASE_URL_UNPOOLED=postgresql://...direct-neon-connection...
JWT_ACCESS_SECRET=<generate-a-new-random-value>
SESSION_PEPPER=<generate-a-different-random-value>
APP_ORIGIN=http://localhost:5173
PORTAL_ORIGIN=http://localhost:5173

# Leave provider values absent until the relevant phase enables the adapter.
# EMAIL_PROVIDER_API_KEY=
# EMAIL_FROM=
# OBJECT_STORAGE_ENDPOINT=
# OBJECT_STORAGE_BUCKET=
# OBJECT_STORAGE_ACCESS_KEY_ID=
# OBJECT_STORAGE_SECRET_ACCESS_KEY=
# PAYMENT_WEBHOOK_SECRET=
# ERROR_TRACKING_DSN=
```

Generate `JWT_ACCESS_SECRET` and `SESSION_PEPPER` independently with a trusted
password manager or:

```sh
openssl rand -base64 48
```

Run it twice. Treat both outputs as passwords. Do not reuse the existing
development default JWT secret.

## What you must provide to an agent

Tell the agent only that the following are configured; do not paste secret
values:

- “Neon dev project is ready and `.env` has `DATABASE_URL` and
  `DATABASE_URL_UNPOOLED`.”
- The intended frontend development origin(s), for example
  `http://localhost:5173`.
- Whether you want real email delivery tested in Phase 2, or the console adapter
  only for now.
- Before Phase 8, the selected payment provider and confirmation that sandbox
  credentials/webhook URL are available.
- Before Phase 9, whether export downloads need R2 or can be generated inline
  for the demo.

Never give an agent authority to make paid-plan changes, enable a live payment
account, delete a cloud project, or access an unrelated organization/account.

## Phase 0 owner acceptance checklist

- [ ] A Neon development project exists and can be opened by the owner.
- [ ] Pooled and direct connection strings are stored only in root `.env` or a
      password/secret manager, not Git.
- [ ] Two different high-entropy values exist for JWT access signing and session
      pepper.
- [ ] Intended frontend origin(s) are known.
- [ ] The owner has read this document and will provide a phase-specific “ready”
      confirmation without exposing secrets.
- [ ] No provider other than Neon is created unless its phase needs it.
