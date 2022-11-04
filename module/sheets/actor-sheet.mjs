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
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
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

    /*schmm ? 11.03 02.54 체크박스 수정 안 되나??
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
    const bond = [];
    const supporter = [];
    const inventory = [];


    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      // Append to gear.
      if (i.type === 'gift') {
        /*
        *         for (let [k, v] of Object.entries(context.items.system.action.ability)) {
          v.label = game.i18n.localize(CONFIG.AMADEUS.ability[k]) ?? k;
        }
        for (let [k, v] of Object.entries(context.items.system.type)) {
          v.label = game.i18n.localize(CONFIG.AMADEUS.gift[k]) ?? k;
        }
        * */
        gifts.push(i);}
      else if (i.type === 'background') {background.push(i);}
      else if (i.type === 'parent') {parent.push(i);}
      else if (i.type === 'bond') {bond.push(i);}
      else if (i.type === 'supporter') {supporter.push(i);}
      else if (i.type === 'weapon') {inventory.push(i);}
      else if (i.type === 'gear') {inventory.push(i);}
      }

    // Assign and return
    context.gifts = gifts;
    context.background = background;
    context.parent = parent;
    context.bond = bond;
    context.supporter = supporter;
    context.inventory = inventory;


  }

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

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });

      //아마데우스 능력치 롤
      html.find('.amade-abl-roll').click(this._onRollAmadeAbl.bind(this));
    }
    //아이템 이름 클릭시 (데이터 챗카드 표시)
    html.find('.item-datacard').click(this._onItemDataCard.bind(this));
    //아이템 능력치 롤
    html.find('.item-rollcard').click(this._onItemRollCard.bind(this));

    html.find('.item-chk').click(this._updateItemChk.bind(this));

    html.find('.open-gift').click(this._onOpenGiftMenu.bind(this));
    html.find('.gift-memo').change(this._upDateItemMemo.bind(this));
    html.find('.gift-formula').change(this._upDateItemMemo.bind(this));

  }
  _onOpenGiftMenu(event){
    event.preventDefault()
    const element = event.currentTarget;
    var hidden = $(element).closest('.gift-card').children('.gift-hidden');
    hidden.toggleClass('active');
    if(hidden.hasClass('active')) hidden.css("display", "block");
    else hidden.css("display", "none");
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
    const name = `New ${type.capitalize()}`;
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

  _onRollAmadeAbl(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    let ability = dataset.ability;
    let label = dataset.label;
    this.actor.rollAmadeAbl(ability,label, {event: event});

  }

  _onItemDataCard(event){
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) return item.getItemDataCard();
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
