/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {
  return loadTemplates([

    // Actor partials.
    "systems/amadeus/templates/actor/parts/actor-features.html",
    "systems/amadeus/templates/actor/parts/actor-item.html",
    "systems/amadeus/templates/actor/parts/actor-spells.html",
    "systems/amadeus/templates/actor/parts/actor-effects.html",
    "systems/amadeus/templates/actor/parts/actor-gift.html",

    // chatcard templates
    "systems/amadeus/templates/chatcard/roll-amadeabl.html",
    "systems/amadeus/templates/chatcard/roll-gift.html",
    "systems/amadeus/templates/chatcard/data-gift.html",
    "systems/amadeus/templates/chatcard/roll-item.html",
    "systems/amadeus/templates/chatcard/data-item.html",

  ]);
};

export function registerHandlebarsHelpers(){
    Handlebars.registerHelper("checked", function (condition) {
        return (condition) ? "checked" : "";
    });

    Handlebars.registerHelper("successCheck", function (die,modVal,rollDC) {
        return (die+modVal>=rollDC) ? "성공" : "실패";
    });

    Handlebars.registerHelper("formatModVal", function (modVal) {
        return (modVal>=0) ? " +"+modVal : " -"+Math.abs(modVal);
    });
}
