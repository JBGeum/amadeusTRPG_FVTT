/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class AmadeusItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["amadeus", "sheet", "item"],
      width: 480,
      height: 720,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/amadeus/templates/item";
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.html`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.html`.
    return `${path}/item-${this.item.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve base data structure.
    const context = super.getData();
    //schmm : 20:26 https://youtu.be/gcSN4AQcUzM?t=1226
    context.config = CONFIG.AMADEUS;

    // Use a safe clone of the item data for further operations.
    const itemData = context.item;

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = {};
    let actor = this.object?.parent ?? null;
    if (actor) {
      context.rollData = actor.getRollData();
    }

    context.label ={};
    context.label.abl = {};
    for (let [k, v] of Object.entries(CONFIG.AMADEUS.ability)) {
      context.label.abl[v] = game.i18n.localize(v) ?? k;
    }
    context.label.type = {};
    for (let [k, v] of Object.entries(CONFIG.AMADEUS.gift)) {
      context.label.type[v] = game.i18n.localize(CONFIG.AMADEUS.gift[k]) ?? k;
    }


    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers, click handlers, etc. would go here.
  }
}
