// Foundry 전역(game/Roll/ChatMessage)을 절대 참조하지 않는 순수 모듈.
// Vitest(node)에서 그대로 import 가능해야 한다.
import { AMADEUS } from "../helpers/config.mjs";

// 생명력/소지금 가산 테이블 (구 _fields.mjs에서 이전 — 순수 데이터).
const HEALTH_BY_RANK = { S: 10, A: 7, B: 5, C: 3, D: 1 };
const HEALTH_BY_MOD = { "+++": 6, "++": 3, "+": 1, " ": 0, "-": -1, "--": -2 };
const MONEY_BY_RANK = { S: 7, A: 5, B: 4, C: 3, D: 2 };
const MONEY_BY_MOD = { "+++": 3, "++": 2, "+": 1, " ": 0, "-": -1, "--": -2 };

/** 능력치 랭크 → 굴릴 d6 개수. D는 예외적으로 2d6. */
export function diceCountForRank(rank) {
  if (rank === "D") return 2;
  return AMADEUS.rank[rank] ?? 0;
}

/** 주사위 1개 판정. 1=펌블, 6=스페셜이 dc 비교보다 우선. */
export function resolveDie(die, modVal, dc) {
  if (die === 1) return "fumble";
  if (die === 6) return "special";
  return die + modVal >= dc ? "success" : "fail";
}

/**
 * 굴림 결과 값 배열을 챗 표시용 주사위 목록으로 가공한다.
 * D 랭크는 2d6 중 높은 주사위 1개를 "사용 불가"(disabled)로 버리고 낮은 1개만 판정에 쓴다.
 * (동률이면 첫 최댓값 인덱스 하나만 disabled.)
 * @param {number[]} values 굴린 d6 값들
 * @param {string} rank 능력치 랭크(S~D)
 * @returns {{value:number, disabled:boolean}[]}
 */
export function buildDiceset(values, rank) {
  let disabledIndex = -1;
  if (rank === "D") {
    disabledIndex = values.reduce((maxI, v, i) => (v > values[maxI] ? i : maxI), 0);
  }
  return values.map((value, i) => ({ value, disabled: i === disabledIndex }));
}

/** 랭크 문자 → 능력치 숫자값 (S4..D0). D는 0 (굴림 개수 아님 — 굴림 개수는 diceCountForRank 사용). */
export function rankVal(rank) {
  return AMADEUS.rank[rank] ?? 0;
}

/** 수정치 문자 → 숫자값 (+++3..---2). */
export function modVal(mod) {
  return AMADEUS.modL[mod] ?? 0;
}

/** 생명력 초기치: warfare + spirit 의 (랭크+수정치) 합. */
export function initHealth(ability) {
  return (
    (HEALTH_BY_RANK[ability.warfare.rank] ?? 0) +
    (HEALTH_BY_MOD[ability.warfare.mod] ?? 0) +
    (HEALTH_BY_RANK[ability.spirit.rank] ?? 0) +
    (HEALTH_BY_MOD[ability.spirit.mod] ?? 0)
  );
}

/** 소지금 초기치: love + mundane 의 (랭크+수정치) 합. */
export function initMoney(ability) {
  return (
    (MONEY_BY_RANK[ability.love.rank] ?? 0) +
    (MONEY_BY_MOD[ability.love.mod] ?? 0) +
    (MONEY_BY_RANK[ability.mundane.rank] ?? 0) +
    (MONEY_BY_MOD[ability.mundane.mod] ?? 0)
  );
}

const DIE_COLOR = { 1: "black", 2: "red", 3: "blue", 4: "green", 5: "white", 6: "special" };
const COLOR_FACE = { black: 1, red: 2, blue: 3, green: 4, white: 5 };

/** 주사위 눈 → 색 키. 6은 정식 색이 아니라 스페셜 표식. */
export function dieColor(value) {
  return DIE_COLOR[value] ?? null;
}

/** 색 키 → die-face 번호(1~5). 결과 카드의 색 스와치가 .chat-die-chip--N 색을 재사용하기 위함. */
export function colorToFace(color) {
  return COLOR_FACE[color] ?? 0;
}

/** buildDiceset 결과에서 사용 가능한(버려지지 않은) 주사위 수. 2 이상이면 무드 선택 다이얼로그. */
export function usableCount(diceset) {
  return diceset.filter((d) => !d.disabled).length;
}

/** 사용 가능 주사위가 1개뿐인 자동 케이스에서 그 인덱스. */
export function autoJudgeIndex(diceset) {
  return diceset.findIndex((d) => !d.disabled);
}

/**
 * 선택 결과 카드용 객체를 만든다.
 * 전제: specialColor는 moodIndex가 가리키는 눈이 6일 때만 값을 가지며, moodIndex가 null인 자동 케이스에서는 null이다.
 * 이 검증은 다이얼로그 확정 버튼이 보장하므로 여기서는 신뢰한다(호출부가 보장할 것).
 * @param {{values:number[], modVal:number, dc:number, judgeIndex:number, moodIndex:number|null, specialColor:string|null}} args
 * @returns {{judge:{value:number, outcome:string}, mood:null|{value:number, color:string, face:number, special:boolean}}}
 */
export function buildMoodResult({ values, modVal, dc, judgeIndex, moodIndex, specialColor }) {
  const judge = { value: values[judgeIndex], outcome: resolveDie(values[judgeIndex], modVal, dc) };
  let mood = null;
  if (moodIndex != null) {
    const value = values[moodIndex];
    const color = value === 6 ? specialColor : dieColor(value);
    mood = { value, color, face: colorToFace(color), special: value === 6 };
  }
  return { judge, mood };
}

/**
 * 단순 합산 굴림(목표치/성공판정 없음)을 챗 카드용 뷰모델로 변환한다.
 * 능력치 판정과 달리 펌블/스페셜·목표치 비교가 없으며, 주사위 눈과 합계만 보여준다.
 * @param {object} args
 * @param {string} [args.flavor] 카드 제목으로 쓸 이름(아이템/기프트). 비어 있으면 수식을 제목으로.
 * @param {string} args.formula 원본 수식 라벨("1d6", "2d6+3" 등)
 * @param {number} args.total 최종 합계(보정 포함)
 * @param {{faces:number, values:number[]}[]} args.dice 각 DiceTerm의 면수와 굴린 값들
 * @returns {{title:string, formula:string, total:number, groups:{faces:number, isD6:boolean, dice:{value:number}[]}[]}}
 */
export function buildFormulaRollView({ flavor, formula, total, dice }) {
  return {
    title: flavor || formula,
    formula,
    total,
    groups: dice.map((d) => ({
      faces: d.faces,
      isD6: d.faces === 6,
      dice: d.values.map((value) => ({ value })),
    })),
  };
}
