# Runbook: Inventory Correction and Ledger Reconciliation

## Purpose

Procedure for reconciling physical warehouse counts with DealFlow360 inventory ledger balances and safely correcting discrepancies (shrinkage, damaged stock, cycle count mismatches).

---

## Core Safety Rule

> [!CRITICAL]
> **Never directly mutate `on_hand_qty` in `inventory_balances` without writing an `inventory_movements` record.**
> The inventory ledger is an immutable double-entry audit trail. Any balance modification must be matched by a corresponding movement record explaining the difference.

---

## 1. Inspect Current Balance & Ledger History

```sql
-- 1. Check current balance for the SKU in the target warehouse
SELECT id, tenant_id, warehouse_id, sku_key, on_hand_qty, reserved_qty, allocated_qty, revision
FROM inventory_balances
WHERE tenant_id = 'TENANT_UUID'
  AND warehouse_id = 'WAREHOUSE_UUID'
  AND sku_key = 'SKU_STRING';

-- 2. Audit recent movements for this SKU
SELECT id, movement_type, quantity, previous_on_hand, new_on_hand, reference_id, reason, created_at
FROM inventory_movements
WHERE tenant_id = 'TENANT_UUID'
  AND warehouse_id = 'WAREHOUSE_UUID'
  AND sku_key = 'SKU_STRING'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 2. Execute Inventory Adjustment Transaction

Always run the adjustment inside a database transaction with a row lock:

```sql
BEGIN;

-- 1. Lock the balance row to prevent race conditions with orders/reservations
SELECT on_hand_qty, reserved_qty, allocated_qty, revision
FROM inventory_balances
WHERE tenant_id = 'TENANT_UUID'
  AND warehouse_id = 'WAREHOUSE_UUID'
  AND sku_key = 'SKU_STRING'
FOR UPDATE;

-- Suppose current on_hand_qty is 150, but physical count is 142 (delta = -8)

-- 2. Insert the immutable movement record
INSERT INTO inventory_movements (
  id,
  tenant_id,
  warehouse_id,
  sku_key,
  movement_type,
  quantity,
  previous_on_hand,
  new_on_hand,
  reference_type,
  reference_id,
  reason,
  created_at
) VALUES (
  gen_random_uuid(),
  'TENANT_UUID',
  'WAREHOUSE_UUID',
  'SKU_STRING',
  'adjustment',
  -8.000000,
  150.000000,
  142.000000,
  'cycle_count',
  'TICKET-10492',
  'Physical cycle count discrepancy adjustment',
  NOW()
);

-- 3. Update the balance with optimistic revision increment
UPDATE inventory_balances
SET on_hand_qty = 142.000000,
    revision = revision + 1,
    updated_at = NOW()
WHERE tenant_id = 'TENANT_UUID'
  AND warehouse_id = 'WAREHOUSE_UUID'
  AND sku_key = 'SKU_STRING';

COMMIT;
```

---

## 3. Post-Adjustment Verification

Verify that available inventory is non-negative:

```sql
SELECT
  sku_key,
  on_hand_qty,
  reserved_qty,
  allocated_qty,
  (on_hand_qty - reserved_qty - allocated_qty) AS available_qty
FROM inventory_balances
WHERE tenant_id = 'TENANT_UUID'
  AND warehouse_id = 'WAREHOUSE_UUID'
  AND sku_key = 'SKU_STRING';
```
If `available_qty < 0`, investigate pending reservations before confirming any open orders.
