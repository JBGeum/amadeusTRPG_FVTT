import {amadeRoll} from "../dice/roll.mjs";
import { postCard } from "../chat/chat.mjs";
/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */

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
    if (!this.actor) return null;
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
    const speaker = ChatMessage.getSpeaker({actor: this.actor});
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
    // 아이템 정보만 표시하는 카드
    let card = null;
    if (this.type === "gift") card = this.#giftCardData();
    else if (this.type === "weapon" || this.type === "gear") card = this.#itemCardData();
    if (card) {
      await postCard({ actor: this.actor, template: card.template, data: card.data });
    }
  }

  #giftCardData() {
    const system = this.system;
    return {
      template: "systems/amadeus/templates/chatcard/data-gift.html",
      data: {
        name: this.name,
        type: game.i18n.localize(system.type),
        requirement: system.requirement,
        roll: game.i18n.localize(system.action.roll),
        tag: system.tag,
        effect: system.effect,
      },
    };
  }

  #itemCardData() {
    const system = this.system;
    return {
      template: "systems/amadeus/templates/chatcard/data-item.html",
      data: {
        name: this.name,
        type: game.i18n.localize(system.type),
        price: system.price,
        power: system.action.damage,
        effect: system.effect,
        description: system.description,
      },
    };
  }

  async getItemRollCard(rollAbl) {
    // 굴림 정보가 있는 아이템 롤
    const item = this;
    const actor = this.actor;

    // const rollMode = game.settings.get('core', 'rollMode');
    const label = `${item.name}`;
    const actorAbl = actor.system.ability[rollAbl];
    const ablLabel = game.i18n.localize(this.system.action.roll);
    const rank = actorAbl.rank;
    let roll = await amadeRoll(rank, actorAbl.rankVal, actor.getRollData());
    const templateData = {
      label,
      ablLabel,
      rank,
      mod: actorAbl.mod,
      modVal: actorAbl.modVal,
      rollDC: actor.system.dc,
      resultDiceset: roll.dice[0].values
    }
    if (this.type === "gift") {
      await postCard({
        actor,
        template: "systems/amadeus/templates/chatcard/roll-gift.html",
        data: templateData,
        flavor: ablLabel + "판정",
        style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      });
    }

  }

}
