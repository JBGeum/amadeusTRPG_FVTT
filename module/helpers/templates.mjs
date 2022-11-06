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
    "systems/amadeus/templates/actor/parts/actor-bond.html",
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
      if(die == 1) return "펌블";
      else if(die == 6) return "스페셜";
      else if (die+modVal>=rollDC) return "성공";
      else if (die+modVal<rollDC) return "실패";
      else return "?";
  });

  Handlebars.registerHelper("formatModVal", function (modVal) {
      return (modVal>=0) ? " +"+modVal : " -"+Math.abs(modVal);
  });

  Handlebars.registerHelper('times', function(n, block) {
    var accum = '';
    for(var i = 0; i < n; ++i) {
      block.data.index = i;
      block.data.first = i === 0;
      block.data.last = i === (n - 1);
      accum += block.fn(this);
    }
    return accum;
  });
  Handlebars.registerHelper('getBond', function(n, system, block) {
    const bond = { "index": index, "bond": system.bond[index]}
    return bond;
  });
  Handlebars.registerHelper('getSupporter', function(n, system, block) {
    const supporter = { "index": index, "bond": system.supporter[index]}
    return supporter;
  });
}
