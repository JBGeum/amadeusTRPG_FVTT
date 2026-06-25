import { describe, it, expect } from "vitest";
import { compareItemOrder } from "../module/sheets/item-sort.mjs";

describe("compareItemOrder", () => {
  it("orders by sort ascending", () => {
    expect(compareItemOrder({ sort: 100, createdTime: 5 }, { sort: 200, createdTime: 1 })).toBeLessThan(0);
    expect(compareItemOrder({ sort: 300, createdTime: 1 }, { sort: 200, createdTime: 9 })).toBeGreaterThan(0);
  });

  it("falls back to createdTime when sort ties", () => {
    expect(compareItemOrder({ sort: 0, createdTime: 10 }, { sort: 0, createdTime: 20 })).toBeLessThan(0);
    expect(compareItemOrder({ sort: 0, createdTime: 20 }, { sort: 0, createdTime: 10 })).toBeGreaterThan(0);
  });

  it("returns 0 when sort and createdTime are equal", () => {
    expect(compareItemOrder({ sort: 5, createdTime: 5 }, { sort: 5, createdTime: 5 })).toBe(0);
  });

  it("keeps creation order when all sorts are 0 (legacy data)", () => {
    const items = [
      { id: "c", sort: 0, createdTime: 30 },
      { id: "a", sort: 0, createdTime: 10 },
      { id: "b", sort: 0, createdTime: 20 },
    ];
    expect(items.sort(compareItemOrder).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});
