export interface OptimizerItem {
  orderLineId: string;
  productId: string;
  variantId?: string | null;
  sku: string;
  requestedQty: number;
}

export interface OptimizerWarehouse {
  id: string;
  name: string;
  code?: string;
  shippingCostWeight: number; // default 1.0
  archivedAt?: Date | string | null;
}

export interface OptimizerStockBalance {
  warehouseId: string;
  sku: string;
  onHandQty: number;
  reservedQty: number;
}

export interface OptimizerAllocation {
  orderLineId: string;
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  warehouseName: string;
  sku: string;
  requestedQty: string;
  allocatedQty: string;
  backorderedQty: string;
  reason?: string | null;
}

export interface OptimizerBackorder {
  orderLineId: string;
  sku: string;
  requestedQty: string;
  backorderedQty: string;
  reason: string;
}

export interface OptimizerOptions {
  shipmentPenalty?: number; // default 50
  backorderPenalty?: number; // default 1000
  costWeightMultiplier?: number; // default 10
}

export interface OptimizerResult {
  allocations: OptimizerAllocation[];
  backorders: OptimizerBackorder[];
  estimatedShipments: number;
  estimatedCost: string;
  snapshotTime: string;
}

/**
 * Pure allocation preview optimizer (zero DB writes).
 *
 * Decision rules:
 * 1. Prefers a single warehouse if it can fulfill 100% of all physical lines.
 * 2. If no single warehouse can fulfill all lines, finds the warehouse assignment
 *    that minimizes: (backordered units * backorderPenalty) +
 *                    (shipment count * shipmentPenalty) +
 *                    (shipping cost weights * costWeightMultiplier).
 * 3. Output is fully deterministic (tie-breaking by shipping cost weight, then warehouse name, then ID).
 */
export function optimizeFulfillment(
  items: OptimizerItem[],
  warehouses: OptimizerWarehouse[],
  balances: OptimizerStockBalance[],
  options: OptimizerOptions = {},
): OptimizerResult {
  const snapshotTime = new Date().toISOString();
  const shipmentPenalty = options.shipmentPenalty ?? 50;
  const backorderPenalty = options.backorderPenalty ?? 1000;
  const costWeightMultiplier = options.costWeightMultiplier ?? 10;

  // Filter active warehouses and sort deterministically
  const activeWarehouses = warehouses
    .filter((w) => !w.archivedAt)
    .sort((a, b) => {
      if (a.shippingCostWeight !== b.shippingCostWeight) {
        return a.shippingCostWeight - b.shippingCostWeight;
      }
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      return a.id.localeCompare(b.id);
    });

  const warehouseMap = new Map<string, OptimizerWarehouse>(activeWarehouses.map((w) => [w.id, w]));

  // Build availability lookup: `${warehouseId}:${sku}` -> availableQty
  const availableStock = new Map<string, number>();
  for (const b of balances) {
    const available = Math.max(0, b.onHandQty - b.reservedQty);
    availableStock.set(`${b.warehouseId}:${b.sku}`, available);
  }

  if (items.length === 0 || activeWarehouses.length === 0) {
    const backorders: OptimizerBackorder[] = items.map((i) => ({
      orderLineId: i.orderLineId,
      sku: i.sku,
      requestedQty: i.requestedQty.toString(),
      backorderedQty: i.requestedQty.toString(),
      reason:
        activeWarehouses.length === 0 ? "No active warehouses available" : "No items to allocate",
    }));

    return {
      allocations: [],
      backorders,
      estimatedShipments: 0,
      estimatedCost: "0.0000",
      snapshotTime,
    };
  }

  // --- Rule 1: Check single-warehouse 100% fulfillment preference ---
  let bestSingleWarehouse: OptimizerWarehouse | null = null;
  let bestSingleCost = Infinity;

  for (const wh of activeWarehouses) {
    let canFulfillAll = true;
    for (const item of items) {
      const avail = availableStock.get(`${wh.id}:${item.sku}`) ?? 0;
      if (avail < item.requestedQty) {
        canFulfillAll = false;
        break;
      }
    }
    if (canFulfillAll) {
      const cost = wh.shippingCostWeight;
      if (cost < bestSingleCost) {
        bestSingleCost = cost;
        bestSingleWarehouse = wh;
      }
    }
  }

  if (bestSingleWarehouse) {
    // Single warehouse satisfies 100%
    const chosen = bestSingleWarehouse;
    const allocations: OptimizerAllocation[] = items.map((item) => ({
      orderLineId: item.orderLineId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      warehouseId: chosen.id,
      warehouseName: chosen.name,
      sku: item.sku,
      requestedQty: item.requestedQty.toString(),
      allocatedQty: item.requestedQty.toString(),
      backorderedQty: "0",
      reason: "Single warehouse complete fulfillment",
    }));

    return {
      allocations,
      backorders: [],
      estimatedShipments: 1,
      estimatedCost: chosen.shippingCostWeight.toFixed(4),
      snapshotTime,
    };
  }

  // --- Rule 2: Multi-warehouse optimization ---
  // If warehouse count <= 12, enumerate subsets of active warehouses to find the optimal combination.
  // Otherwise, fallback to a greedy coverage heuristic.
  type AllocationStep = {
    warehouseId: string;
    allocated: number;
  };

  interface CandidatePlan {
    warehouseIds: Set<string>;
    itemAllocations: Map<string, AllocationStep[]>; // orderLineId -> steps
    backorders: Map<string, number>; // orderLineId -> unfulfilled
    score: number;
    totalCost: number;
  }

  function evaluateWarehouseSet(subset: OptimizerWarehouse[]): CandidatePlan {
    const subsetStock = new Map<string, number>();
    for (const wh of subset) {
      for (const item of items) {
        const key = `${wh.id}:${item.sku}`;
        subsetStock.set(key, availableStock.get(key) ?? 0);
      }
    }

    const itemAllocations = new Map<string, AllocationStep[]>();
    const backorders = new Map<string, number>();
    const usedWarehouses = new Set<string>();

    for (const item of items) {
      let needed = item.requestedQty;
      const steps: AllocationStep[] = [];

      // Try each warehouse in subset (already ordered by shipping cost weight)
      for (const wh of subset) {
        if (needed <= 0) break;
        const key = `${wh.id}:${item.sku}`;
        const currentAvail = subsetStock.get(key) ?? 0;
        if (currentAvail > 0) {
          const take = Math.min(needed, currentAvail);
          steps.push({ warehouseId: wh.id, allocated: take });
          subsetStock.set(key, currentAvail - take);
          needed -= take;
          usedWarehouses.add(wh.id);
        }
      }

      itemAllocations.set(item.orderLineId, steps);
      if (needed > 0) {
        backorders.set(item.orderLineId, needed);
      }
    }

    let totalBackordered = 0;
    for (const [, bo] of backorders) {
      totalBackordered += bo;
    }

    let costSum = 0;
    for (const whId of usedWarehouses) {
      const wh = warehouseMap.get(whId);
      costSum += wh ? wh.shippingCostWeight : 1;
    }

    const score =
      totalBackordered * backorderPenalty +
      usedWarehouses.size * shipmentPenalty +
      costSum * costWeightMultiplier;

    return {
      warehouseIds: usedWarehouses,
      itemAllocations,
      backorders,
      score,
      totalCost: costSum,
    };
  }

  // Generate candidate subsets:
  // We prioritize smaller subsets (1, 2, 3...) then all combinations up to limit
  let bestPlan: CandidatePlan | null = null;

  if (activeWarehouses.length <= 10) {
    // Generate power set (excluding empty)
    const n = activeWarehouses.length;
    const totalCombinations = 1 << n;
    for (let mask = 1; mask < totalCombinations; mask++) {
      const subset: OptimizerWarehouse[] = [];
      for (let i = 0; i < n; i++) {
        if ((mask & (1 << i)) !== 0) {
          const wh = activeWarehouses[i];
          if (wh) subset.push(wh);
        }
      }
      const candidate = evaluateWarehouseSet(subset);
      if (!bestPlan || candidate.score < bestPlan.score) {
        bestPlan = candidate;
      }
    }
  } else {
    // For large warehouse sets, evaluate all warehouses together
    bestPlan = evaluateWarehouseSet(activeWarehouses);
  }

  if (!bestPlan) {
    bestPlan = evaluateWarehouseSet(activeWarehouses);
  }

  // Format allocations & backorders from bestPlan
  const allocations: OptimizerAllocation[] = [];
  const backorders: OptimizerBackorder[] = [];
  const fallbackWarehouseId = activeWarehouses[0]?.id ?? "";
  const fallbackWarehouseName = activeWarehouses[0]?.name ?? "Warehouse";

  for (const item of items) {
    const steps = bestPlan.itemAllocations.get(item.orderLineId) ?? [];
    const boQty = bestPlan.backorders.get(item.orderLineId) ?? 0;

    if (steps.length === 0 && boQty > 0) {
      // Entirely backordered
      allocations.push({
        orderLineId: item.orderLineId,
        productId: item.productId,
        variantId: item.variantId ?? null,
        warehouseId: fallbackWarehouseId,
        warehouseName: fallbackWarehouseName,
        sku: item.sku,
        requestedQty: item.requestedQty.toString(),
        allocatedQty: "0",
        backorderedQty: boQty.toString(),
        reason: "Insufficient stock across all warehouses",
      });
    } else {
      for (const step of steps) {
        const wh = warehouseMap.get(step.warehouseId);
        allocations.push({
          orderLineId: item.orderLineId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          warehouseId: step.warehouseId,
          warehouseName: wh ? wh.name : "Warehouse",
          sku: item.sku,
          requestedQty: item.requestedQty.toString(),
          allocatedQty: step.allocated.toString(),
          backorderedQty: "0",
          reason:
            steps.length > 1
              ? "Split allocation across warehouses"
              : "Optimal warehouse allocation",
        });
      }
      if (boQty > 0) {
        // Line partially backordered
        allocations.push({
          orderLineId: item.orderLineId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          warehouseId: fallbackWarehouseId,
          warehouseName: fallbackWarehouseName,
          sku: item.sku,
          requestedQty: item.requestedQty.toString(),
          allocatedQty: "0",
          backorderedQty: boQty.toString(),
          reason: "Remaining quantity backordered due to insufficient stock",
        });
      }
    }

    if (boQty > 0) {
      backorders.push({
        orderLineId: item.orderLineId,
        sku: item.sku,
        requestedQty: item.requestedQty.toString(),
        backorderedQty: boQty.toString(),
        reason: "Insufficient stock across all active warehouses",
      });
    }
  }

  return {
    allocations,
    backorders,
    estimatedShipments: bestPlan.warehouseIds.size,
    estimatedCost: bestPlan.totalCost.toFixed(4),
    snapshotTime,
  };
}
