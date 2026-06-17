import { describe, it, expect } from "vitest";
import {
  diceCountForRank,
  resolveDie,
  rankVal,
  modVal,
  initHealth,
  initMoney,
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
    warfare: { rank: "A", mod: "+" },   // health: 7 + 1
    spirit: { rank: "B", mod: " " },    // health: 5 + 0
    love: { rank: "C", mod: "++" },     // money: 3 + 2
    mundane: { rank: "D", mod: "-" },   // money: 2 + (-1)
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
