# v13 마이그레이션 Phase 3a 구현 계획 (Item 시트 ApplicationV2 전환)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Item 시트를 AppV1(`foundry.appv1.sheets.ItemSheet`)에서 ApplicationV2(`HandlebarsApplicationMixin(DocumentSheetV2)`)로 전환하고, 템플릿의 `{{#select}}`를 `{{selectOptions}}`로 교체한다.

**Architecture:** `DocumentSheetV2` + `HandlebarsApplicationMixin`을 쓰고, 아이템 타입별 다른 템플릿은 `static PARTS`에 전부 등록한 뒤 `_configureRenderOptions`에서 `options.parts = [this.document.type]`로 현재 타입만 렌더한다. form 자동 제출(`submitOnChange`)로 기존 jQuery 없는 편집을 대체한다. 이 단계로 단순한 Item 시트에서 AppV2 패턴을 확립해 Phase 3b(Actor 시트)의 토대를 만든다.

**Tech Stack:** Foundry VTT v13, `foundry.applications.api.HandlebarsApplicationMixin`, `foundry.applications.sheets.DocumentSheetV2`, Vite 8.

---

## 검증 방식 (공통)

각 Task는 `npm run build`(✓ built) + `npm run lint`(신규 에러 없음)로 정적 검증하고, 마지막 Task에서 v13 수동 시나리오로 확인한다(빌드된 `dist/`를 서버에 배포 + Foundry 재시작).

## 파일 구조

| 파일 | 책임 | 변경 |
|------|------|------|
| `module/sheets/item-sheet.mjs` | Item 시트(AppV2) | 전면 재작성 |
| `module/amadeus.mjs` | 시트 등록 | 변경 없음(기존 `registerSheet` 호출이 AppV2 클래스에도 동작) — 확인만 |
| `templates/item/item-background-sheet.html` | background 타입 시트 | 신규(현재 부재) |
| `templates/item/item-{gift,weapon,gear,parent,memory,treasure}-sheet.html` | 각 타입 시트 | `<form>` 래퍼 제거 + `{{#select}}`→`{{selectOptions}}` |

> `feature`/`spell` 템플릿은 현재 Item 타입에 없는 레거시이므로 이 Phase에서는 건드리지 않는다(Phase 3b 또는 별도 정리).

---

## Task 1: item-sheet.mjs를 DocumentSheetV2로 재작성

**Files:**
- Modify: `module/sheets/item-sheet.mjs` (전면 교체)

- [ ] **Step 1: AppV2 Item 시트로 전면 재작성**

`module/sheets/item-sheet.mjs` 전체를 다음으로 교체한다.

```javascript
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { DocumentSheetV2 } = foundry.applications.sheets;

/**
 * Amadeus Item 시트 (ApplicationV2).
 * 아이템 타입별 템플릿은 PARTS에 모두 등록하고 _configureRenderOptions에서 현재 타입만 렌더한다.
 * @extends {DocumentSheetV2}
 */
export class AmadeusItemSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
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

    // selectOptions용 라벨 맵: { 값: 현지화라벨 }
    context.label = { abl: {}, type: {} };
    for (const v of Object.values(CONFIG.AMADEUS.ability)) {
      context.label.abl[v] = game.i18n.localize(v);
    }
    for (const v of Object.values(CONFIG.AMADEUS.gift)) {
      context.label.type[v] = game.i18n.localize(v);
    }

    return context;
  }
}
```

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `item-sheet.mjs`에 에러 없음.

---

## Task 2: 시트 등록 확인 (amadeus.mjs)

**Files:**
- Verify: `module/amadeus.mjs`

- [ ] **Step 1: 등록 코드가 AppV2 클래스에도 유효한지 확인**

`module/amadeus.mjs`의 다음 줄(Phase 1에서 네임스페이스화됨)이 그대로 AppV2 `AmadeusItemSheet`에도 동작한다. 변경 불필요.

```javascript
foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
foundry.documents.collections.Items.registerSheet("amadeus", AmadeusItemSheet, { makeDefault: true });
```

- [ ] **Step 2: build 확인**

Run: `npm run build`
Expected: `✓ built`.

---

## Task 3: background 타입 템플릿 신규 생성

**Files:**
- Create: `templates/item/item-background-sheet.html`

`background` 타입은 템플릿이 없어 시트 렌더가 실패한다. DataModel `BackgroundData`(`type`, `modSet`)에 맞춘 최소 시트를 만든다. AppV2이므로 `<form>` 래퍼 없이 내용만 둔다(`tag:"form"`이 자동 생성).

- [ ] **Step 1: item-background-sheet.html 작성**

```html
<div class="background-sheet">
  <div class="sheet-header">
    <input name="name" type="text" value="{{item.name}}" placeholder="Name"/>
  </div>
  <div class="sheet-body">
    <div class="background-type">
      <label>분류</label>
      <select name="system.type">
        {{selectOptions config.background selected=system.type localize=true}}
      </select>
    </div>
  </div>
</div>
```

- [ ] **Step 2: build 확인**

Run: `npm run build`
Expected: `✓ built`. `dist/templates/item/item-background-sheet.html` 생성됨.

---

## Task 4: 기존 item 템플릿 AppV2 변환 (form 래퍼 제거 + selectOptions)

**Files:**
- Modify: `templates/item/item-gift-sheet.html`
- Modify: `templates/item/item-gear-sheet.html`
- Modify: `templates/item/item-weapon-sheet.html`
- Modify: `templates/item/item-parent-sheet.html`
- Modify: `templates/item/item-memory-sheet.html`
- Modify: `templates/item/item-treasure-sheet.html`

**공통 변환 규칙** (각 파일에 적용):

1. **최상위 `<form ...>`/`</form>` 래퍼 제거** — AppV2가 `tag:"form"`으로 자동 생성하므로 내부 콘텐츠만 남긴다.
2. **`{{#select X}} … {{/select}}` 블록 → `{{selectOptions obj selected=X}}`** — `obj`는 `{값: 라벨}` 맵.
3. **`{{editor ...}}` 헬퍼**: v13에서 ProseMirror 기반으로 바뀌었다. Task 4 작업 시 `context7`로 `/websites/foundryvtt_wiki_en_development`에서 "prosemirror handlebars helper editor v13"을 조회해 정확한 헬퍼(`{{prosemirror}}` 또는 `{{editor}}` 갱신형)를 확인한 뒤 적용한다.

- [ ] **Step 1: item-gift-sheet.html 변환 (대표 예시)**

`<form class="{{cssClass}}" autocomplete="off">` 래퍼를 제거하고, 두 개의 `{{#select}}` 블록을 `selectOptions`로 교체한다. 변환 후:

```html
<div class="gift-sheet">
  <div class="sheet-header">
    <div class="item grid gift-sheet-header" data-item-id="{{item._id}}">
      <div class="gift-sheet-name flex-center">
        <input name="name" type="text" value="{{item.name}}" placeholder="Name"/>
        <div class="gift-sheet-chkbox {{#if item.isOwned}}content-visible{{else}}content-hidden{{/if}}">
          <input type="checkbox" name="system.chkbox" {{#if system.chkbox}} checked {{/if}}>
        </div>
      </div>
      <div class="gift-sheet-type">
        <label class="gift-lbl">분류</label>
        <select name="system.type">
          {{selectOptions label.type selected=system.type}}
        </select>
      </div>
      <div class="gift-requirement">
        <label class="gift-lbl">조건</label>
        <input type="text" name="system.requirement" value="{{system.requirement}}"/>
      </div>
      <div class="gift-roll">
        <label class="gift-lbl">기능</label>
        <select name="system.action.roll">
          {{selectOptions label.abl selected=system.action.roll blank=" - "}}
        </select>
      </div>
    </div>
  </div>

  <div class="sheet-body">
    <div class="item gift-sheet-body" data-item-id="{{item._id}}">
      <div class="gift-effect" title="효과">
        {{editor system.effect target="system.effect" button=true editable=editable}}
      </div>
      <div class="gift-description" title="설명">
        {{editor system.description target="system.description" button=true editable=editable}}
      </div>
      <div class="gift-tag">
        <label class="gift-lbl">태그</label>
        <input type="text" name="system.tag" value="{{system.tag}}"/>
      </div>
      {{#if item.isOwned}}
      <div class="gift-formula">{{!-- 수식 --}}
        <label>수식</label>
        <input type="text" name="system.formula" value="{{system.formula}}">
      </div>
      <div class="gift-memo">
        <label>메모</label>{{!-- 마지막줄:메모 --}}
        <input type="text" name="system.memo" value="{{system.memo}}"/>
      </div>
      {{/if}}
    </div>
  </div>
</div>
```

> 참고: 기존 `{{data._id}}`는 `{{item._id}}`로, `{{gift.system.formula}}`는 `{{system.formula}}`로 바로잡았다(이전 컨텍스트 변수명 오류).

- [ ] **Step 2: 나머지 5개 템플릿(gear/weapon/parent/memory/treasure)에 공통 규칙 적용**

각 파일에서 ① 최상위 `<form>` 래퍼 제거, ② 모든 `{{#select X}}…{{/select}}`를 `{{selectOptions obj selected=X}}`로 교체, ③ `{{editor}}`는 Step 0의 v13 헬퍼 확인 결과를 적용한다. `item-gear-sheet.html`의 `system.type` select가 대표적 교체 대상이다.

- [ ] **Step 3: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. 템플릿이 `dist/`에 복사됨.

---

## Task 5: v13 수동 검증 및 Phase 3a 커밋

**Files:** (검증 및 커밋)

- [ ] **Step 1: 빌드**

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 2: v13 수동 시나리오 (Foundry 재시작 후)**

빌드된 `dist/`를 서버 `systems/amadeus`로 배포하고 Foundry 재시작 후:

1. 콘솔에 AppV2/시트 관련 오류 없음
2. **아이템 7종(gift/background/parent/weapon/gear/memory/treasure) 시트가 각각 정상적으로 열림**
3. 이름/체크박스/텍스트 input 수정 시 **자동 저장**(submitOnChange) 반영
4. **`{{selectOptions}}`로 바꾼 드롭다운(기프트 분류/기능, 기어 타입, 배경 분류)이 정상 표시·저장됨**
5. effect/description 에디터(gift 등)가 정상 동작
6. `{{#select}}` 관련 deprecation 경고가 사라짐

문제 발견 시 해당 Task로 돌아가 수정 후 재검증한다.

- [ ] **Step 3: Phase 3a 커밋**

```bash
git add module/sheets/item-sheet.mjs templates/item/
git commit -m "refactor: convert item sheet to ApplicationV2"
```

> 커밋 메시지는 Conventional Commits 접두어 + 한 줄 영어 요약, co-author·세부나열 없음.

---

## Self-Review (작성자 체크 결과)

- **Spec 커버리지**: spec Phase 3 항목 중 Item 시트 부분 — DocumentSheetV2 전환(Task 1), `_prepareContext`(Task 1), 시트 등록(Task 2), `{{#select}}`→`selectOptions`(Task 3·4), 템플릿 form 구조(Task 4) 대응. Actor 시트·`_onDamageRoll`은 Phase 3b로 명시 분리.
- **Placeholder**: `{{editor}}`의 v13 헬퍼는 Task 4 Step에서 context7 조회 후 적용하도록 구체적 지시(막연한 TODO 아님). 나머지 코드 step은 완전 코드.
- **타입 일관성**: 클래스 `AmadeusItemSheet`, PARTS 키(타입명) ↔ `_configureRenderOptions`의 `this.document.type` ↔ DataModel/template.json 타입(gift/background/parent/weapon/gear/memory/treasure)이 일치. `context.label.type`/`label.abl`이 Task 1 정의와 Task 4 템플릿 사용에서 일관.
- **알려진 정리**: `background` 템플릿 신규(Task 3), `feature`/`spell` 레거시 템플릿은 범위 외 명시.
