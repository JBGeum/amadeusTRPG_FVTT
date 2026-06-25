import { resolveDie, colorToFace } from "../dice/resolution.mjs";

/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {
  return foundry.applications.handlebars.loadTemplates([

    // Actor partials.
    "systems/amadeus/templates/actor/parts/actor-features.html",
    "systems/amadeus/templates/actor/parts/actor-item.html",
    "systems/amadeus/templates/actor/parts/actor-bond.html",
    "systems/amadeus/templates/actor/parts/actor-effects.html",
    "systems/amadeus/templates/actor/parts/actor-gift.html",

    // chatcard templates
    "systems/amadeus/templates/chatcard/roll-amadeabl.html",
    "systems/amadeus/templates/chatcard/roll-gift.html",
    "systems/amadeus/templates/chatcard/data-gift.html",
    "systems/amadeus/templates/chatcard/data-item.html",
    "systems/amadeus/templates/chatcard/data-description.html",
    "systems/amadeus/templates/chatcard/plot-done.html",
    "systems/amadeus/templates/chatcard/plot-result.html",
    "systems/amadeus/templates/chatcard/mood-result.html",
    "systems/amadeus/templates/chatcard/roll-formula.html",

  ]);
};

export function registerHandlebarsHelpers(){
  Handlebars.registerHelper("concat", function (...args) {
    // 마지막 인자는 Handlebars options 객체이므로 제외한다.
    return args.slice(0, -1).join("");
  });
  Handlebars.registerHelper("toLowerCase", function (str) {
    return String(str).toLowerCase();
  });

  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  // 플롯 값 표시용: 6은 '권외'로 표시한다(값은 그대로 6).
  Handlebars.registerHelper("plotLabel", function (value) {
    return value === 6 ? game.i18n.localize("AMADEUS.initiative.outOfRange") : value;
  });

  Handlebars.registerHelper("checked", function (condition) {
      return (condition) ? "checked" : "";
  });

  Handlebars.registerHelper("successCheck", function (die, modVal, rollDC) {
    const label = { fumble: "펌블", special: "스페셜", success: "성공", fail: "실패" };
    return label[resolveDie(die, modVal, rollDC)] ?? "?";
  });

  // 판정 결과 문자열 → 한국어 라벨. successCheck와 동일한 라벨 집합.
  Handlebars.registerHelper("outcomeLabel", function (outcome) {
    const label = { fumble: "펌블", special: "스페셜", success: "성공", fail: "실패" };
    return label[outcome] ?? "?";
  });

  // 색 키 → die-face 번호. 색 스와치가 .chat-die-chip--N 색을 재사용하기 위함.
  Handlebars.registerHelper("colorFaceLit", function (color) {
    return colorToFace(color);
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
}
