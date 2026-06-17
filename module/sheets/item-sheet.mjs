import { FixedWidthMixin } from "../helpers/fixed-width.mjs";

const { HandlebarsApplicationMixin, DocumentSheetV2 } = foundry.applications.api;

/**
 * Amadeus Item 시트 (ApplicationV2).
 * 아이템 타입별 템플릿은 PARTS에 모두 등록하고 _configureRenderOptions에서 현재 타입만 렌더한다.
 * @extends {DocumentSheetV2}
 */
export class AmadeusItemSheet extends FixedWidthMixin(HandlebarsApplicationMixin(DocumentSheetV2)) {
  static DEFAULT_OPTIONS = {
    classes: ["amadeus", "sheet", "item"],
    position: { width: 480, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    gift: { template: "systems/amadeus/templates/item/item-gift-sheet.html" },
    background: { template: "systems/amadeus/templates/item/item-background-sheet.html" },
    parent: { template: "systems/amadeus/templates/item/item-parent-sheet.html" },
    weapon: { template: "systems/amadeus/templates/item/item-weapon-sheet.html" },
    gear: { template: "systems/amadeus/templates/item/item-gear-sheet.html" },
    memory: { template: "systems/amadeus/templates/item/item-memory-sheet.html" },
    treasure: { template: "systems/amadeus/templates/item/item-treasure-sheet.html" },
  };

  /** 현재 아이템 타입의 part만 렌더한다. */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    options.parts = [this.document.type];
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;

    context.config = CONFIG.AMADEUS;
    context.item = item;
    context.system = item.system;
    context.flags = item.flags;
    context.editable = this.isEditable;
    context.rollData = item.actor?.getRollData() ?? {};

    // selectOptions용 라벨 맵: { 저장값: 현지화라벨 }.
    // type/roll(abl) 은 기존처럼 i18n 키를 저장값으로 보존한다(item.mjs 챗카드의 localize 호환).
    // color 는 색 키(red/blue/…)를 저장값으로 둔다 → 액터 data-skin·seal-char(lookup config.color)와 일치.
    // rank/mod 는 letter(S~D / +++~--)를 저장값으로 보존한다.
    context.label = { abl: {}, type: {}, itemType: {}, color: {}, rank: {}, mod: {} };
    for (const v of Object.values(CONFIG.AMADEUS.ability)) context.label.abl[v] = game.i18n.localize(v);
    for (const v of Object.values(CONFIG.AMADEUS.gift)) context.label.type[v] = game.i18n.localize(v);
    for (const v of Object.values(CONFIG.AMADEUS.item)) context.label.itemType[v] = game.i18n.localize(v);
    for (const [k, v] of Object.entries(CONFIG.AMADEUS.color)) context.label.color[k] = game.i18n.localize(v);
    for (const letter of Object.keys(CONFIG.AMADEUS.rank)) context.label.rank[letter] = letter;
    for (const letter of Object.keys(CONFIG.AMADEUS.modL)) context.label.mod[letter] = letter;

    // 리치텍스트 enrich (effect/description 보유 타입). v13 ProseMirror 표시용.
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const enrichOpts = { secrets: item.isOwner, rollData: context.rollData };
    if (typeof item.system.effect === "string")
      context.enrichedEffect = await TextEditor.enrichHTML(item.system.effect, enrichOpts);
    if (typeof item.system.description === "string")
      context.enrichedDescription = await TextEditor.enrichHTML(item.system.description, enrichOpts);

    return context;
  }
}
