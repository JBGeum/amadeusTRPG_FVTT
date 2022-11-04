import {amadeRoll} from "./roll.mjs";
/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
import {getKeybyValue} from "../helpers/config.mjs";

export class AmadeusItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
   getRollData() {
    // If present, return the actor's roll data.
    if ( !this.actor ) return null;
    const rollData = this.actor.getRollData();
    // Grab the item's system data as well.
    rollData.item = foundry.utils.deepClone(this.system);

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
*/
  async roll() {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? ''
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.item.formula, rollData);
      // If you need to store the value first, uncomment the next line.
      // let result = await roll.roll({async: true});
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }


 async getItemDataCard() {
    // 아이템 정보만 표시하는 롤
    const item = this;

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    // const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;
    let content="";

    //타입별로 챗 카드 처리
    if(this.type === "gift"){
      content = await this.getGiftChatCard(this);
    } else if(this.type="weapon") {
      ChatMessage.create({
        speaker: speaker,
        content: ""
      });
    } else if(this.type ==="gear"){
      ChatMessage.create({
        speaker: speaker,
        content: ""
      });
        } else if(this.type ==="background"){ }
    else if(this.type === "parent"){ }
    else if(this.type ==="bond"){ }
    else if(this.type ==="parent"){ }
    if(content){
        ChatMessage.create({content, speaker : ChatMessage.getSpeaker({alias : game.user.name }),type : 3});
    }
  }


  async getGiftChatCard(gift) {
    const system = gift.system;
    const templateData = {
        name: this.name,
        type: game.i18n.localize(system.type),
        requirement: system.requirement,
        roll: game.i18n.localize(system.action.roll),
        tag: system.tag,
        effect: system.effect
    };
    let content = await renderTemplate("systems/amadeus/templates/chatcard/data-item.html", templateData)
    return content;
  }

async getItemRollCard(rollAbl) {
    // 굴림 정보가 있는 아이템 롤
    const item = this;
    const actor = this.actor;

    const speaker = ChatMessage.getSpeaker({ actor: actor });
    // const rollMode = game.settings.get('core', 'rollMode');
    const label = `${item.name}`;
    //const rollAbl = getKeybyValue(CONFIG.AMADEUS.ability,this.system.action.ability);
    // AMADEUS.ability.warfare -> warfare
    const actorAbl = actor.system.ability[rollAbl];
    const ablLabel = game.i18n.localize(this.system.action.roll);
    const rank = actorAbl.rank;
    let roll = await amadeRoll(rank, actorAbl.rankVal, actor.getRollData());
    const templateData = {
        label,
        ablLabel,
        rank,
        mod: actorAbl.mod,
        modVal : actorAbl.modVal,
        rollDC : actor.system.dc,
        resultDiceset : roll.dice[0].values
    }
    let content;
    if(this.type === "gift"){
        content = await renderTemplate("systems/amadeus/templates/chatcard/roll-gift.html", templateData)
    }

    //let content = await this.getAmadeDiceCard(resultDiceset, rollData); //목표치 넣기
    if(content)
        ChatMessage.create({content, speaker: ChatMessage.getSpeaker({alias: game.user.name}), type: 3})


/*
    //타입별로 챗 카드 처리 : 기프트, 무기, 소모품
    if(this.type === "gift"){
        //기프트에서 사용 능력치 가져옴+액터에서 해당 능력치 랭커, 모드 가져옴

        content = this._getGiftChatCard();
        ChatMessage.create({content, speaker : ChatMessage.getSpeaker({alias : game.user.name }),type : 3});
    } else if(this.type="weapon") {
        ChatMessage.create({
            speaker: speaker,
            content: ""
        });
    } else if(this.type ==="gear"){
        ChatMessage.create({
            speaker: speaker,
            content: ""
        });
    } else { }
*/
  }

  async _getGiftChatCard(templateData){
      let content = await renderTemplate("systems/amadeus/templates/chatcard/roll-gift.html", templateData)
      return content;
  }

    getAmadeDiceCard(diceset, {label,ablLabel,rank,mod,modVal,rollDC}={}){

        let diceCard = "<div class='amade-dicecard text-align'>"+
            "<div class='roll-title'><h3>"+ label +"("+ablLabel+"판정)</h3>" +
            "<div class='rankMod flexrow'>"+
            "<div class='rank-label'>"+ rank+"</div>"+
            "<div class='mod-label'>"+ mod +"</div></div></div>"+
            "<div class='roll-dc'>목표치: "+ rollDC +"</div>"+"<div class='diceset-area flexrow align-center'>";
        for(let die of diceset) {
            let dieCard ="<div class='die-result flexcol'>" +
                "<div class='die-area'><div class='amade-d6 dNum-"+ die +"'>" +
                die + "</div></div>";
            let modValFormat = modVal>=0 ? " +"+modVal : " -"+Math.abs(modVal);
            dieCard += "<div class='modval-format'>" + modValFormat + "</div>";
            let resultText = die+modVal>=rollDC ? "성공" : "실패";
            dieCard += "<div class='roll-result-text'>"+ resultText +" </div></div>";
            diceCard += dieCard;
        }
        diceCard += "</div>";
        /*
            let diceCard = "<div class='dice-roll'>" + label+ " 판정" +
                "<div class='dice-result'><div class='dice-tooltip expanded flexrow'>" +
                "<ol class='dice-rolls'>";
            for(let die of diceset){
              diceCard +=  "<div class = 'flexcol'><li class='roll die d6'>" + die + "</li><hr>"
              let modValFormat;
              if(modVal > 0){
                modValFormat = " + " + modVal;
              } else if (modVal<0){
                modValFormat = " - " + Math.abs(modVal);
              }
              diceCard += die+modValFormat+ "</div>";
            }
            diceCard += "<div>목표치 : dc </div>"
            diceCard += "</ol>" +
                "</div></div></div>";
         */
        return diceCard;

    }

}
