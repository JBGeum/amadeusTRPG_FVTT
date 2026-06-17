import {amadeRoll} from "../dice/roll.mjs";
import { postCard } from "../chat/chat.mjs";

/**
 * Extend the base Actor document.
 * 데이터 스키마와 파생 계산은 module/data/ 의 DataModel(CharacterData/NpcData)이 담당한다.
 * @extends {Actor}
 */
export class AmadeusActor extends Actor {

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    // 여기서 data는 캐릭터의 system

    if (this.type !== 'character') return;
    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    if (data.ability) {
      for (let [k, v] of Object.entries(data.ability)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== 'npc') return;

    // Process additional NPC data here.
  }

  async rollAmadeAbl(ability,label, options={}){
    const abl = this.system.ability[ability]
    const rank = abl.rank;
    const rankVal = abl.rankVal;
    let roll = await amadeRoll(rank, rankVal, this.getRollData());
    const resultDiceset = roll.dice[0].values;
    const templateData = {
      label, rank,
      mod: abl.mod,
      modVal: abl.modVal,
      rollDC: this.system.dc,
      resultDiceset}
    await postCard({
      actor: this,
      template: "systems/amadeus/templates/chatcard/roll-amadeabl.html",
      data: templateData,
    });
  }

}
