import {onManageActiveEffect, prepareActiveEffectCategories} from "../helpers/effects.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class AmadeusActorSheet extends ActorSheet {



  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["amadeus", "sheet", "actor"],
      template: "systems/amadeus/templates/actor/actor-sheet.html",
      width: 800,
      height: 900,
      resizable: false,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "item" }]
    });
  }

  /** @override */
  get template() {
    return `systems/amadeus/templates/actor/actor-${this.actor.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();
    //schmm : 20:26 https://youtu.be/gcSN4AQcUzM?t=1226
    context.config = CONFIG.AMADEUS;

    // Use a safe clone of the actor data for further operations.
    const actorData = this.actor.toObject(false);

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    /*
    // Owned Items
    context.items = Array.from(this.actor.items.values());
    context.items = context.items.map( i => {
      i.system.id = i.id;
      return i.system;
    });*/

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);
    context.permission = this.editable;

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    for (let [k, v] of Object.entries(context.system.ability)) {
      v.label = game.i18n.localize(CONFIG.AMADEUS.ability[k]) ?? k;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gifts = [];
    const background = [];
    const parent = [];
    const inventory = [];
    const memory = [];
    const treasure = [];


    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      // Append to gear.
      if (i.type === 'gift') {gifts.push(i);}
      else if (i.type === 'background') {background.push(i);}
      else if (i.type === 'parent') {parent.push(i);}
      else if (i.type === 'weapon') {inventory.push(i);}
      else if (i.type === 'gear') {inventory.push(i);}
      else if (i.type === 'memory') {memory.push(i);}
      else if (i.type === 'treasure') {treasure.push(i);}
      }

    // Assign and return
    gifts.sort(function(a,b){return a._stats.modifiedTime - b._stats.modifiedTime});
    inventory.sort(function(a,b){return a._stats.modifiedTime - b._stats.modifiedTime});
    memory.sort(function(a,b){return a._stats.createdTime - b._stats.createdTime});
    context.gifts = gifts;
    context.background = background;
    context.parent = parent;
    context.inventory = inventory;
    context.memory = memory;
    context.treasure = treasure;


  }


  /* -------------------------------------------- */

  /** @override */
  async _onDropItem(event, data) {
    if ( !this.actor.isOwner ) return false;
    const item = await Item.implementation.fromDropData(data);
    const itemData = item.toObject();

    //schmm 수정구간
    if(item.type === 'parent'){
      for(let [k, v] of this.actor.items.entries()){
        if(v.type ==='parent') this.actor.items.delete(k);
        } //이전 부모신 데이터 삭제
      this.actor.update({
        'system.chardata.parent' : item.name,
        'system.chardata.pantheon' : item.system.pantheon,
        'system.chardata.parentkey' : item._id,
        'system.chardata.parentimg' : item.system.portrait,
        'system.ability.warfare.rank' : item.system.ability.warfare.rank,
        'system.ability.warfare.mod' : item.system.ability.warfare.mod,
        'system.ability.technique.rank' : item.system.ability.technique.rank,
        'system.ability.technique.mod' : item.system.ability.technique.mod,
        'system.ability.brain.rank' : item.system.ability.brain.rank,
        'system.ability.brain.mod' : item.system.ability.brain.mod,
        'system.ability.spirit.rank' : item.system.ability.spirit.rank,
        'system.ability.spirit.mod' : item.system.ability.spirit.mod,
        'system.ability.love.rank' : item.system.ability.love.rank,
        'system.ability.love.mod' : item.system.ability.love.mod,
        'system.ability.mundane.rank' : item.system.ability.mundane.rank,
        'system.ability.mundane.mod' : item.system.ability.mundane.mod,
      });
      }

    // Handle item sorting within the same Actor
    if ( this.actor.uuid === item.parent?.uuid ) return this._onSortItem(event, itemData);

    // Create the owned item
    return this._onDropItemCreate(itemData);
  }

  /* -------------------------------------------- */


  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // 접힌 메뉴 열기
    html.find('.open-gift').click(this._onOpenGiftMenu.bind(this));
    html.find('.open-item').click(this._onOpenItemMenu.bind(this));
    html.find('.open-treasure').click(this._onOpenTrsMemMenu.bind(this));
    html.find('.open-memory').click(this._onOpenTrsMemMenu.bind(this));
    // 위쪽으로는 수정권한 없어도 가능
    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));
    html.find('.damage-formula').click(this._onDamageRoll.bind(this));
    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
    //아마데우스 능력치 롤
    html.find('.amade-abl-roll').click(this._onRollAmadeAbl.bind(this));
    html.find('.vitality-roll').click(this._onRollVitality.bind(this));
    //아이템 이름 클릭시 (데이터 챗카드 표시)
    html.find('.item-datacard').click(this._onItemDataCard.bind(this));
    //아이템 능력치 롤
    html.find('.item-rollcard').click(this._onItemRollCard.bind(this));
    html.find('.gift-formula-roll').click(this._onGiftFormulaRoll.bind(this));
    //업데이트 류
    html.find('.item-chk').click(this._updateItemChk.bind(this));
    html.find('.gift-memo').change(this._upDateItemMemo.bind(this));
    html.find('.gift-formula').change(this._upDateItemMemo.bind(this));

    html.find('.amd-rolltable').click(this._onRollTable.bind(this));

  }

  _onOpenGiftMenu(event){
    event.preventDefault()
    const element = event.currentTarget;
    var hidden = $(element).closest('.gift-card').children('.gift-hidden');
    hidden.toggleClass('content-visible');
    hidden.toggleClass('content-hidden');
    if(hidden.hasClass('content-visible')) hidden.css("display", "block");
    else if (hidden.hasClass('content-hidden'))  hidden.css("display", "none");
  };

  _onOpenItemMenu(event){
    event.preventDefault()
    const element = event.currentTarget;
    var hidden = $(element).closest('.item').children('.item-hidden');
    hidden.toggleClass('content-visible');
    hidden.toggleClass('content-hidden');
    if(hidden.hasClass('content-visible')) hidden.css("display", "block");
    else if (hidden.hasClass('content-hidden'))  hidden.css("display", "none");
  };

  _onOpenTrsMemMenu(event){
    event.preventDefault()
    const element = event.currentTarget;
    var hidden = $(element).parent().parent().next();
    hidden.toggleClass('content-visible');
    hidden.toggleClass('content-hidden');
    if(hidden.hasClass('content-visible')) hidden.css("display", "block");
    else if (hidden.hasClass('content-hidden'))  hidden.css("display", "none");
  };



  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = game.i18n.localize(CONFIG.AMADEUS.label[type]);

    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system["type"];

    // Finally, create the item!
    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }


  async _onRollTable(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    // Handle item rolls.
    if (dataset.rtid) {
      const pack = game.packs.get("amadeus.rolltable")
      const table = await pack.getDocuments();
      for(let t of table){
        if(t.id == dataset.rtid){
          t.draw();
        }
      }
    }
  }



  _onDamageRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset.rolltype === "item") {
      const itemId = element.closest('.item').dataset.itemId;
      const item = this.actor.items.get(itemId);
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: item.name,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    } else if (dataset.rolltype === "gift"){

    }
  }

  _onGiftFormulaRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const formula = element.previousElementSibling.value;
    if(formula){
      let roll = new Roll(formula, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: item.name,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }


  _onRollAmadeAbl(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    let ability = dataset.ability;
    let label = dataset.label;
    this.actor.rollAmadeAbl(ability,label, {event: event});

  }

  _onRollVitality(event){
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    let label = dataset.label ? `${dataset.label}` : '';
    let roll = new Roll(dataset.roll, this.actor.getRollData());
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: label,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    this.actor.update({'system.vitality': roll.result});
    return roll;
  }

  _onItemDataCard(event){
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    if(element.closest('.item').dataset.special === 'food'){
      const food = game.items.get(itemId);
      if (food) return food.getItemDataCard();
    } else {
      const item = this.actor.items.get(itemId);
      if (item) return item.getItemDataCard();
    }
  }

  _onItemRollCard(event){
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    // AMADEUS.ability.warfare -> warfare
    let abl = element.dataset.ability;
    if(abl === 'notroll' || !abl){
      return;
    }
    let formatAbl = abl.substring(abl.lastIndexOf(".")+1);
    if (item) return item.getItemRollCard(formatAbl);
  }

  _updateItemChk(event){
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    let chkbox = this.actor.items.get(itemId).system.chkbox;
    let data= {};
    data[event.target.dataset.path] = !chkbox;
    this.actor.items.get(itemId).update(data);  //schmm update방식 기억
  }

  _upDateItemMemo(event){
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    let data= {};
    data[event.target.dataset.path] = element.value;
    this.actor.items.get(itemId).update(data);
  }
}
