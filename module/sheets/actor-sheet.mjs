import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { postRoll } from "../chat/chat.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Amadeus Actor 시트 (ApplicationV2).
 * @extends {ActorSheetV2}
 */
export class AmadeusActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["amadeus", "sheet", "actor"],
    position: { width: 800, height: 900 },
    window: { resizable: false },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      itemEdit: AmadeusActorSheet.#onItemEdit,
      itemCreate: AmadeusActorSheet.#onItemCreate,
      itemDelete: AmadeusActorSheet.#onItemDelete,
      effectControl: AmadeusActorSheet.#onEffectControl,
      roll: AmadeusActorSheet.#onRoll,
      damageRoll: AmadeusActorSheet.#onDamageRoll,
      ablRoll: AmadeusActorSheet.#onAblRoll,
      vitalityRoll: AmadeusActorSheet.#onVitalityRoll,
      itemDataCard: AmadeusActorSheet.#onItemDataCard,
      itemRollCard: AmadeusActorSheet.#onItemRollCard,
      giftFormulaRoll: AmadeusActorSheet.#onGiftFormulaRoll,
      itemChk: AmadeusActorSheet.#onItemChk,
      rollTable: AmadeusActorSheet.#onRollTable,
      toggleMenu: AmadeusActorSheet.#onToggleMenu,
    },
  };

  static PARTS = {
    character: { template: "systems/amadeus/templates/actor/actor-character-sheet.html" },
    npc: { template: "systems/amadeus/templates/actor/actor-npc-sheet.html" },
  };

  /** 타입별 part 선택 */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    options.parts = [this.document.type];
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;

    context.config = CONFIG.AMADEUS;
    context.actor = actor;
    context.system = actor.system; // prepared(파생값 포함)
    context.flags = actor.flags;
    context.editable = this.isEditable;
    context.rollData = actor.getRollData();
    context.effects = prepareActiveEffectCategories(actor.effects);

    // 능력치 라벨
    if (actor.type === "character") {
      for (const [k, v] of Object.entries(context.system.ability)) {
        v.label = game.i18n.localize(CONFIG.AMADEUS.ability[k]) ?? k;
      }
    }

    // selectOptions용 라벨 맵(저장값 의미 보존: color=i18n키, rank/mod=letter)
    context.label = { color: {}, rank: {}, mod: {} };
    for (const v of Object.values(CONFIG.AMADEUS.color)) context.label.color[v] = game.i18n.localize(v);
    for (const letter of Object.keys(CONFIG.AMADEUS.rank)) context.label.rank[letter] = letter;
    for (const letter of Object.keys(CONFIG.AMADEUS.modL)) context.label.mod[letter] = letter;

    // biography 리치텍스트 enrich (features 탭의 prose-mirror 표시용)
    if (actor.type === "character") {
      const TextEditor = foundry.applications.ux.TextEditor.implementation;
      context.enrichedBiography = await TextEditor.enrichHTML(actor.system.biography ?? "", {
        secrets: actor.isOwner,
        rollData: context.rollData,
      });
    }

    // 아이템 분류
    this._prepareItems(context);

    return context;
  }

  /** 소유 아이템을 타입별 컨테이너로 분류 */
  _prepareItems(context) {
    const gifts = [], background = [], parent = [], inventory = [], memory = [], treasure = [];
    for (const i of this.document.items) {
      const img = i.img || CONST.DEFAULT_TOKEN;
      const entry = { _id: i.id, name: i.name, img, type: i.type, system: i.system, _stats: i._stats };
      if (i.type === "gift") gifts.push(entry);
      else if (i.type === "background") background.push(entry);
      else if (i.type === "parent") parent.push(entry);
      else if (i.type === "weapon" || i.type === "gear") inventory.push(entry);
      else if (i.type === "memory") memory.push(entry);
      else if (i.type === "treasure") treasure.push(entry);
    }
    gifts.sort((a, b) => a._stats.modifiedTime - b._stats.modifiedTime);
    inventory.sort((a, b) => a._stats.modifiedTime - b._stats.modifiedTime);
    memory.sort((a, b) => a._stats.createdTime - b._stats.createdTime);
    context.gifts = gifts;
    context.background = background;
    context.parent = parent;
    context.inventory = inventory;
    context.memory = memory;
    context.treasure = treasure;
  }

  /** 현재 활성 탭(렌더 간 유지) */
  #currentTab = "item";

  /** @override change 이벤트 위임 + 탭 활성화 */
  _onRender(context, options) {
    super._onRender(context, options);
    if (this.isEditable) {
      this.element.querySelectorAll(".gift-memo, .gift-formula").forEach((el) => {
        el.addEventListener("change", (ev) => this.#updateItemField(ev));
      });
    }
    this.#activateTabs();
  }

  /** 단일 part 내부 탭 전환(수동). part 분리 대신 display 토글로 처리한다. */
  #activateTabs() {
    const root = this.element;
    const navs = root.querySelectorAll("nav.sheet-tabs [data-tab]");
    const panes = root.querySelectorAll(".sheet-body .tab[data-tab]");
    if (!navs.length) return;
    const show = (name) => {
      this.#currentTab = name;
      navs.forEach((a) => a.classList.toggle("active", a.dataset.tab === name));
      // 활성 탭은 display를 명시한다. ""(inline 제거)로 두면 CSS의 `.tab{display:none}`이
      // 그대로 적용돼 콘텐츠가 보이지 않는다.
      panes.forEach((p) => {
        p.style.display = p.dataset.tab === name ? "block" : "none";
        p.classList.toggle("active", p.dataset.tab === name);
      });
    };
    navs.forEach((a) => a.addEventListener("click", (ev) => { ev.preventDefault(); show(a.dataset.tab); }));
    show(this.#currentTab);
  }

  /** change 핸들러: 아이템 필드(dataset.path) 업데이트 */
  #updateItemField(event) {
    const itemId = event.target.closest(".item")?.dataset.itemId;
    if (!itemId) return;
    const data = {};
    data[event.target.dataset.path] = event.target.value;
    this.document.items.get(itemId)?.update(data);
  }

  /** 부모신 드롭 시 능력치/속성을 액터에 복사 (그 외는 기본 동작) */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner) return false;
    if (item.type === "parent") {
      const existing = this.actor.items.filter((i) => i.type === "parent").map((i) => i.id);
      if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing);
      const updateData = {
        "system.chardata.parent": item.name,
        "system.color": item.system.color,
        "system.chardata.pantheon": item.system.pantheon,
        "system.chardata.parentkey": item.id,
        "system.chardata.parentimg": item.system.portrait,
      };
      for (const [key, abl] of Object.entries(item.system.ability)) {
        updateData[`system.ability.${key}.rank`] = abl.rank;
        updateData[`system.ability.${key}.mod`] = abl.mod;
      }
      await this.actor.update(updateData);
    }
    return super._onDropItem(event, item);
  }

  // ---------------------------------------------------------------------------
  //  Actions (static; this === sheet instance)
  // ---------------------------------------------------------------------------

  static #onItemEdit(event, target) {
    const itemId = target.closest(".item")?.dataset.itemId;
    this.document.items.get(itemId)?.sheet.render(true);
  }

  static async #onItemCreate(event, target) {
    const type = target.dataset.type;
    const data = foundry.utils.duplicate(target.dataset);
    delete data.action; // data-action은 시스템 데이터가 아니므로 제외
    const name = game.i18n.localize(CONFIG.AMADEUS.label[type]);
    const itemData = { name, type, system: data };
    delete itemData.system.type;
    return Item.create(itemData, { parent: this.document });
  }

  static async #onItemDelete(event, target) {
    const itemId = target.closest(".item")?.dataset.itemId;
    await this.document.items.get(itemId)?.delete();
    this.render(false);
  }

  static #onEffectControl(event) {
    onManageActiveEffect(event, this.document);
  }

  static #onRoll(event, target) {
    const dataset = target.dataset;
    if (dataset.rollType === "item") {
      const itemId = target.closest(".item")?.dataset.itemId;
      const item = this.document.items.get(itemId);
      if (item) return item.roll();
    }
    if (dataset.roll) {
      const label = dataset.label ? `[ability] ${dataset.label}` : "";
      return postRoll({ actor: this.document, formula: dataset.roll, flavor: label, rollData: this.document.getRollData() });
    }
  }

  static #onDamageRoll(event, target) {
    const dataset = target.dataset;
    if (dataset.rolltype !== "item" || !dataset.roll) return;
    const li = target.closest(".item");
    const itemId = li?.dataset.itemId;
    // 식량(food)은 액터 소유가 아닌 월드 아이템을 참조한다(itemDataCard와 동일 처리).
    const item = li?.dataset.special === "food" ? game.items.get(itemId) : this.document.items.get(itemId);
    return postRoll({ actor: this.document, formula: dataset.roll, flavor: item?.name, rollData: this.document.getRollData() });
  }

  static #onAblRoll(event, target) {
    this.document.rollAmadeAbl(target.dataset.ability, target.dataset.label, { event });
  }

  static #onVitalityRoll(event, target) {
    return this.document.rollVitality(target.dataset.roll, target.dataset.label ?? "");
  }

  static #onItemDataCard(event, target) {
    const li = target.closest(".item");
    const itemId = li?.dataset.itemId;
    if (li?.dataset.special === "food") {
      return game.items.get(itemId)?.getItemDataCard();
    }
    return this.document.items.get(itemId)?.getItemDataCard();
  }

  static #onItemRollCard(event, target) {
    const itemId = target.closest(".item")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    const abl = target.dataset.ability;
    if (!abl || abl === "notroll" || !item) return;
    const formatAbl = abl.substring(abl.lastIndexOf(".") + 1);
    return item.getItemRollCard(formatAbl);
  }

  static #onGiftFormulaRoll(event, target) {
    const itemId = target.closest(".item")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    const formula = target.previousElementSibling?.value;
    if (!formula) return;
    return postRoll({ actor: this.document, formula, flavor: item?.name, rollData: this.document.getRollData() });
  }

  static #onItemChk(event, target) {
    const itemId = target.closest(".item")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return;
    const data = {};
    data[target.dataset.path] = !item.system.chkbox;
    item.update(data);
  }

  static async #onRollTable(event, target) {
    const rtid = target.dataset.rtid;
    if (!rtid) return;
    const pack = game.packs.get("amadeus.rolltable");
    const tables = await pack.getDocuments();
    const table = tables.find((t) => t.id === rtid);
    table?.draw();
  }

  static #onToggleMenu(event, target) {
    // 접힌 영역(.*-hidden)을 토글한다. gift/inventory(.item·.gift-card)와
    // treasure/memory(.treasure-list·.memory-list)의 DOM 구조를 모두 처리한다.
    const root = target.closest(".item, .gift-card, .treasure-list, .memory-list");
    const hidden = root?.querySelector(".gift-hidden, .item-hidden, .treasure-hidden, .memory-hidden");
    if (!hidden) return;
    const visible = hidden.classList.toggle("content-visible");
    hidden.classList.toggle("content-hidden", !visible);
    hidden.style.display = visible ? "block" : "none";
  }
}
