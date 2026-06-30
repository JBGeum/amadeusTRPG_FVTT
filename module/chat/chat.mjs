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

  // RollTable 드로우 메시지는 한 메시지에 주사위 + 뽑힌 결과 문구를 함께 담는다.
  // 시트의 시련/휴식 버튼(displayChat:false + postCard)과 외형을 통일하기 위해,
  // 사이드바 Draw·/draw 등 코어 경로로 만들어진 메시지도 같은 roll-table 카드로 재렌더한다.
  const tableId = message.getFlag("core", "RollTable");
  if (tableId) return themeRollTableMessage(message, html, tableId);

  // 단일 롤 메시지를 가정한다(일반적인 경우). 복수 롤이면 첫 번째만 테마한다.
  const roll = message.rolls[0];
  const dice = roll.dice.map((d) => ({ faces: d.faces, values: d.values }));
  // 주사위 항이 없는 순수 산술 롤(예: /r 5+3)은 테마하지 않고 코어 카드를 유지한다.
  if (!dice.length) return;
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

/**
 * 코어 RollTable 드로우 메시지를 시트 경로와 동일한 테마 카드(roll-table.html)로 교체한다.
 * 굴림 총합으로 결과를 재조회(getResultsForRoll)하므로 draw가 원래 뽑은 결과와 일치한다.
 * 테이블/결과를 복원하지 못하면 코어 카드를 그대로 두어 결과 문구가 사라지지 않게 한다.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @param {string} tableId  message flag(core.RollTable)에 담긴 테이블 id
 */
async function themeRollTableMessage(message, html, tableId) {
  const table = game.tables.get(tableId) ?? game.tables.find((t) => t.uuid === tableId);
  const roll = message.rolls[0];
  const results = table?.getResultsForRoll(roll.total) ?? [];
  if (!results.length) return; // 복원 실패 → 코어 카드 유지(결과 문구 보존)

  const parts = await Promise.all(results.map((r) => r.getHTML()));
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/amadeus/templates/chatcard/roll-table.html",
    { name: table.name, total: roll?.total, text: parts.join("") },
  );
  const target = html.querySelector(".message-content");
  if (target) target.innerHTML = content;
}
