const fields = foundry.data.fields;

const RANKS = ["S", "A", "B", "C", "D"];
const MODS = ["+++", "++", "+", " ", "-", "--"];

/** 능력치 한 칸(rank/mod) */
export function abilityField() {
  return new fields.SchemaField({
    rank: new fields.StringField({ required: true, blank: false, initial: "A", choices: RANKS }),
    mod: new fields.StringField({ required: true, initial: " ", choices: MODS }),
  });
}

/** 6종 능력치 묶음 */
export function abilitiesField() {
  return new fields.SchemaField({
    warfare: abilityField(),
    technique: abilityField(),
    brain: abilityField(),
    spirit: abilityField(),
    love: abilityField(),
    mundane: abilityField(),
  });
}

// --- 파생 계산용 룩업 (기존 actor.mjs의 switch 테이블을 상수화) ---
export const RANK_VAL = { S: 4, A: 3, B: 2, C: 1, D: 0 };
export const MOD_VAL = { "+++": 3, "++": 2, "+": 1, " ": 0, "-": -1, "--": -2 };

// 생명력: 랭크/수정치별 가산치
export const HEALTH_BY_RANK = { S: 10, A: 7, B: 5, C: 3, D: 1 };
export const HEALTH_BY_MOD = { "+++": 6, "++": 3, "+": 1, " ": 0, "-": -1, "--": -2 };

// 소지금: 랭크/수정치별 가산치
export const MONEY_BY_RANK = { S: 7, A: 5, B: 4, C: 3, D: 2 };
export const MONEY_BY_MOD = { "+++": 3, "++": 2, "+": 1, " ": 0, "-": -1, "--": -2 };
