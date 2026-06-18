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
