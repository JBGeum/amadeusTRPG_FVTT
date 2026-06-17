import { abilitiesField } from "./_fields.mjs";
import { rankVal, modVal, initHealth, initMoney } from "../dice/resolution.mjs";

const fields = foundry.data.fields;

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const bond = () => new fields.SchemaField({
      index: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      chkbox: new fields.BooleanField({ initial: false }),
      name: new fields.StringField({ initial: "" }),
      truth: new fields.BooleanField({ initial: false }),
      score: new fields.NumberField({ initial: 0 }),
      relationship: new fields.StringField({ initial: "" }),
    });
    const supporter = () => new fields.SchemaField({
      index: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      chkbox: new fields.BooleanField({ initial: false }),
      score: new fields.NumberField({ initial: 0 }),
      relationship: new fields.StringField({ initial: "" }),
    });

    return {
      biography: new fields.HTMLField({ initial: "" }),
      health: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0 }),
        max: new fields.StringField({ initial: "" }),
      }),
      vitality: new fields.NumberField({ required: true, initial: 0 }),
      dc: new fields.NumberField({ required: true, integer: true, initial: 4 }),
      ability: abilitiesField(),
      chardata: new fields.SchemaField({
        pantheon: new fields.StringField({ initial: "" }),
        parent: new fields.StringField({ initial: "" }),
        parentkey: new fields.StringField({ initial: "" }),
        parentimg: new fields.StringField({ initial: "" }),
        background: new fields.StringField({ initial: "" }),
        prophecy: new fields.StringField({ initial: "" }),
        relationship: new fields.StringField({ initial: "" }),
        age: new fields.StringField({ initial: "" }),
        job: new fields.SchemaField({ name: new fields.StringField({ initial: "" }) }),
      }),
      job: new fields.SchemaField({ chkbox: new fields.BooleanField({ initial: false }) }),
      status: new fields.SchemaField({
        desperation: new fields.BooleanField({ initial: false }),
        fury: new fields.BooleanField({ initial: false }),
        coward: new fields.SchemaField({
          chkbox: new fields.BooleanField({ initial: false }),
          level: new fields.NumberField({ initial: 0 }),
        }),
        depravity: new fields.BooleanField({ initial: false }),
        disgrace: new fields.BooleanField({ initial: false }),
        wound: new fields.SchemaField({
          chkbox: new fields.BooleanField({ initial: false }),
          level: new fields.NumberField({ initial: 0 }),
        }),
      }),
      money: new fields.StringField({ initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, initial: 1 }),
      exp: new fields.NumberField({ required: true, initial: 0 }),
      food: new fields.NumberField({ required: true, initial: 0 }),
      color: new fields.StringField({ initial: "" }),
      memo: new fields.StringField({ initial: "memo" }),
      attributes: new fields.ObjectField({ initial: {} }),
      groups: new fields.ObjectField({ initial: {} }),
      bonds: new fields.SchemaField({
        bond1: bond(), bond2: bond(), bond3: bond(), bond4: bond(), bond5: bond(),
      }),
      supporters: new fields.SchemaField({
        supporter1: supporter(), supporter2: supporter(), supporter3: supporter(), supporter4: supporter(),
      }),
    };
  }

  /** 파생 계산: 기존 actor.mjs의 _setRankModLetter/_calculateInitHealth/_calculateInitMoney/_calculateCalcHealth 이전 */
  prepareDerivedData() {
    // 랭크/수정치 → 숫자값
    for (const ability of Object.values(this.ability)) {
      ability.rankVal = rankVal(ability.rank);
      ability.modVal = modVal(ability.mod);
    }
    // 생명력/소지금 초기치
    this.initHealth = initHealth(this.ability);
    this.initMoney = initMoney(this.ability);
  }
}
