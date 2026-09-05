import { describe, it, expect } from "vitest";
import { optimizeFulfillment } from "../../src/domain/fulfillment/optimizer.js";

describe("Fulfillment Optimizer (Pure)", () => {
  const warehouseA = {
    id: "wh-a",
    name: "Main Warehouse",
    shippingCostWeight: 1.0,
  };

  const warehouseB = {
    id: "wh-b",
    name: "East Depot",
    shippingCostWeight: 1.5,
  };

  const warehouseC = {
    id: "wh-c",
    name: "West Depot",
    shippingCostWeight: 0.8,
  };

  it("prefers single warehouse that can fulfill 100% of lines", () => {
    const items = [
      { orderLineId: "line-1", productId: "prod-1", sku: "SKU-A", requestedQty: 5 },
      { orderLineId: "line-2", productId: "prod-2", sku: "SKU-B", requestedQty: 10 },
    ];

    const balances = [
      // Warehouse A has all SKU-A and SKU-B
      { warehouseId: "wh-a", sku: "SKU-A", onHandQty: 10, reservedQty: 0 },
      { warehouseId: "wh-a", sku: "SKU-B", onHandQty: 20, reservedQty: 0 },
      // Warehouse B only has SKU-A
      { warehouseId: "wh-b", sku: "SKU-A", onHandQty: 10, reservedQty: 0 },
      { warehouseId: "wh-b", sku: "SKU-B", onHandQty: 2, reservedQty: 0 },
    ];

    const result = optimizeFulfillment(items, [warehouseA, warehouseB], balances);

    expect(result.estimatedShipments).toBe(1);
    expect(result.backorders).toHaveLength(0);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations.every((a) => a.warehouseId === "wh-a")).toBe(true);
    expect(result.allocations[0].allocatedQty).toBe("5");
    expect(result.allocations[1].allocatedQty).toBe("10");
  });

  it("selects lowest cost warehouse when multiple single warehouses can fulfill 100%", () => {
    const items = [{ orderLineId: "line-1", productId: "prod-1", sku: "SKU-A", requestedQty: 5 }];

    const balances = [
      { warehouseId: "wh-a", sku: "SKU-A", onHandQty: 10, reservedQty: 0 }, // cost weight 1.0
      { warehouseId: "wh-c", sku: "SKU-A", onHandQty: 10, reservedQty: 0 }, // cost weight 0.8
    ];

    const result = optimizeFulfillment(items, [warehouseA, warehouseC], balances);

    expect(result.estimatedShipments).toBe(1);
    expect(result.allocations[0].warehouseId).toBe("wh-c");
    expect(result.estimatedCost).toBe("0.8000");
  });

  it("splits across warehouses when no single warehouse has complete stock", () => {
    const items = [{ orderLineId: "line-1", productId: "prod-1", sku: "SKU-A", requestedQty: 10 }];

    const balances = [
      // Neither has 10, but combined they have 6 + 6 = 12
      { warehouseId: "wh-a", sku: "SKU-A", onHandQty: 6, reservedQty: 0 },
      { warehouseId: "wh-b", sku: "SKU-A", onHandQty: 6, reservedQty: 0 },
    ];

    const result = optimizeFulfillment(items, [warehouseA, warehouseB], balances);

    expect(result.estimatedShipments).toBe(2);
    expect(result.backorders).toHaveLength(0);

    const totalAllocated = result.allocations.reduce((sum, a) => sum + Number(a.allocatedQty), 0);
    expect(totalAllocated).toBe(10);
  });

  it("correctly identifies backorders when stock is insufficient across all warehouses", () => {
    const items = [{ orderLineId: "line-1", productId: "prod-1", sku: "SKU-A", requestedQty: 20 }];

    const balances = [
      { warehouseId: "wh-a", sku: "SKU-A", onHandQty: 5, reservedQty: 0 },
      { warehouseId: "wh-b", sku: "SKU-A", onHandQty: 3, reservedQty: 0 },
    ];

    const result = optimizeFulfillment(items, [warehouseA, warehouseB], balances);

    expect(result.backorders).toHaveLength(1);
    expect(result.backorders[0].sku).toBe("SKU-A");
    expect(result.backorders[0].backorderedQty).toBe("12"); // 20 requested - 8 available = 12 backordered

    const allocated = result.allocations.filter((a) => Number(a.allocatedQty) > 0);
    const totalAllocated = allocated.reduce((sum, a) => sum + Number(a.allocatedQty), 0);
    expect(totalAllocated).toBe(8);
  });

  it("produces deterministic output across multiple runs", () => {
    const items = [
      { orderLineId: "line-1", productId: "prod-1", sku: "SKU-A", requestedQty: 7 },
      { orderLineId: "line-2", productId: "prod-2", sku: "SKU-B", requestedQty: 3 },
    ];

    const balances = [
      { warehouseId: "wh-a", sku: "SKU-A", onHandQty: 4, reservedQty: 0 },
      { warehouseId: "wh-b", sku: "SKU-A", onHandQty: 10, reservedQty: 0 },
      { warehouseId: "wh-a", sku: "SKU-B", onHandQty: 10, reservedQty: 0 },
      { warehouseId: "wh-b", sku: "SKU-B", onHandQty: 10, reservedQty: 0 },
    ];

    const run1 = optimizeFulfillment(items, [warehouseA, warehouseB], balances);
    const run2 = optimizeFulfillment(items, [warehouseA, warehouseB], balances);

    expect(run1.estimatedShipments).toBe(run2.estimatedShipments);
    expect(run1.estimatedCost).toBe(run2.estimatedCost);
    expect(run1.allocations.map((a) => ({ wh: a.warehouseId, qty: a.allocatedQty }))).toEqual(
      run2.allocations.map((a) => ({ wh: a.warehouseId, qty: a.allocatedQty })),
    );
  });
});
