const fields = foundry.data.fields;

export class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cr: new fields.NumberField({ required: true, initial: 0 }),
    };
  }

  /** 기존 _prepareNpcData: xp = cr^2 * 100 */
  prepareDerivedData() {
    this.xp = this.cr * this.cr * 100;
  }
}
