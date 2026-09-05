# Multi-tenancy, authentication, and security

## Identity model

```text
users (global human) --< memberships >-- organizations (tenant)
                                      \-- team (optional)
customers --< customerContacts (portal identities)
```

A user may belong to several organizations. The active membership supplies the
active `tenantId`, role, team assignment, and permission context. A customer
contact is not an internal membership and cannot call internal routes.

## Roles

| Role | Allows | Important restrictions |
| --- | --- | --- |
| Admin | Tenant configuration, memberships, all records | Cannot bypass audit/RLS. |
| Rep | Own/assigned customer quotes; submit/revise/share; scoped order visibility | Cannot approve own quote or alter policy/inventory. |
| Manager | Team visibility, manager approval, configured governance access | Cannot approve own quote or perform finance payments. |
| Finance | Finance approval, invoices, adjustments, payment reconciliation | No unrestricted product/team administration. |
| Ops | Warehouse, inventory adjustments, allocation, shipment actions | No discount/payment-provider administration. |
| Customer contact | Explicitly shared portal quotes/orders/invoices | Never margin, cost, internal comment/risk, or another customer. |

Authorization is role + tenant + ownership/assignment + current state. UI
buttons are only usability, never authorization.

## Session design

1. Internal login validates password with Argon2id.
2. Server issues a 15-minute access token containing user/membership/
   organization/role/session-version data.
3. Server creates random opaque refresh token, stores only its hash in
   `sessions`, sends `Secure`/`HttpOnly`/`SameSite=Lax` cookie, and rotates it.
4. Logout revokes session. Password reset/membership removal can revoke related
   sessions.
5. Access token stays in frontend memory, never localStorage or a URL.

Customer portal uses an expiring single-use hashed magic link or contact
password. Link exchange creates portal session. Remove legacy `magic: true`.

## Bootstrap and invitations

- First tenant owner uses controlled bootstrap only.
- Invitation records tenant/email/intended role/hash of random one-time token/
  expiry/creator/audit event.
- Acceptance creates or links user and membership. Client cannot pick a role.
- A public route never creates `admin`, `manager`, `finance`, or `ops` in an
  existing tenant.

## RLS tenant protection

Every tenant-owned table has `tenant_id uuid not null`. For each transaction,
verified middleware uses `SET LOCAL app.tenant_id = ...`; an RLS policy compares
the row tenant to that setting:

```sql
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotes_tenant_isolation ON quotes
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

The runtime DB role is non-owner and `NOBYPASSRLS`; migration role is separate.
Never use connection-scoped `SET` with a pool. RLS stops accidental unscoped
queries; application authorization still checks ownership, teams, contact, and
quote shares.

## Security baseline

- Validate environment, request/path/query/body/headers, and provider payloads.
- Allowlist CORS origins; TLS/security headers/body size/request ID; rate limit
  login/magic-link/reset/public portal operations.
- Return neutral result for unknown email in magic-link/reset flows.
- Private files use signed short-lived download URLs; never public R2 objects.
- Verify payment signatures against raw body before state-changing parsing.
- Redact credentials/PII from logs/events/exports; audit actor/action/entity/
  reason/request ID, never tokens/password hashes.
- Use revision + idempotency protection for stale tabs/retries.

## Required authorization tests

For each protected resource test unauthenticated (`401`), wrong role (`403`),
other tenant guessing ID (`404`), unassigned rep, unshared customer contact,
unsafe state transition (`422`), self/out-of-order approval, and revoked or
expired internal/portal session.
