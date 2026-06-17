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
