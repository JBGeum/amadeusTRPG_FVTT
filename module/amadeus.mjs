// Import styles so Vite bundles them into dist/amadeus.css.
import "../scss/amadeus.scss";

// Import document classes.
import { AmadeusActor } from "./documents/actor.mjs";
import { AmadeusItem } from "./documents/item.mjs";
// Import sheet classes.
import { AmadeusActorSheet } from "./sheets/actor-sheet.mjs";
import { AmadeusItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { registerHandlebarsHelpers } from "./helpers/templates.mjs";
import { AMADEUS } from "./helpers/config.mjs";
// Import data models.
import { CharacterData } from "./data/actor-character.mjs";
import { NpcData } from "./data/actor-npc.mjs";
import { GiftData, BackgroundData, ParentData, WeaponData, GearData, MemoryData, TreasureData } from "./data/item-data.mjs";
import { registerPlotSocket } from "./initiative/socket.mjs";
import { PlotPrompt } from "./initiative/plot-prompt.mjs";
import { PlotGMPanel } from "./initiative/gm-panel.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function() {

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.amadeus = {
    AmadeusActor,
    AmadeusItem,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.AMADEUS = AMADEUS;

  // Register system DataModels (keys must match template.json types).
  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData,
  });
  Object.assign(CONFIG.Item.dataModels, {
    gift: GiftData,
    background: BackgroundData,
    parent: ParentData,
    weapon: WeaponData,
    gear: GearData,
    memory: MemoryData,
    treasure: TreasureData,
  });

  // Define custom Document classes
  CONFIG.Actor.documentClass = AmadeusActor;
  CONFIG.Item.documentClass = AmadeusItem;

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("amadeus", AmadeusActorSheet, { makeDefault: true });
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("amadeus", AmadeusItemSheet, { makeDefault: true });

  // Preload Handlebars templates.
  registerHandlebarsHelpers();
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function() {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));
  registerPlotSocket();
  Hooks.on("amadeus.plotStart", (data) => {
    if (!game.user.isGM) PlotPrompt.openForUser(data.sessionId);
  });
  Hooks.on("amadeus.plotEnd", () => {
    if (!game.user.isGM) PlotPrompt.closeAll();
  });
  game.amadeus.plotInitiative = () => {
    if (!game.user.isGM) return ui.notifications.warn("GM only");
    new PlotGMPanel().render(true);
  };
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item") return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn("You can only create macro buttons for owned Items");
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.amadeus.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "amadeus.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then(item => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(`Could not find item ${itemName}. You may need to delete and recreate this macro.`);
    }

    // Trigger the item roll
    item.roll();
  });
}

/* -------------------------------------------- */
/*  Scene Controls (GM: 플롯 이니셔티브)         */
/* -------------------------------------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  controls.amadeusPlot = {
    name: "amadeusPlot",
    title: "AMADEUS.initiative.panelTitle",
    icon: "fas fa-dice",
    layer: "tokens",
    tools: {
      open: {
        name: "open",
        title: "AMADEUS.initiative.panelTitle",
        icon: "fas fa-dice",
        button: true,
        onClick: () => game.amadeus.plotInitiative(),
      },
    },
    activeTool: "open",
  };
});