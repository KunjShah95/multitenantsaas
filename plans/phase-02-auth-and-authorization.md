# Phase 02 — Authentication, memberships, authorization, and portal identity

**Status:** Planned  
**Depends on:** Phase 01 complete  
**Owner gate:** Decide whether console email is acceptable or Resend dev sender/key is ready

## Required reading

- [README.md](README.md)
- [../docs/00-owner-setup.md](../docs/00-owner-setup.md)
- [../docs/03-backend-architecture.md](../docs/03-backend-architecture.md)
- [../docs/04-tenancy-auth-security.md](../docs/04-tenancy-auth-security.md)
- [../docs/FRONTEND_API.md](../docs/FRONTEND_API.md) — authentication section only

## Already done

- Legacy route has JWT login/signup and role middleware, but accepts role from
  request, has default secret, lacks organizations/sessions/invites, and uses
  unsafe simplified portal magic login.
- Phase 01 provides persisted users/memberships/sessions/invitations/customer
  contacts, tenant transaction/RLS, audit/outbox helpers.

## Do in this phase

1. Add Argon2id password module, signed 15-minute access token module, opaque
   refresh token generation/hash/rotation/revocation, secure cookie settings,
   and session version/expiry checks.
2. Implement v1 `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /me`,
   and `/auth/switch-organization` exactly as frontend API doc defines. Validate
   all input and return one error shape.
3. Implement controlled first-organization bootstrap and admin-only invitations.
   Invitation acceptance creates membership with invitation role only; public
   request never chooses privileged existing-tenant role.
4. Implement `authenticate`, `requireMembershipRole`, `requirePermission`,
   `requireOwnershipOrTeamAccess`, and tenant-context middleware. Apply them to
   all new v1 routes; do not retrofit legacy endpoints unless safely isolated.
5. Implement customer-contact portal session and magic-link token storage:
   request-link returns neutral `202`, exchange is single-use/expiring. Use
   console email adapter unless owner provides Resend configuration; provider
   adapter receives no domain logic.
6. Add CORS allowlist, rate limiting for auth/public portal operations, security
   headers/body limit, safe request logging/redaction, and current identity
   response with permissions/active organization.
7. Add API contract/integration tests for all endpoint responses and every
   authorization matrix case in security doc. Update OpenAPI generator/input
   schemas if Phase 00 scaffolding exists.

## Do not do in this phase

- Do not add catalogue, quote, inventory, billing, portal quote, or reports
  business endpoints.
- Do not add a third-party hosted identity product, password reset feature, MFA,
  social login, email templates UI, or live payments.
- Do not write real emails/secrets to logs or return account-existence clues.
- Do not remove legacy JWT routes until v1 consumers migrate in a later release.

## Validation

- Test login/refresh rotation/logout/expiry/revocation and cookie settings.
- Test bootstrap/invite acceptance cannot escalate roles; role/tenant/ownership
  middleware blocks each forbidden case.
- Test magic link is single-use, expired token fails, unknown email gets `202`,
  and console/provider adapter never exposes raw token in API response/log.
- Generate/validate OpenAPI authentication paths and run integration tests on
  Neon-backed tenant data.

## Definition of done

- Secure v1 internal and portal identity flows are available with tenant-aware
  authorization and verified persistence.
- Role escalation/default secret/legacy magic shortcut risks are absent from v1.
- All new routes have validation, error envelope, audit where applicable, and
  authorization tests.
- Legacy routes remain explicitly isolated; no frontend migration is implied.

## Frontend handoff

Frontend can implement login, refresh-once handling, logout, boot-time `/me`,
active organization switch, and portal login/link exchange from
`docs/FRONTEND_API.md`. It must not build product screens on legacy routes.
