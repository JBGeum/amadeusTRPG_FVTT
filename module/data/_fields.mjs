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
