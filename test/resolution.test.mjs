import { describe, it, expect } from "vitest";
import {
  diceCountForRank,
  resolveDie,
  rankVal,
  modVal,
  initHealth,
  initMoney,
  buildDiceset,
} from "../module/dice/resolution.mjs";

describe("diceCountForRank", () => {
  it("maps ranks to dice counts", () => {
    expect(diceCountForRank("S")).toBe(4);
    expect(diceCountForRank("A")).toBe(3);
    expect(diceCountForRank("B")).toBe(2);
    expect(diceCountForRank("C")).toBe(1);
  });
  it("treats D as a 2-dice exception", () => {
    expect(diceCountForRank("D")).toBe(2);
  });
  it("returns 0 for unknown rank", () => {
    expect(diceCountForRank("?")).toBe(0);
  });
});

describe("resolveDie", () => {
  it("returns fumble on 1 regardless of mod/dc", () => {
    expect(resolveDie(1, 3, 4)).toBe("fumble");
  });
  it("returns special on 6 regardless of mod/dc", () => {
    expect(resolveDie(6, -2, 4)).toBe("special");
  });
  it("returns success when die+mod >= dc", () => {
    expect(resolveDie(3, 1, 4)).toBe("success");
  });
  it("returns fail when die+mod < dc", () => {
    expect(resolveDie(3, 0, 4)).toBe("fail");
  });
});

describe("buildDiceset", () => {
  it("marks no die disabled for non-D ranks and preserves order", () => {
    const set = buildDiceset([6, 2, 4], "A");
    expect(set).toEqual([
      { value: 6, disabled: false },
      { value: 2, disabled: false },
      { value: 4, disabled: false },
    ]);
  });
  it("disables the single highest die for rank D", () => {
    const set = buildDiceset([2, 5], "D");
    expect(set).toEqual([
      { value: 2, disabled: false },
      { value: 5, disabled: true },
    ]);
  });
  it("disables the highest die regardless of order for rank D", () => {
    const set = buildDiceset([6, 3], "D");
    expect(set).toEqual([
      { value: 6, disabled: true },
      { value: 3, disabled: false },
    ]);
  });
  it("disables exactly one die when D dice tie", () => {
    const set = buildDiceset([4, 4], "D");
    expect(set.filter((d) => d.disabled)).toHaveLength(1);
    expect(set.map((d) => d.value)).toEqual([4, 4]);
  });
});

describe("rankVal / modVal", () => {
  it("maps rank letters to numeric value", () => {
    expect(rankVal("S")).toBe(4);
    expect(rankVal("D")).toBe(0);
  });
  it("maps mod letters to numeric value", () => {
    expect(modVal("+++")).toBe(3);
    expect(modVal(" ")).toBe(0);
    expect(modVal("--")).toBe(-2);
  });
  it("returns 0 for unknown keys", () => {
    expect(rankVal("Z")).toBe(0);
    expect(modVal("?")).toBe(0);
  });
});

describe("initHealth / initMoney", () => {
  const ability = {
    warfare: { rank: "A", mod: "+" }, // health: 7 + 1
    spirit: { rank: "B", mod: " " }, // health: 5 + 0
    love: { rank: "C", mod: "++" }, // money: 3 + 2
    mundane: { rank: "D", mod: "-" }, // money: 2 + (-1)
  };
  it("sums warfare + spirit rank/mod for health", () => {
    // 7 + 1 + 5 + 0 = 13
    expect(initHealth(ability)).toBe(13);
  });
  it("sums love + mundane rank/mod for money", () => {
    // love C(3)+ ++(2) = 5 ; mundane D(2) + -(-1) = 1 ; total 6
    expect(initMoney(ability)).toBe(6);
  });
});
