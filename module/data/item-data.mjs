import { abilitiesField } from "./_fields.mjs";

const fields = foundry.data.fields;

/** weapon/gear/gift 가 공유하는 action 블록 */
function actionField() {
  return new fields.SchemaField({
    roll: new fields.StringField({ required: false, nullable: true, initial: null }),
    damage: new fields.StringField({ initial: "" }),
    spAbl: new fields.ObjectField({ initial: {} }),
  });
}

export class GiftData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      chkbox: new fields.BooleanField({ initial: false }),
      type: new fields.StringField({ initial: "" }),
      requirement: new fields.StringField({ initial: "" }),
      action: actionField(),
      tag: new fields.StringField({ initial: "" }),
      effect: new fields.StringField({ initial: "." }),
      description: new fields.StringField({ initial: "." }),
      formula: new fields.StringField({ initial: "" }),
      memo: new fields.StringField({ initial: "" }),
    };
  }
}

export class BackgroundData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      type: new fields.StringField({ initial: "" }),
      modSet: new fields.ArrayField(new fields.ObjectField(), { initial: [] }),
    };
  }
}

export class ParentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      pantheon: new fields.StringField({ initial: "" }),
      color: new fields.StringField({ initial: "" }),
      weapon: new fields.StringField({ initial: "" }),
      authority: new fields.StringField({ initial: "" }),
      portrait: new fields.StringField({ initial: "" }),
      ability: abilitiesField(),
      description: new fields.StringField({ initial: "" }),
    };
  }
}

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      name: new fields.StringField({ initial: "" }),
      price: new fields.NumberField({ initial: 0 }),
      type: new fields.StringField({ initial: "" }),
      action: actionField(),
      effect: new fields.StringField({ initial: "." }),
      description: new fields.StringField({ initial: "." }),
    };
  }
}

export class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      name: new fields.StringField({ initial: "" }),
      price: new fields.NumberField({ initial: 0 }),
      type: new fields.StringField({ initial: "" }),
      action: actionField(),
      effect: new fields.StringField({ initial: "." }),
      description: new fields.StringField({ initial: "." }),
    };
  }
}

export class MemoryData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      date: new fields.SchemaField({
        year: new fields.NumberField({ integer: true, initial: 2022 }),
        month: new fields.NumberField({ integer: true, initial: 1 }),
        day: new fields.NumberField({ integer: true, initial: 1 }),
      }),
      island: new fields.StringField({ initial: "" }),
      mission: new fields.StringField({ initial: "" }),
      completed: new fields.BooleanField({ initial: false }),
    };
  }
}

export class TreasureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.StringField({ initial: "." }),
    };
  }
}
