import { describe, it, expect } from "vitest";
import {
  diceCountForRank,
  resolveDie,
  rankVal,
  modVal,
  initHealth,
  initMoney,
  buildDiceset,
  dieColor,
  colorToFace,
  usableCount,
  autoJudgeIndex,
  buildMoodResult,
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

describe("dieColor", () => {
  it("maps die faces to colors, 6 is special", () => {
    expect(dieColor(1)).toBe("black");
    expect(dieColor(2)).toBe("red");
    expect(dieColor(3)).toBe("blue");
    expect(dieColor(4)).toBe("green");
    expect(dieColor(5)).toBe("white");
    expect(dieColor(6)).toBe("special");
  });
});

describe("colorToFace", () => {
  it("maps the five real colors to die-face numbers for swatch reuse", () => {
    expect(colorToFace("black")).toBe(1);
    expect(colorToFace("red")).toBe(2);
    expect(colorToFace("blue")).toBe(3);
    expect(colorToFace("green")).toBe(4);
    expect(colorToFace("white")).toBe(5);
  });
  it("returns 0 for special/unknown", () => {
    expect(colorToFace("special")).toBe(0);
  });
});

describe("usableCount / autoJudgeIndex", () => {
  it("counts non-disabled dice (D-rank drops the higher one)", () => {
    expect(usableCount(buildDiceset([3, 5], "D"))).toBe(1); // 높은 5는 disabled
    expect(usableCount(buildDiceset([3], "C"))).toBe(1);
    expect(usableCount(buildDiceset([3, 5], "B"))).toBe(2);
    expect(usableCount(buildDiceset([1, 2, 6], "A"))).toBe(3);
  });
  it("finds the single usable index for auto cases", () => {
    expect(autoJudgeIndex(buildDiceset([3, 5], "D"))).toBe(0); // 낮은 3
    expect(autoJudgeIndex(buildDiceset([6, 2], "D"))).toBe(1); // 낮은 2
    expect(autoJudgeIndex(buildDiceset([4], "C"))).toBe(0);
  });
});

describe("buildMoodResult", () => {
  const base = { values: [4, 2, 6], modVal: 1, dc: 4 };
  it("builds judge with outcome and a colored mood die", () => {
    // judge = index0(4), mood = index1(2=red)
    const r = buildMoodResult({ ...base, judgeIndex: 0, moodIndex: 1, specialColor: null });
    expect(r.judge).toEqual({ value: 4, outcome: "success" }); // 4+1>=4
    expect(r.mood).toEqual({ value: 2, color: "red", face: 2, special: false });
  });
  it("uses the chosen specialColor when mood die is 6", () => {
    const r = buildMoodResult({ ...base, judgeIndex: 0, moodIndex: 2, specialColor: "green" });
    expect(r.mood).toEqual({ value: 6, color: "green", face: 4, special: true });
  });
  it("returns null mood for auto cases (moodIndex null)", () => {
    const r = buildMoodResult({ ...base, judgeIndex: 0, moodIndex: null, specialColor: null });
    expect(r.mood).toBeNull();
  });
  it("reports fumble/special outcomes on the judge die", () => {
    expect(buildMoodResult({ ...base, judgeIndex: 1, moodIndex: 0 }).judge.outcome).toBe("fail"); // 2+1<4
    const sp = buildMoodResult({ values: [6, 2], modVal: 0, dc: 4, judgeIndex: 0, moodIndex: 1 });
    expect(sp.judge.outcome).toBe("special");
    const fb = buildMoodResult({ values: [1, 2], modVal: 0, dc: 4, judgeIndex: 0, moodIndex: 1 });
    expect(fb.judge.outcome).toBe("fumble");
  });
});
