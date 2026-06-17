# 디자인 리뉴얼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시안(`docs/design/*.dc.html`) 기반으로 캐릭터 시트·이니셔티브·챗카드를 풀 구현하고, SCSS를 런타임 CSS 변수 토큰 시스템으로 전환한다.

**Architecture:** 토큰 레이어(CSS 커스텀 프로퍼티로 팔레트 정의) → 컴포넌트 레이어(색은 `var()`만 참조) → 배선 레이어(템플릿 DOM 시안 구조 재작성 + `data-skin`/`data-theme` 주입 + 테마 토글). 시트는 `[data-skin][data-theme]`(10팔레트), 다이얼로그는 `[data-theme]`(중립 골드), 챗카드는 양피지 고정.

**Tech Stack:** Foundry VTT v13 ApplicationV2(HandlebarsApplicationMixin), Vite, Dart Sass(`@import` 기반, 경고 억제됨), Handlebars, Vitest.

---

## 사전 사실(구현 전 숙지)

- **`system.color` 값 = 시안 `data-skin` 값** 그대로다: `black`/`red`/`blue`/`green`/`white`. 변환 함수 불필요. 빈 문자열(부모신 미설정)일 때만 `"red"` fallback.
- **속성 한자**는 `lang/ko.json`의 `AMADEUS.color.{black:흑,red:적,blue:청,green:녹,white:백}` — 템플릿에서 `{{localize (lookup config.color system.color)}}` 또는 컨텍스트에 미리 넣어 표시. 별도 매핑 코드 없음.
- **NPC에는 `color` 필드 없음**(`module/data/actor-npc.mjs`) → NPC 시트는 `data-skin` 미적용(중립). 깨짐 방지 토큰만.
- 시트 클래스는 `module/sheets/actor-sheet.mjs`의 `AmadeusActorSheet extends HandlebarsApplicationMixin(ActorSheetV2)`, `PARTS`로 타입별 템플릿. `_prepareContext`에 `context.config = CONFIG.AMADEUS`, `context.system`(파생 포함) 존재.
- 이니셔티브 다이얼로그/GM패널은 `module/initiative/`(`gm-panel.mjs`/`plot-prompt.mjs`)에서 AppV2로 렌더. 챗카드는 `module/chat/chat.mjs`의 `postRoll`/`postCard`가 템플릿 렌더 후 `ChatMessage.create`.
- **기능 바인딩 보존이 최우선**: `data-action`, `data-ability`, `data-item-id`(=`_id`), `data-tab`/`data-group`, 모든 `name="system.*"`. DOM을 바꿔도 이 속성들은 동일하게 유지.
- 빌드: `npm run build`. 린트: `npm run lint`(0 errors 유지). 디자인 확인은 Foundry 수동(F12) — **추측 금지, 실제 AppV2 렌더 DOM 확인 후 셀렉터 확정**.
- 이미지 참조는 런타임 절대경로 `/systems/amadeus/icons/...`.

---

## File Structure

**신설:**
- `scss/utils/_tokens.scss` — 팔레트 토큰(시트 10팔레트 + 다이얼로그 2 + 챗카드 고정 + die-face). 색은 여기서만 관리.
- `scss/components/_sheet-actor.scss` — 캐릭터 시트(헤더/능력/인장/상태/탭/MEMO).
- `scss/components/_dialog.scss` — 이니셔티브 GM패널·플레이어 프롬프트.

**대폭 수정:**
- `scss/amadeus.scss` — 진입점, 폰트 import, 토큰/컴포넌트 import 순서 재정비, AppV1 셀렉터 제거.
- `scss/utils/_typography.scss` — 시안 폰트 변수.
- `scss/global/_window.scss` — AppV2 DOM(`.application`/`.window-content` div) 대응.
- `scss/components/_chatcard.scss` — 시안 양피지+굴림 카드.
- `templates/actor/actor-character-sheet.html` — 시안 DOM 재작성.
- `templates/initiative/gm-panel.html`, `templates/initiative/plot-prompt.html` — 시안 DOM 재작성.
- `templates/chatcard/data-gift.html`, `data-item.html`, `data-description.html`, `roll-amadeabl.html`, `roll-gift.html`, `plot-done.html`, `plot-result.html` — 시안 DOM 재작성.
- `module/amadeus.mjs` — `init`에 테마 설정 등록.
- `module/sheets/actor-sheet.mjs` — `_onRender`에 `data-skin`/`data-theme`, `_getHeaderControls`에 테마 토글.
- `module/initiative/gm-panel.mjs`, `module/initiative/plot-prompt.mjs` — `_onRender`에 `data-theme`.

**소폭 수정:**
- `scss/components/_forms.scss`, `_items.scss`, `_effects.scss`, `_resource.scss` — 하드코딩 색 → 토큰 참조.
- `scss/utils/_colors.scss` — `_tokens`로 흡수 후 제거 또는 die-face만 잔존.
- `scss/global/_grid.scss`, `_flex.scss` — 필요한 소폭 조정만.

---

## Task 1: SCSS 토큰 레이어 + 폰트 + 진입점

**Files:**
- Create: `scss/utils/_tokens.scss`
- Modify: `scss/utils/_typography.scss`, `scss/amadeus.scss`

- [ ] **Step 1: `_tokens.scss` 작성 (시안 값 그대로 이식)**

`scss/utils/_tokens.scss` 생성. 액터 시트 시안(`docs/design/아마데우스 액터 시트.dc.html` 26~41행)·이니셔티브 시안(`아마데우스 이니셔티브.dc.html` 19~24행)·챗카드 시안(20행)의 값을 그대로 옮긴다:

```scss
// ===== die-face colours (rule): 1黑 2赤 3靑 4綠 5白 6黃 =====
:root { --d1:#23262e; --d2:#cf4339; --d3:#3a7fc4; --d4:#36a065; --d5:#ece7da; --d6:#e0b24a; }

// ===== status wheel quadrants (fixed across attributes) =====
:root,[data-theme="dark"]{ --wr:#cf4339; --wb:#3a7fc4; --wg:#36a065; --ww:#e9e2d0; --wk:#15171e; --wy:#e0b24a; }
[data-theme="light"]{ --wr:#c23a30; --wb:#2d6fb2; --wg:#2f8b55; --ww:#f2ecdd; --wk:#1a1d24; --wy:#c79328; }

// ===== sheet palette: data-skin × data-theme (fallback 적·dark for first paint) =====
.amadeus.sheet{ --bg:#15110d; --panel:#231712; --panel2:#2c1d16; --text:#f0e3da; --muted:#b09387; --line:rgba(200,110,90,.24); --gold:#d2705f; --acc:#c8705f; --seal:#3a1512; --sealtx:#f3d9cf; }

// 적
[data-theme="dark"] .amadeus.sheet[data-skin="red"]{ --bg:#15110d; --panel:#231712; --panel2:#2c1d16; --text:#f0e3da; --muted:#b09387; --line:rgba(200,110,90,.24); --gold:#d2705f; --acc:#c8705f; --seal:#3a1512; --sealtx:#f3d9cf; }
[data-theme="light"] .amadeus.sheet[data-skin="red"]{ --bg:#f5ece7; --panel:#ffffff; --panel2:#f6e9e2; --text:#3a1c14; --muted:#8a6a5e; --line:rgba(170,80,60,.26); --gold:#b23a2f; --acc:#a8412f; --seal:#7a2018; --sealtx:#f3d9cf; }
// 청
[data-theme="dark"] .amadeus.sheet[data-skin="blue"]{ --bg:#0f1626; --panel:#172033; --panel2:#1e2a42; --text:#dde6f2; --muted:#8a98b2; --line:rgba(110,150,210,.24); --gold:#5e9bd6; --acc:#6fa3d8; --seal:#0e1d33; --sealtx:#d3e3f5; }
[data-theme="light"] .amadeus.sheet[data-skin="blue"]{ --bg:#eaf1f9; --panel:#ffffff; --panel2:#e7eef8; --text:#16243a; --muted:#647189; --line:rgba(60,110,180,.24); --gold:#2f6cb0; --acc:#2f6cb0; --seal:#143352; --sealtx:#d3e3f5; }
// 녹
[data-theme="dark"] .amadeus.sheet[data-skin="green"]{ --bg:#0f1812; --panel:#16221a; --panel2:#1d2c22; --text:#dceadf; --muted:#8aa593; --line:rgba(90,170,120,.24); --gold:#54b078; --acc:#5fb07f; --seal:#0d2417; --sealtx:#d2ecdb; }
[data-theme="light"] .amadeus.sheet[data-skin="green"]{ --bg:#e9f1ea; --panel:#ffffff; --panel2:#e4efe7; --text:#13291b; --muted:#5e7a66; --line:rgba(50,140,85,.26); --gold:#2f8551; --acc:#2f8551; --seal:#103a22; --sealtx:#d2ecdb; }
// 백
[data-theme="dark"] .amadeus.sheet[data-skin="white"]{ --bg:#16171a; --panel:#202227; --panel2:#282b31; --text:#eef0f4; --muted:#9aa0ac; --line:rgba(200,205,215,.20); --gold:#cfd4de; --acc:#c4cad6; --seal:#2a2d34; --sealtx:#f4f6fa; }
[data-theme="light"] .amadeus.sheet[data-skin="white"]{ --bg:#f3f3f1; --panel:#ffffff; --panel2:#ededeb; --text:#23252b; --muted:#787e8a; --line:rgba(80,85,95,.20); --gold:#6c7280; --acc:#6c7280; --seal:#3a3d45; --sealtx:#f4f6fa; }
// 흑
[data-theme="dark"] .amadeus.sheet[data-skin="black"]{ --bg:#0e0f13; --panel:#16181e; --panel2:#1c1f27; --text:#ece6d6; --muted:#8b8a82; --line:rgba(180,150,90,.20); --gold:#c9a44e; --acc:#c9a44e; --seal:#0a0b0e; --sealtx:#f0e6cf; }
[data-theme="light"] .amadeus.sheet[data-skin="black"]{ --bg:#f3efe6; --panel:#ffffff; --panel2:#efe9da; --text:#1d1812; --muted:#6c6456; --line:rgba(120,95,40,.24); --gold:#9a7a2e; --acc:#9a7a2e; --seal:#15140f; --sealtx:#f0e6cf; }

// ===== dialog palette (neutral ink + gold), theme-switched =====
[data-theme="dark"] .amadeus-dlg{ --bg:#16151b; --panel:#201f28; --panel2:#272631; --text:#ece6d6; --muted:#9a958a; --line:rgba(180,150,90,.22); --gold:#c9a44e; --bar:#100f14; }
[data-theme="light"] .amadeus-dlg{ --bg:#f3efe6; --panel:#ffffff; --panel2:#efe9da; --text:#241d12; --muted:#7c715c; --line:rgba(120,95,40,.24); --gold:#9a7a2e; --bar:#e7dfcc; }

// ===== chat parchment (fixed, theme-independent) =====
.amadeus-chat{ --pg:#e8e2d3; --pg2:#dcd5c1; --pgline:#cbc3ad; --pgline2:#bcb39a; --ptext:#34301f; --pmuted:#6a6450; --pbody:#46412f; --pgold:#9a7a3a; }
.lnum{ font-variant-numeric:lining-nums; font-feature-settings:'lnum' 1; }
```

- [ ] **Step 2: `_typography.scss` 폰트 변수 교체**

`scss/utils/_typography.scss` 전체 교체:

```scss
$font-display: 'Cormorant Garamond', serif;  // 숫자/라틴
$font-title: 'Gowun Batang', serif;          // 제목
$font-body: 'Noto Serif KR', serif;          // 본문
```

- [ ] **Step 3: `amadeus.scss` 진입점 재정비**

`scss/amadeus.scss`에서 기존 폰트 `@import url(Roboto)`/`@font-face`(RIDIBatang/GyeonggiBatang) 블록을 시안 폰트 import로 교체하고, `utils/tokens`를 추가, AppV1 셀렉터 블록(`.sheet.actor section.window-content{...}`)은 제거(Task 2에서 `_window.scss`로 이관). 상단을 다음으로 교체:

```scss
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Gowun+Batang:wght@400;700&family=Noto+Serif+KR:wght@300;400;500;600;700&display=swap');

// Utilities
@import 'utils/typography';
@import 'utils/tokens';
@import 'utils/variables';
@import 'utils/mixins';

// Global
@import 'global/window';
@import 'global/grid';
@import 'global/flex';

// Components
.amadeus {
  @import 'components/sheet-actor';
  @import 'components/forms';
  @import 'components/items';
  @import 'components/effects';
}
@import 'components/dialog';
@import 'components/chatcard';
```

`@import 'utils/colors'` 줄은 제거하고, `_colors.scss`의 die-face는 `_tokens.scss`로 이미 옮겼으므로 Task 8에서 `_colors.scss`를 삭제한다. (지금 삭제하면 `_window`/`_forms`가 아직 `$color-*`를 참조해 빌드 실패하므로, 참조 제거 후 Task 8에서 삭제.)

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: 성공(`dist/amadeus.css` 생성). 폰트/토큰 추가로 인한 SCSS 에러 없음. (이 시점에 기존 컴포넌트가 아직 `$color-*` 참조 중이면 `_colors.scss` import를 유지한 채로 진행하고, 참조를 토큰으로 바꾸는 Task에서 제거. 빌드가 `$color-bg` 미정의로 실패하면 `_colors.scss` import를 임시 유지.)

- [ ] **Step 5: 커밋**

```bash
git add scss/utils/_tokens.scss scss/utils/_typography.scss scss/amadeus.scss
git commit -m "style: add CSS variable token layer and renewal fonts"
```

---

## Task 2: global/_window.scss — AppV2 DOM 대응

**Files:**
- Modify: `scss/global/_window.scss`

- [ ] **Step 1: 실제 AppV2 DOM 확인**

Foundry에서 캐릭터 시트를 열고 F12로 렌더 DOM을 확인한다. 확인할 것: 최상위 `.application.amadeus.sheet.actor`, 그 안 `.window-content`(div), 자동 생성 `<form>` 유무, 헤더 `.window-header`. **여기서 본 실제 클래스/구조로 셀렉터를 작성**한다(아래는 v13 표준 가정값이며 실제와 다르면 실제를 따른다).

- [ ] **Step 2: `_window.scss` 재작성**

`scss/global/_window.scss`를 AppV2 구조 + 토큰 기반으로 작성. 기존 `.window-app`(AppV1) 셀렉터 제거. 시트 배경/입력 기본 스타일을 토큰으로:

```scss
.amadeus.sheet {
  .window-content {
    background: var(--bg);
    color: var(--text);
    font-family: $font-body;
  }
  input, select, textarea {
    background: var(--panel2);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 6px;
    font-family: $font-body;
  }
  input::placeholder { color: var(--muted); font-style: italic; opacity: .7; }
}
```

기존 `amadeus.scss`에 있던 배경 이미지(`/systems/amadeus/icons/amade-bg-*.png`)는 시안에 없다(시안은 SVG 문양 + 그라데이션). 시안 충실도를 위해 배경 이미지는 제거하고, 시트 카드 장식은 `_sheet-actor.scss`에서 처리한다.

- [ ] **Step 3: 빌드 + 수동 확인**

Run: `npm run build`
Expected: 성공. Foundry 새로고침 후 시트 배경이 토큰 색(적·dark 기본)으로 적용, Foundry 기본 흰 배경이 사라짐.

- [ ] **Step 4: 커밋**

```bash
git add scss/global/_window.scss scss/amadeus.scss
git commit -m "style: rewrite window styles for ApplicationV2 DOM"
```

---

## Task 3: 테마 설정 + 토글 배선 (JS)

**Files:**
- Modify: `module/amadeus.mjs`(init 훅), `module/sheets/actor-sheet.mjs`

- [ ] **Step 1: 테마 설정 등록**

`module/amadeus.mjs`의 `init` 훅 안(다른 `game.settings.register`나 DataModel 등록부 근처)에 추가:

```js
game.settings.register("amadeus", "theme", {
  scope: "client",
  config: false,
  type: String,
  default: "dark",
});
```

- [ ] **Step 2: 시트 `_onRender`에 data-skin/data-theme 주입**

`module/sheets/actor-sheet.mjs`의 `AmadeusActorSheet`에 `_onRender` 추가(이미 있으면 본문에 합침). `this.element`는 AppV2 프레임 루트(`.application`):

```js
/** @override */
async _onRender(context, options) {
  await super._onRender(context, options);
  if (this.document.type === "character") {
    this.element.dataset.skin = this.document.system.color || "red";
  }
  this.element.dataset.theme = game.settings.get("amadeus", "theme");
}
```

- [ ] **Step 3: 헤더 토글 버튼**

`module/sheets/actor-sheet.mjs`에 `_getHeaderControls` 오버라이드 추가(AppV2 헤더 컨트롤 API). **이 메서드명/시그니처는 v13에서 확인 필요** — F12나 `foundry.applications.api.ApplicationV2` 소스로 교차 확인. 표준 형태:

```js
/** @override */
_getHeaderControls() {
  const controls = super._getHeaderControls();
  const isDark = game.settings.get("amadeus", "theme") === "dark";
  controls.unshift({
    icon: isDark ? "fa-solid fa-sun" : "fa-solid fa-moon",
    label: isDark ? "AMADEUS.theme.light" : "AMADEUS.theme.dark",
    action: "toggleTheme",
  });
  return controls;
}
```

`DEFAULT_OPTIONS.actions`에 `toggleTheme: AmadeusActorSheet.#onToggleTheme` 추가하고 정적 메서드 구현:

```js
static async #onToggleTheme() {
  const next = game.settings.get("amadeus", "theme") === "dark" ? "light" : "dark";
  await game.settings.set("amadeus", "theme", next);
  for (const app of foundry.applications.instances.values()) {
    if (app.element?.classList?.contains("amadeus") || app.element?.classList?.contains("amadeus-dlg")) {
      app.element.dataset.theme = next;
    }
    if (typeof app.render === "function" && app.element?.classList?.contains("amadeus")) {
      app.render(); // 헤더 아이콘 갱신용
    }
  }
}
```

(전역 반영 로직은 `foundry.applications.instances` 순회로 열린 앱의 `dataset.theme`만 바꿔 CSS 변수 즉시 전환. 헤더 아이콘 갱신을 위해 시트는 가볍게 re-render.)

- [ ] **Step 4: i18n 키 추가**

`lang/ko.json`의 `AMADEUS` 객체에 추가:

```json
"theme": { "light": "라이트", "dark": "다크" }
```

- [ ] **Step 5: 린트 + 수동 확인**

Run: `npm run lint`
Expected: 0 errors(기존 2 warnings 외 신규 없음).
Foundry: 시트 헤더에 해/달 토글 버튼 표시, 클릭 시 라이트↔다크 즉시 전환, `system.color` 변경 시 팔레트 전환.

- [ ] **Step 6: 커밋**

```bash
git add module/amadeus.mjs module/sheets/actor-sheet.mjs lang/ko.json
git commit -m "feat: add client theme setting and sheet skin/theme wiring"
```

---

## Task 4: 캐릭터 시트 템플릿 DOM 재작성 + _sheet-actor.scss

**Files:**
- Modify: `templates/actor/actor-character-sheet.html`
- Create: `scss/components/_sheet-actor.scss`

**변환 규칙:** 시안(`docs/design/아마데우스 액터 시트.dc.html` 72~234행, `.sheet` 내부)을 Handlebars로 변환한다. 인라인 `style="..."`는 전부 클래스로 빼서 `_sheet-actor.scss`로 옮기고 시안의 인라인 값을 그 클래스의 규칙으로 옮긴다. 시안의 정적 텍스트(`rddd`, `연성사`, `12 / 19` 등)는 아래 바인딩으로 치환. **시안의 데모 전용 요소(상단 회색 배경 wrapper, 속성 셀렉트 데모, 라이트/다크 데모 버튼, `data-theme="{{theme}}"` wrapper)는 가져오지 않는다** — 그 역할은 Task 3 배선이 담당.

- [ ] **Step 1: 보존할 바인딩 매핑(이 목록을 그대로 유지)**

기존 `actor-character-sheet.html`의 다음 바인딩을 새 DOM에도 동일하게 넣는다:
- 캐릭터명: `<input name="name" value="{{actor.name}}">`
- 초상화: `<img data-edit="img" src="{{actor.img}}">`, 부모신 이미지: `data-edit="system.chardata.parentimg" src="{{system.chardata.parentimg}}"`
- 속성 인장 한자: `{{localize (lookup config.color system.color)}}`(빈값 시 공백) — 셀렉트는 헤더 메타에 `<select name="system.color">{{selectOptions label.color selected=system.color}}</select>` 유지
- 메타: `system.chardata.pantheon`(신군), `system.chardata.background`(배경), `system.chardata.relationship`(관계/결연), `system.chardata.prophecy`(예언), `system.chardata.parent`(부모신명), 직업 `system.chardata.job.name`
- 레벨 `system.level`, 경험치 `system.exp`, 소지금 `<input name="system.money" placeholder="{{system.initMoney}}">`
- 능력치 6종: `{{#each system.ability as |ability key|}}` … 라벨 `<span data-action="ablRoll" data-ability="{{key}}" data-label="{{ability.label}}">{{ability.label}}</span>`, 등급 `<select name="system.ability.{{key}}.rank">{{selectOptions ../label.rank selected=ability.rank}}</select>`, 보정 `<select name="system.ability.{{key}}.mod">{{selectOptions ../label.mod selected=ability.mod}}</select>`
- 목표치 `<input name="system.dc">`, 생명력 `<input name="system.health.value">` / `<input name="system.health.max" placeholder="{{system.initHealth}}">`, 초기치 표시 `{{system.initHealth}}`
- 활력 굴림 `<a data-action="vitalityRoll" data-roll="{{system.level}}d6" data-label="{{localize 'AMADEUS.roll.vitality'}}">`, 활력 입력 `<input name="system.vitality">`
- 상태 6종 체크박스: `system.status.desperation`/`fury`/`coward.chkbox`(+`coward.level`)/`depravity`/`disgrace`/`wound.chkbox`(+`wound.level`)
- MEMO: `<textarea name="system.memo">{{system.memo}}</textarea>`
- 탭: `<nav class="sheet-tabs tabs" data-group="primary">` + `<a data-tab="item">아이템</a><a data-tab="gift">기프트</a><a data-tab="bond">인물</a><a data-tab="features">기타</a>`, 본문 `<div class="tab" data-group="primary" data-tab="...">` 4개에 기존 partial include(`actor-item.html`/`actor-gift.html`/`actor-bond.html`/`actor-features.html`) 유지

(탭 라벨만 시안 문구로 바꾸고 `data-tab` 값은 기존 유지 → `actor-sheet.mjs`의 탭 전환 로직 불변. 인물 탭은 기존 `actor-bond.html`이 인연+협력자를 이미 포함하는지 확인하고, 협력자가 빠져 있으면 해당 partial에 supporters 섹션 추가.)

- [ ] **Step 2: 템플릿 DOM 작성**

`templates/actor/actor-character-sheet.html`을 시안 구조(헤더/디바이더/3열 본문[능력·중앙·MEMO]/탭바/탭 콘텐츠)로 작성하되 Step 1 바인딩을 채운다. 시안의 SVG 문양/그라데이션 장식 레이어도 포함(`.sheet` 직하 absolute 레이어). 최상위 wrapper는 `<div class="amadeus-sheet-root flexcol">`(AppV2가 `.application.amadeus.sheet`를 이미 부여하므로 시안의 `.sheet` 카드 스타일은 `.amadeus.sheet .window-content` 기준으로 잡는다).

- [ ] **Step 3: `_sheet-actor.scss` 작성**

`scss/components/_sheet-actor.scss` 생성. 시안 인라인 스타일을 클래스 규칙으로 이관. 모든 색은 `var(--bg/--panel/--panel2/--text/--muted/--line/--gold/--acc/--seal/--sealtx)`, 상태 점 색은 `var(--wk/--wr/--wb/--wg/--ww/--wy)`, 폰트는 `$font-display`(숫자/등급)·`$font-title`(제목/인장)·`$font-body`. 주요 블록: `.sheet-header`(초상화/부모신 카드/메타칩/레벨·경험치·소지금), `.ability-grid`(좌측열), `.attr-seal`(중앙 인장), `.dchp`(목표치/생명력/초기치), `.badstatus`(상태 칩), `.memo-side`, `.sheet-tabs`. 시안의 radius/padding/gap/font-size 값을 그대로 사용.

- [ ] **Step 4: 빌드 + 회귀 확인**

Run: `npm run build`
Expected: 성공.
Foundry 수동 회귀(필수): ① 능력치 라벨 클릭 → 굴림 챗카드 출력 ② 활력 굴림 → `health.max`에 자동 입력 ③ 탭 4개 전환 동작 ④ 아이템 탭에서 아이템 생성/편집/삭제 동작(`data-item-id` 정상) ⑤ 부모신 아이템 드롭 → 색/능력 복사 + 인장/팔레트 갱신 ⑥ 5속성 × 라이트/다크 시각 점검.

- [ ] **Step 5: 커밋**

```bash
git add templates/actor/actor-character-sheet.html scss/components/_sheet-actor.scss
git commit -m "feat: rebuild character sheet DOM to match design mockup"
```

---

## Task 5: 이니셔티브 다이얼로그 + _dialog.scss

**Files:**
- Modify: `templates/initiative/gm-panel.html`, `templates/initiative/plot-prompt.html`, `module/initiative/gm-panel.mjs`, `module/initiative/plot-prompt.mjs`
- Create: `scss/components/_dialog.scss`

**변환 규칙:** 시안 `아마데우스 이니셔티브.dc.html`의 GM 다이얼로그(46~107행: 시작 전 + 진행 중)와 플레이어 다이얼로그(110~135행)를 Handlebars로 변환. 데모 wrapper/테마 버튼 제외. 다이얼로그 카드 루트에 `class="amadeus-dlg"` 부여.

- [ ] **Step 1: 기존 바인딩/액션 파악 후 보존**

`templates/initiative/gm-panel.html`과 `plot-prompt.html`의 현재 `data-action`/`name`/`data-*`(예: 플롯 시작, NPC 추가 셀렉트, 재요청/공개/초기화, 참가자 행 제거, 주사위 선택 `data-value` 등)와 `gm-panel.mjs`/`plot-prompt.mjs`의 `actions`/이벤트 핸들러를 읽어 목록화한다. 새 DOM에 동일 속성을 그대로 유지한다.

- [ ] **Step 2: 템플릿 재작성**

GM 패널: 헤더 바(모래시계 아이콘 + 제목 + 닫기), 시작 전(플롯 시작 버튼 + NPC 추가 셀렉트/버튼), 진행 중(재요청·공개·초기화 버튼 + 참가자 로스터 그리드[이름/유형/플롯/제거] + NPC 추가). 플롯 값 칩은 면색 토큰(`--d1~6`)으로, '6'은 기존 `plotLabel` 헬퍼('권외') 유지. 플레이어 프롬프트: 안내 문구 2줄 + 1~6 주사위 버튼 그리드(`role="button"`, 선택 시 `.selected`).

- [ ] **Step 3: `_dialog.scss` 작성**

`scss/components/_dialog.scss` 생성. `.amadeus-dlg` 루트 + 시안 인라인을 클래스로. 색은 `var(--bg/--panel/--panel2/--text/--muted/--line/--gold/--bar)`, 주사위 칩은 `--d1~6`. 헤더 골드 라인, 로스터 그리드, 주사위 버튼 그리드 스타일 포함.

- [ ] **Step 4: 다이얼로그 `_onRender`에 data-theme**

`module/initiative/gm-panel.mjs`와 `plot-prompt.mjs`의 클래스에 `_onRender` 추가(없으면 신설):

```js
async _onRender(context, options) {
  await super._onRender(context, options);
  this.element.dataset.theme = game.settings.get("amadeus", "theme");
}
```

그리고 두 앱의 `DEFAULT_OPTIONS.classes`에 `"amadeus-dlg"`가 포함되도록 추가(Task 3의 토글 전역 반영이 이 클래스를 찾는다).

- [ ] **Step 5: 빌드 + 멀티클라 검증**

Run: `npm run build` → 성공.
Foundry(GM+플레이어 2클라): 플롯 시작 → 플레이어 프롬프트 표시 → 주사위 선택/제출 → GM 로스터 집계 → 공개 → 행동 순서 챗카드. 라이트/다크 전환이 다이얼로그에 반영.

- [ ] **Step 6: 커밋**

```bash
git add templates/initiative scss/components/_dialog.scss module/initiative/gm-panel.mjs module/initiative/plot-prompt.mjs
git commit -m "feat: restyle initiative dialogs to match design mockup"
```

---

## Task 6: 챗카드 + _chatcard.scss

**Files:**
- Modify: `templates/chatcard/data-gift.html`, `data-item.html`, `data-description.html`, `roll-amadeabl.html`, `roll-gift.html`, `plot-done.html`, `plot-result.html`, `scss/components/_chatcard.scss`

**변환 규칙:** 시안 `아마데우스 채팅 카드.dc.html`(아이템 카드 40~61행, 굴림 카드 72~151행)과 이니셔티브 시안의 플롯 카드(142~162행)를 Handlebars로 변환. 모든 카드 루트에 `class="amadeus-chat ..."` 부여. 양피지 고정(테마/스킨 미적용).

- [ ] **Step 1: 기존 챗 템플릿 컨텍스트 파악**

각 챗 템플릿이 `chat.mjs`의 `postRoll`/`postCard`에서 받는 컨텍스트(아이템 분류/가격/위력/효과, 굴림 결과 배열·면값·성공판정, 플롯 순서 배열 등)를 읽어 변수명을 확인한다. 새 마크업에서 동일 변수를 사용한다.

- [ ] **Step 2: 템플릿 재작성**

- 아이템 카드(`data-item.html`/`data-gift.html`/`data-description.html`): 제목+아이콘, 디바이더, 정보 칩(분류/가격/위력 또는 분류/조건/판정), 효과 설명, 태그.
- 굴림 카드(`roll-amadeabl.html`/`roll-gift.html`): 제목, 디바이더, 정보 칩(목표치/랭크/모드 또는 식료·1d6 등), 주사위 칩 그리드 — 각 칩에 면색(`--d1~6`), 실제 눈 SVG 반투명, 숫자(그림자), 보정/판정 라벨(성공/실패/스페셜/펌블, `successCheck` 헬퍼). 합계/회복량/대미지 표시.
- 플롯 카드(`plot-done.html`/`plot-result.html`): 완료 알림(가벼운 상태 카드) / 행동 순서(테두리·디바이더 결과 카드, 순번+면색 주사위 칩+이름).

- [ ] **Step 3: `_chatcard.scss` 재작성**

`scss/components/_chatcard.scss`를 양피지 토큰(`var(--pg/--pg2/--pgline/--pgline2/--ptext/--pmuted/--pbody/--pgold)`) + die-face(`--d1~6`)로 작성. 카드 박스(이중 테두리), 디바이더(FA 아이콘 장식), 정보 칩, 주사위 칩(SVG 눈 + 숫자 그림자) 스타일. 기존 `.chatcard.*-chatcard` 셀렉터와의 호환은 템플릿 루트 클래스 기준으로 정리.

- [ ] **Step 4: 빌드 + 출력 검증**

Run: `npm run build` → 성공.
Foundry: 능력 굴림/기프트 굴림/식료 회복/대미지/아이템 정보/플롯 결과 카드를 각각 출력해 시안과 대조. 라이트/다크 전환과 무관하게 양피지 고정 확인.

- [ ] **Step 5: 커밋**

```bash
git add templates/chatcard scss/components/_chatcard.scss
git commit -m "feat: restyle chat cards to parchment design mockup"
```

---

## Task 7: NPC·아이템 시트 토큰 정돈 (깨짐 방지)

**Files:**
- Modify: `scss/components/_forms.scss`, `scss/components/_items.scss`, `scss/components/_effects.scss`, `scss/components/_resource.scss`

- [ ] **Step 1: 하드코딩 색 → 토큰 치환**

위 4개 SCSS에서 잔존 하드코딩 색/`$color-*` 참조를 `var(--*)` 토큰으로 교체한다. NPC 시트(`data-skin` 없음)와 아이템 시트는 `.amadeus.sheet` fallback 토큰(적·dark)을 받으므로 별도 팔레트 없이 일관 배경/입력을 얻는다. 레이아웃 재설계는 하지 않는다(스펙 범위 밖).

- [ ] **Step 2: 빌드 + 수동 확인**

Run: `npm run build` → 성공.
Foundry: NPC 시트, 아이템 7종 시트를 열어 흰 배경/깨진 입력 없이 토큰 색으로 표시되는지 확인(완성도 아닌 "깨지지 않음" 기준).

- [ ] **Step 3: 커밋**

```bash
git add scss/components/_forms.scss scss/components/_items.scss scss/components/_effects.scss scss/components/_resource.scss
git commit -m "style: migrate remaining components to token variables"
```

---

## Task 8: 최종 정리 + 회귀 검증

**Files:**
- Delete: `scss/utils/_colors.scss`
- Modify: `scss/amadeus.scss`(잔존 import 정리), `scss/utils/_variables.scss`(비색상만 유지)

- [ ] **Step 1: `_colors.scss` 제거**

`_colors.scss`의 die-face(`--d1~6`)·`.color-d*`/`.dNum-*` 규칙은 `_tokens.scss`로 이미 이관됐다. 단, `.color-d1~6`/`.dNum-1~6` 클래스가 템플릿(예: 상태이상 주사위 아이콘 `color-d1`)에서 쓰이는지 grep으로 확인하고, 쓰인다면 그 규칙만 `_tokens.scss`에 `color: var(--dN)` 형태로 옮긴 뒤 `_colors.scss`를 삭제하고 `amadeus.scss`의 잔존 import를 제거한다.

Run: `grep -rn "color-d\|dNum-" templates/`
→ 사용처가 있으면 토큰 규칙으로 이관.

- [ ] **Step 2: 전체 빌드 + 린트**

Run: `npm run build`
Expected: 성공, `$color-*` 미정의 에러 없음.

Run: `npm run lint`
Expected: 0 errors(기존 2 warnings 외 신규 없음).

Run: `npm test`
Expected: 22 passed(기존 순수 로직 테스트 회귀 없음).

- [ ] **Step 3: 전체 회귀 체크리스트(Foundry 수동)**

캐릭터 시트: 능력/활력 굴림, 탭 전환, 아이템 CRUD, 부모신 드롭→색/능력 복사, 5속성×라/다 팔레트, 헤더 테마 토글 전역 반영. 이니셔티브: 플롯 멀티클라 전 흐름. 챗카드: 각 카드 출력. NPC/아이템 시트: 깨짐 없음.

- [ ] **Step 4: 커밋**

```bash
git add scss/
git commit -m "style: remove legacy color partial after token migration"
```

---

## Self-Review (작성자 검토 결과)

**스펙 커버리지:** 토큰 레이어(T1) · 폰트(T1) · AppV2 window(T2) · 테마 설정/토글(T3) · 캐릭터 시트(T4) · 이니셔티브(T5) · 챗카드(T6) · NPC/아이템 정돈(T7) · 정리/검증(T8) — 스펙 전 섹션이 태스크에 대응. **조정**: 스펙의 "color→skin/한자 매핑 유틸 + Vitest"는 `system.color`가 skin과 동일하고 한자는 i18n으로 해결되어 trivial → 사용자의 inline-helper 선호에 따라 인라인 처리(별도 유틸/테스트 없음). 이로써 디자인 작업의 단위테스트 대상이 사실상 없어 TDD 대신 build/lint/test 회귀 + 수동 검증으로 검증한다.

**플레이스홀더 스캔:** 토큰/배선 코드는 완전. 템플릿 DOM·SCSS 규칙은 시안 파일이 ground truth이므로 "시안 라인 X를 변환" + 보존 바인딩 전체 목록으로 지정(소스 존재 → placeholder 아님).

**타입/명칭 일관성:** `data-skin`/`data-theme`/`amadeus-dlg`/`amadeus-chat`/`toggleTheme`/설정키 `("amadeus","theme")`가 T1·T3·T5 전반에서 일치. 토큰 변수명(`--bg/--panel/--panel2/--text/--muted/--line/--gold/--acc/--seal/--sealtx/--bar/--pg*/--d1~6/--w*`)이 시안과 일치.

**검증 필요(구현 중 교차 확인):** v13의 `_getHeaderControls` 시그니처/액션 디스패치, `_onRender`에서 `this.element`가 프레임 루트인지, `foundry.applications.instances` 순회 API — 모두 F12/소스로 확인 후 적용(추측 금지).
</content>
