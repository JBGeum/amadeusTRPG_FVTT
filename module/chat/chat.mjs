import { buildFormulaRollView } from "../dice/resolution.mjs";

/**
 * 굴림 1개를 굴려 챗으로 보낸다. speaker/rollMode 보일러플레이트를 일원화한다.
 * @returns {Promise<Roll>} 평가된 Roll
 */
export async function postRoll({ actor, formula, flavor = "", rollData = {} } = {}) {
  const roll = new Roll(formula, rollData);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    rollMode: game.settings.get("core", "rollMode"),
  });
  return roll;
}

/**
 * 템플릿을 렌더해 챗 카드 메시지를 만든다.
 * @returns {Promise<ChatMessage>}
 */
export async function postCard({ actor, template, data = {}, flavor, style } = {}) {
  const content = await foundry.applications.handlebars.renderTemplate(template, data);
  const messageData = { content, speaker: ChatMessage.getSpeaker({ actor }) };
  if (flavor !== undefined) messageData.flavor = flavor;
  if (style !== undefined) messageData.style = style;
  return ChatMessage.create(messageData);
}

/**
 * 코어 Roll 챗 메시지(식량 1d6·대미지·기프트 수식·활력·채팅 /r)를 시스템 테마 카드로 교체한다.
 * postCard로 만든 커스텀 카드는 Roll을 메시지에 첨부하지 않아 isRoll === false → 자동 제외된다.
 * 안전망: 이미 .amadeus-chat 가 렌더된 메시지는 다시 처리하지 않는다.
 * @param {ChatMessage} message
 * @param {HTMLElement} html  렌더된 메시지 요소(v13: HTMLElement)
 */
export async function themeRollMessage(message, html) {
  if (!message.isRoll || !message.rolls?.length) return;
  if (html.querySelector(".amadeus-chat")) return;

  const roll = message.rolls[0];
  const dice = roll.dice.map((d) => ({ faces: d.faces, values: d.values }));
  const view = buildFormulaRollView({
    flavor: message.flavor,
    formula: roll.formula,
    total: roll.total,
    dice,
  });

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/amadeus/templates/chatcard/roll-formula.html",
    view,
  );
  const target = html.querySelector(".message-content");
  if (target) target.innerHTML = content;
}
