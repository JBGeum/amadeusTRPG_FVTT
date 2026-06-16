# v13 마이그레이션 Phase 3b 구현 계획 (Actor 시트 ApplicationV2 전환)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Actor 시트를 AppV1(`foundry.appv1.sheets.ActorSheet`)에서 `HandlebarsApplicationMixin(ActorSheetV2)`로 전환한다. jQuery `activateListeners` 핸들러를 `actions`/`_onRender`로, 부모신 드롭을 `_onDropItem` 오버라이드로, `{{#select}}`를 `{{selectOptions}}`로, `{{editor}}`를 `<prose-mirror>`로 옮긴다.

**Architecture:** `ActorSheetV2`가 제공하는 자동 DragDrop(`data-item-id`) 위에, 클릭 핸들러는 `static DEFAULT_OPTIONS.actions`(요소의 `data-action`), 값 변경(change) 핸들러는 `_onRender`의 이벤트 위임으로 구현한다. 타입별 시트(character/npc)는 `_configureRenderOptions`로 part를 선택하고, 탭은 AppV2 tab 시스템을 사용한다. Phase 3a(Item 시트)에서 확립한 PARTS/`_prepareContext`/selectOptions/prose-mirror 패턴을 그대로 따른다.

**Tech Stack:** Foundry VTT v13, `foundry.applications.sheets.ActorSheetV2`, `foundry.applications.api.HandlebarsApplicationMixin`, Vite 8.

---

## 검증 방식 (공통)

각 Task는 `npm run build`(✓ built) + `npm run lint`(신규 에러 없음)로 정적 검증하고, 마지막 Task에서 v13 수동 시나리오로 확인한다(빌드된 `dist/` 배포 + Foundry 재시작).

## 클릭 핸들러 → action 매핑 표

기존 `activateListeners`의 jQuery 클릭 핸들러를 다음 action 키로 옮긴다. 템플릿에서 해당 요소에 `data-action="<키>"`를 부여한다(기존 클래스 선택자는 표시/스타일용으로 유지 가능).

| 기존 선택자 | action 키 | 기존 핸들러 로직 |
|------------|----------|----------------|
| `.item-edit` | `itemEdit` | item.sheet.render(true) |
| `.item-create` | `itemCreate` | Item.create (dataset.type) |
| `.item-delete` | `itemDelete` | item.delete + 행 제거 |
| `.effect-control` | `effectControl` | onManageActiveEffect |
| `.rollable` | `roll` | item.roll() / formula roll |
| `.damage-formula` | `damageRoll` | damage formula roll (**null guard 추가**) |
| `.amade-abl-roll` | `ablRoll` | actor.rollAmadeAbl |
| `.vitality-roll` | `vitalityRoll` | 활력 굴림 → health.max |
| `.item-datacard` | `itemDataCard` | item.getItemDataCard |
| `.item-rollcard` | `itemRollCard` | item.getItemRollCard |
| `.gift-formula-roll` | `giftFormulaRoll` | gift formula roll |
| `.item-chk` | `itemChk` | item chkbox 토글 |
| `.amd-rolltable` | `rollTable` | rolltable draw |
| `.open-gift`/`.open-item`/`.open-treasure`/`.open-memory` | `toggleMenu` | 접힌 메뉴 토글(jQuery→vanilla) |

**change 핸들러**(actions는 click 전용이므로 `_onRender`에서 처리): `.gift-memo`, `.gift-formula` → item 필드 업데이트.

## 파일 구조

| 파일 | 책임 | 변경 |
|------|------|------|
| `module/sheets/actor-sheet.mjs` | Actor 시트(AppV2) | 전면 재작성 |
| `module/amadeus.mjs` | 시트 등록 | 변경 없음(확인) |
| `templates/actor/actor-character-sheet.html` | character 시트 | form 제거, data-action, selectOptions, tabs |
| `templates/actor/actor-npc-sheet.html` | npc 시트 | form 제거, data-action |
| `templates/actor/parts/*.html` | 탭 파트 | data-action, draggable, selectOptions/prose-mirror |

---

## Task 1: actor-sheet.mjs를 ActorSheetV2로 재작성 (클래스 + actions)

**Files:**
- Modify: `module/sheets/actor-sheet.mjs` (전면 교체)

- [ ] **Step 1: AppV2 Actor 시트로 전면 재작성**

`module/sheets/actor-sheet.mjs` 전체를 다음으로 교체한다. 기존 핸들러 로직을 static action(`(event, target)`)으로 이전하며, `event.currentTarget`→`target`, `$(...)` jQuery→vanilla로 바꾼다.

```javascript
import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";

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

    // 아이템 분류
    if (actor.type === "character" || actor.type === "npc") this._prepareItems(context);

    return context;
  }

  /** 소유 아이템을 타입별 컨테이너로 분류 */
  _prepareItems(context) {
    const gifts = [], background = [], parent = [], inventory = [], memory = [], treasure = [];
    for (const i of this.document.items) {
      const img = i.img || CONST.DEFAULT_TOKEN;
      const entry = { id: i.id, name: i.name, img, type: i.type, system: i.system, _stats: i._stats };
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

  /** @override change 이벤트는 actions(click)로 안 잡히므로 여기서 위임한다. */
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;
    const root = this.element;
    root.querySelectorAll(".gift-memo, .gift-formula").forEach((el) => {
      el.addEventListener("change", (ev) => this.#updateItemField(ev));
    });
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
      await this.actor.update({
        "system.chardata.parent": item.name,
        "system.color": item.system.color,
        "system.chardata.pantheon": item.system.pantheon,
        "system.chardata.parentkey": item.id,
        "system.chardata.parentimg": item.system.portrait,
        "system.ability.warfare.rank": item.system.ability.warfare.rank,
        "system.ability.warfare.mod": item.system.ability.warfare.mod,
        "system.ability.technique.rank": item.system.ability.technique.rank,
        "system.ability.technique.mod": item.system.ability.technique.mod,
        "system.ability.brain.rank": item.system.ability.brain.rank,
        "system.ability.brain.mod": item.system.ability.brain.mod,
        "system.ability.spirit.rank": item.system.ability.spirit.rank,
        "system.ability.spirit.mod": item.system.ability.spirit.mod,
        "system.ability.love.rank": item.system.ability.love.rank,
        "system.ability.love.mod": item.system.ability.love.mod,
        "system.ability.mundane.rank": item.system.ability.mundane.rank,
        "system.ability.mundane.mod": item.system.ability.mundane.mod,
      });
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

  static #onEffectControl(event, target) {
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
      const roll = new Roll(dataset.roll, this.document.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        flavor: label,
        rollMode: game.settings.get("core", "rollMode"),
      });
      return roll;
    }
  }

  static #onDamageRoll(event, target) {
    const dataset = target.dataset;
    if (dataset.rolltype !== "item") return;
    const itemId = target.closest(".item")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return; // null guard (기존 버그 수정)
    const roll = new Roll(dataset.roll, this.document.getRollData());
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: item.name,
      rollMode: game.settings.get("core", "rollMode"),
    });
    return roll;
  }

  static #onAblRoll(event, target) {
    this.document.rollAmadeAbl(target.dataset.ability, target.dataset.label, { event });
  }

  static async #onVitalityRoll(event, target) {
    const label = target.dataset.label ?? "";
    const roll = new Roll(target.dataset.roll, this.document.getRollData());
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: label,
      rollMode: game.settings.get("core", "rollMode"),
    });
    const initHealth = this.document.system.initHealth ?? 0;
    await this.document.update({
      "system.vitality": roll.total,
      "system.health.max": initHealth + roll.total,
    });
    return roll;
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
    const roll = new Roll(formula, this.document.getRollData());
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: item?.name,
      rollMode: game.settings.get("core", "rollMode"),
    });
    return roll;
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
    // data-target 선택자(접힌 영역)를 토글한다.
    const hidden = target.closest(".item, .gift-card")?.querySelector(".gift-hidden, .item-hidden");
    if (!hidden) return;
    const visible = hidden.classList.toggle("content-visible");
    hidden.classList.toggle("content-hidden", !visible);
    hidden.style.display = visible ? "block" : "none";
  }
}
```

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `actor-sheet.mjs`에 에러 없음(미사용 import는 정리).

---

## Task 2: 탭(tabs) 구성 확인 및 적용

**Files:**
- Modify: `module/sheets/actor-sheet.mjs` (탭 설정 추가)
- Modify: `templates/actor/actor-character-sheet.html` (탭 마크업)

`HandlebarsApplicationMixin`의 탭은 v13에서 `static TABS` + `_prepareContext`의 `context.tabs` 또는 `this.tabGroups`로 다룬다. 정확한 v13 탭 API를 확인한 뒤 적용한다.

- [ ] **Step 1: v13 탭 API 확인**

`context7`로 `/websites/foundryvtt_wiki_en_development`에서 "HandlebarsApplicationMixin tabs TABS tabGroups changeTab v13"을 조회해 현재 코어 버전의 탭 구성 방식을 확인한다(`static TABS`, `_prepareContext`의 tabs 주입, `data-action="tab"` 등).

- [ ] **Step 2: 확인된 방식으로 탭 4종(item/gift/bond/features) 구성**

조회 결과에 맞춰 `actor-sheet.mjs`에 `static TABS`(또는 동등 구성)를 추가하고, `actor-character-sheet.html`의 `<nav class="sheet-tabs">`와 `.tab` 컨테이너를 AppV2 탭 규약(`data-tab`, `data-group`, 탭 전환 action)에 맞게 조정한다.

- [ ] **Step 3: build 검증**

Run: `npm run build`
Expected: `✓ built`.

---

## Task 3: actor-character-sheet.html 변환

**Files:**
- Modify: `templates/actor/actor-character-sheet.html`

- [ ] **Step 1: 공통 변환 적용**

1. 최상위 `<form class="{{cssClass}} ...">` 래퍼 **제거**(AppV2가 `tag:"form"` 자동 생성). 내부 콘텐츠만 남긴다.
2. **`{{#select}}` → `{{selectOptions}}`**:
   - `system.color`(헤더): `{{selectOptions label.color selected=system.color}}`
   - 능력치 `system.ability.{{key}}.rank`: `{{selectOptions ../label.rank selected=ability.rank}}`
   - 능력치 `system.ability.{{key}}.mod`: `{{selectOptions ../label.mod selected=ability.mod}}`
3. **`data-action` 부여**:
   - `.amade-abl-roll` span → `data-action="ablRoll"` (기존 `data-ability`/`data-label` 유지)
   - `.vitality-roll` a → `data-action="vitalityRoll"` (기존 `data-roll`/`data-label` 유지)
4. 생명력 표시(Phase 2에서 정한 동작)는 그대로 둔다: `health.value`는 placeholder 없음, `health.max` placeholder=`{{system.initHealth}}`.

- [ ] **Step 2: build 검증**

Run: `npm run build`
Expected: `✓ built`.

---

## Task 4: parts 템플릿 변환 (item/gift/bond/features)

**Files:**
- Modify: `templates/actor/parts/actor-item.html`
- Modify: `templates/actor/parts/actor-gift.html`
- Modify: `templates/actor/parts/actor-bond.html`
- Modify: `templates/actor/parts/actor-features.html`

- [ ] **Step 1: 각 part에 data-action / draggable / selectOptions·prose-mirror 적용**

각 파일에서 다음을 적용한다(없는 항목은 건너뜀):

1. 클릭 요소에 `data-action` 부여 (매핑 표 기준): `.item-edit`→`itemEdit`, `.item-create`→`itemCreate`, `.item-delete`→`itemDelete`, `.rollable`→`roll`, `.damage-formula`→`damageRoll`, `.item-datacard`→`itemDataCard`, `.item-rollcard`→`itemRollCard`, `.gift-formula-roll`→`giftFormulaRoll`, `.item-chk`→`itemChk`, `.amd-rolltable`→`rollTable`, `.open-*`→`toggleMenu`, `.effect-control`→`effectControl`.
2. 아이템 행 `li.item`(또는 `data-item-id` 보유 요소)에 **`draggable="true"`** 부여(ActorSheetV2 자동 DragDrop은 `.draggable`/`data-item-id` 기준 — 코어 기본 selector 확인 후 클래스 정렬).
3. `{{#select}}`가 있으면 `{{selectOptions}}`로, `{{editor}}`가 있으면 `<prose-mirror>`로 교체(Phase 3a와 동일 규칙; enriched 값은 필요 시 `_prepareContext`에 추가).
4. `{{data._id}}` → `{{actor._id}}` 또는 아이템 컨텍스트에 맞는 id로 정정.

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. 잔존 `{{#select}}`/`{{editor}}`가 character 경로에 없는지 grep 확인.

---

## Task 5: actor-npc-sheet.html 변환

**Files:**
- Modify: `templates/actor/actor-npc-sheet.html`

- [ ] **Step 1: form 제거 + data-action 적용**

최상위 `<form>` 래퍼 제거, NPC 시트의 클릭 요소에 매핑 표 기준 `data-action` 부여, 아이템 행에 `draggable="true"` 부여. NPC는 능력치/생명력 UI가 단순하므로 `{{#select}}`가 있으면 selectOptions로 교체한다.

- [ ] **Step 2: build 검증**

Run: `npm run build`
Expected: `✓ built`.

---

## Task 6: v13 수동 검증 및 Phase 3b 커밋

**Files:** (검증 및 커밋)

- [ ] **Step 1: 빌드**

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 2: v13 수동 시나리오 (Foundry 재시작 후)**

빌드된 `dist/`를 배포하고 Foundry 재시작 후:

1. 콘솔에 AppV2/시트 오류 없음, V1 Application deprecation 경고 사라짐
2. **캐릭터/NPC 시트 정상 표시**, 탭 4종(item/gift/bond/features) 전환 동작
3. **능력치 굴림**(amade-abl-roll), **활력 굴림**(health.max 자동입력), **기프트/아이템 굴림·챗카드**
4. **아이템 생성/삭제/편집**, 체크박스 토글, 메모/수식 change 저장
5. **부모신(parent) 드롭** → 기존 parent 삭제 + 능력치/속성 복사
6. **드래그&드롭/정렬**, rolltable draw
7. `{{#select}}` deprecation 경고 사라짐
8. **`_onDamageRoll`가 item 없을 때 오류 없이 무시**(기존 null 버그 수정 확인)

문제 발견 시 해당 Task로 돌아가 수정 후 재검증한다.

- [ ] **Step 3: Phase 3b 커밋**

```bash
git add module/sheets/actor-sheet.mjs templates/actor/
git commit -m "refactor: convert actor sheet to ApplicationV2"
```

> 커밋 메시지는 Conventional Commits 접두어 + 한 줄 영어 요약, co-author·세부나열 없음.

---

## Self-Review (작성자 체크 결과)

- **Spec 커버리지**: spec Phase 3의 Actor 시트 부분 — ActorSheetV2 전환(Task 1), getData→`_prepareContext`(Task 1), activateListeners→actions/`_onRender`(Task 1), 부모신 DragDrop `_onDropItem`(Task 1), 탭(Task 2), `{{#select}}`→selectOptions(Task 3·4·5), `{{editor}}`→prose-mirror(Task 4), `_onDamageRoll` null guard(Task 1 `#onDamageRoll`) 대응.
- **Placeholder**: 시트 클래스(actions 13개 + `_onDropItem` + `_prepareItems` + `_prepareContext` + `_onRender`)는 완전 코드. 템플릿은 `data-action` 매핑 표 + 변환 규칙으로 구체화(각 요소 명시). 탭은 v13 API 확인 후 적용(Phase 3a editor와 동일 방식, 막연한 TODO 아님).
- **타입 일관성**: action 키(itemEdit/itemCreate/.../toggleMenu)가 DEFAULT_OPTIONS.actions 정의 ↔ Task 3·4·5의 `data-action` 매핑 표에서 일치. `this.document`(=actor), `target.closest(".item").dataset.itemId` 패턴이 모든 핸들러에서 일관. `label.color/rank/mod`가 Task 1 정의와 Task 3 템플릿 사용에서 일치.
- **알려진 범위 외**: `feature`/`spell`/`item-sheet.html` 레거시 템플릿(Phase 3a에서 제외)은 본 Phase에서도 다루지 않는다.
