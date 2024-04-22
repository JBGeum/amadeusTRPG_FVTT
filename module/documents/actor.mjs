import {amadeRoll} from "./roll.mjs";

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class AmadeusActor extends Actor {
  //schmm https://foundryvtt.com/api/#actor 오버라이드 가능한 메서드 (from Actor class)
  // basic data : template.json에 정의되어 잇고 캐릭터 시트에서 수정 가능(template.json에 없으면 유지되지 않음)
  // derived data : 저장하지 않고 필요할 때 계산하면 되는 값들 (기능 점수에 적용할 기능 수정치), 직접 입력할 필요가 없는 값들

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   * 캐릭터 스탯 중 계산할 것들은 여기로(실제로는 _prepare캐릭터타입Data쪽으로 나누기)
   */
  prepareDerivedData() {
    //schmm https://foundryvtt.com/api/classes/client.Actor.html#defineSchema
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.amadeus || {};

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    // 캐릭터에서만 처리할 것, npc등으로만 처리할 것을 따로 구분해서
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== 'character') return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;
    //schmm 소지금, 생명력 초기치 계산
    // 생명력   S(4) A(3) B(2) C(1) D(0)  | +++ ++  +   .   -   --
    //         10   7    3    5    1     | 6   3   1   0   -1  -2
    // 소지금   S(4) A(3) B(2) C(1) D(0)  | +++ ++  +   .   -   --
    //         7    5    4    3    2     | 3   2   1   0   -1  -2

    this._setRankModLetter(systemData);
    this._calculateInitHealth(systemData);
    this._calculateCalcHealth(systemData);
    this._calculateInitMoney(systemData);
    // // Loop through ability scores, and add their modifiers to our sheet output.
    // for (let [key, ability] of Object.entries(systemData.abilities)) {
    //   // Calculate the modifier using d20 rules.
    //   ability.mod = Math.floor((ability.value - 10) / 2);
    //}
  }

  _setRankModLetter(systemData){
    for (let [key, ability] of Object.entries(systemData.ability)) {
      switch(ability.rank) {
        case 'D': ability.rankVal = 0;  break;
        case 'C': ability.rankVal = 1;  break;
        case 'B': ability.rankVal = 2;  break;
        case 'A': ability.rankVal = 3;  break;
        case 'S': ability.rankVal = 4;  break;
      }
      switch(ability.mod) {
        case '--': ability.modVal = -2; break;
        case '-': ability.modVal = -1; break;
        case ' ': ability.modVal = 0; break;
        case '+': ability.modVal = 1;  break;
        case '++': ability.modVal = 2;  break;
        case '+++': ability.modVal = 3;  break;
      }
    }
  }

  _calculateInitHealth(systemData) {
    // 생명력   S(4) A(3) B(2) C(1) D(0)  | +++ ++  +   .   -   --
    //         10   7    5    3    1     | 6   3   1   0   -1  -2
    let initHealth = 0;
    switch(systemData.ability.warfare.rank) {
      case 'D': initHealth += 1;  break;
      case 'C': initHealth += 3;  break;
      case 'B': initHealth += 5;  break;
      case 'A': initHealth += 7;  break;
      case 'S': initHealth += 10;  break;
    }
    switch(systemData.ability.warfare.mod) {
      case '--': initHealth -= 2; break;
      case '-': initHealth -= 1; break;
      case ' ': break;
      case '+': initHealth += 1;  break;
      case '++': initHealth += 3;  break;
      case '+++': initHealth += 6;  break;
    }
    switch(systemData.ability.spirit.rank) {
      case 'D': initHealth += 1;  break;
      case 'C': initHealth += 3;  break;
      case 'B': initHealth += 5;  break;
      case 'A': initHealth += 7;  break;
      case 'S': initHealth += 10;  break;
    }
    switch(systemData.ability.spirit.mod) {
      case '--': initHealth -= 2; break;
      case '-': initHealth -= 1; break;
      case ' ': break;
      case '+': initHealth += 1;  break;
      case '++': initHealth += 3;  break;
      case '+++': initHealth += 6;  break;
    }
    systemData.initHealth = initHealth;
  }

  _calculateCalcHealth(systemData) {
    systemData.calcHealth = parseInt(systemData.initHealth) + parseInt(systemData.vitality);
  }

  _calculateInitMoney(systemData) {
    // 소지금   S(4) A(3) B(2) C(1) D(0)  | +++ ++  +   .   -   --
    //         7    5    4    3    2     | 3   2   1   0   -1  -2
    let money = 0;
    switch(systemData.ability.love.rank) {
      case 'D': money += 2;  break;
      case 'C': money += 3;  break;
      case 'B': money += 4;  break;
      case 'A': money += 5;  break;
      case 'S': money += 7;  break;
    }
    switch(systemData.ability.love.mod) {
      case '--': money -= 2; break;
      case '-': money -= 1; break;
      case ' ': break;
      case '+': money += 1;  break;
      case '++': money += 2;  break;
      case '+++': money += 3;  break;
    }
    switch(systemData.ability.mundane.rank) {
      case 'D': money += 2;  break;
      case 'C': money += 3;  break;
      case 'B': money += 4;  break;
      case 'A': money += 5;  break;
      case 'S': money += 7;  break;
    }
    switch(systemData.ability.mundane.mod) {
      case '--': money -= 2; break;
      case '-': money -= 1; break;
      case ' ': break;
      case '+': money += 1;  break;
      case '++': money += 2;  break;
      case '+++': money += 3;  break;
    }
    systemData.initMoney = money;
    }




    /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;
    systemData.xp = (systemData.cr * systemData.cr) * 100;
  }

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
    /*
    // Add level for easier access, or fall back to 0.
    if (data.attributes.level) {
      data.lvl = data.attributes.level.value ?? 0;
    }
 */
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
    let content = await renderTemplate("systems/amadeus/templates/chatcard/roll-amadeabl.html", templateData)
    ChatMessage.create({content, speaker : ChatMessage.getSpeaker({actor: this})});
  }

}