# Runbook: Session Revocation & Security Response

## Purpose

Procedure for revoking active authentication sessions in response to compromised credentials, employee offboarding, device theft, or suspected account takeover.

---

## Token Architecture & Revocation Mechanics

DealFlow360 uses a dual-token model:
1. **Access Token**: Short-lived JWT (15 minutes). Statelessly validated by signature and expiration.
2. **Refresh Token**: Long-lived token stored as a cryptographic hash (`token_hash`) in the `sessions` table, sent in an `HttpOnly` cookie.
3. **Revocation Effect**:
   - Marking a session `revoked_at = NOW()` immediately prevents refresh token exchange (`POST /api/v1/auth/refresh`).
   - The user's access token expires naturally within at most 15 minutes.
   - Immediate termination can be accelerated by clearing client cookies or revoking the user's membership.

---

## 1. Revoking a Single Compromised Session

If a user reports an unfamiliar device or lost phone:

```sql
-- Find active sessions for the user
SELECT id, user_id, ip_address, user_agent, created_at, expires_at
FROM sessions
WHERE user_id = 'USER_UUID'
  AND revoked_at IS NULL
  AND expires_at > NOW();

-- Revoke specific session
UPDATE sessions
SET revoked_at = NOW()
WHERE id = 'SESSION_UUID'
  AND revoked_at IS NULL;
```

---

## 2. Revoking ALL Sessions for a Specific User

For a confirmed credential compromise or password reset:

```sql
UPDATE sessions
SET revoked_at = NOW()
WHERE user_id = 'USER_UUID'
  AND revoked_at IS NULL;
```

*Verification*:
```sql
SELECT count(*) FROM sessions
WHERE user_id = 'USER_UUID' AND revoked_at IS NULL AND expires_at > NOW();
-- Expected: 0
```

---

## 3. Emergency Organization-Wide Revocation (Tenant Breach)

To revoke all sessions for an entire tenant/organization:

```sql
UPDATE sessions
SET revoked_at = NOW()
WHERE user_id IN (
  SELECT user_id FROM memberships
  WHERE organization_id = 'ORG_UUID'
)
AND revoked_at IS NULL;
```

---

## 4. Immediate Token Blacklist (Zero-Delay Revocation)

If the 15-minute access token window must be truncated immediately without waiting for token expiry:
1. Disable or delete the user's membership in the organization:
   ```sql
   UPDATE memberships
   SET is_active = false
   WHERE user_id = 'USER_UUID' AND organization_id = 'ORG_UUID';
   ```
2. The authorization middleware checks membership status for domain endpoints and will reject subsequent requests immediately with `403 FORBIDDEN`.
