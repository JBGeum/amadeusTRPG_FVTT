import { describe, it, expect } from "vitest";
import { computeOrder } from "../module/initiative/order.mjs";

describe("computeOrder", () => {
  it("orders by ascending value (1 fastest)", () => {
    const result = computeOrder([
      { actorId: "a", name: "A", value: 3 },
      { actorId: "b", name: "B", value: 1 },
      { actorId: "c", name: "C", value: 5 },
    ]);
    expect(result.map((s) => s.value)).toEqual([1, 3, 5]);
    expect(result.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(result[0].members.map((m) => m.actorId)).toEqual(["b"]);
  });

  it("groups equal values into the same rank (ties share a slot)", () => {
    const result = computeOrder([
      { actorId: "a", name: "A", value: 2 },
      { actorId: "b", name: "B", value: 2 },
      { actorId: "c", name: "C", value: 4 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].rank).toBe(1);
    expect(result[0].value).toBe(2);
    expect(result[0].members.map((m) => m.actorId)).toEqual(["a", "b"]);
    expect(result[1].rank).toBe(2);
    expect(result[1].value).toBe(4);
  });

  it("excludes entries with null/non-integer value", () => {
    const result = computeOrder([
      { actorId: "a", name: "A", value: null },
      { actorId: "b", name: "B", value: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].members.map((m) => m.actorId)).toEqual(["b"]);
  });

  it("returns empty for empty input", () => {
    expect(computeOrder([])).toEqual([]);
  });

  it("returns a single slot when everyone picks the same value", () => {
    const result = computeOrder([
      { actorId: "a", name: "A", value: 6 },
      { actorId: "b", name: "B", value: 6 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
    expect(result[0].members).toHaveLength(2);
  });
});
