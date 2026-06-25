# 수식 롤 카드 테마 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 목표치 없는 단순 합산 굴림(식량 1d6·장비 대미지·기프트 수식·활력·채팅 `/r`)을 `amade-dicecard` 테마와 통일된 챗 카드로 출력한다.

**Architecture:** `renderChatMessageHTML` 훅에서 `isRoll === true`인 코어 Roll 메시지를 가로채, 순수 함수 `buildFormulaRollView`로 뷰모델을 만들고 신규 `roll-formula.html`을 렌더해 메시지의 `.message-content`를 교체한다. 기존 커스텀 카드는 모두 `postCard`로 만들어져 `isRoll === false`라 자동 제외된다.

**Tech Stack:** Foundry VTT v13 (ApplicationV2/Handlebars), Vite 번들, SCSS, Vitest(순수 함수 단위 테스트).

## Global Constraints

- 대상: **Foundry VTT v13+**. 훅 시그니처는 `Hooks.on("renderChatMessageHTML", (message, html, context) => {})`, `html`은 **HTMLElement**(jQuery 아님).
- 빌드 산출물 `dist/`는 자립형 패키지다. 코드/템플릿/SCSS 변경 후 **`npm run build`** 로 재번들해야 Foundry에 반영된다.
- `module/dice/resolution.mjs`는 **Foundry 전역(game/Roll/ChatMessage)을 절대 참조하지 않는 순수 모듈**이다. 신규 함수도 이 규칙을 지킨다(Vitest에서 import 가능).
- 기존 커스텀 카드(능력치/기프트 판정·plot·mood·data)와 `postCard`/`postRoll`/`amadeRoll` 시그니처는 **변경하지 않는다**.
- 챗 카드의 한국어 라벨은 기존 카드처럼 **템플릿에 하드코딩**한다(예: "합계"). i18n 키를 새로 만들지 않는다.
- 커밋 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `buildFormulaRollView` 순수 함수 (TDD)

수식 롤의 원시 데이터(주사위 눈·수식·합계·flavor)를 챗 템플릿용 뷰모델로 변환하는 순수 함수. Foundry 의존 없음 → Vitest로 검증한다.

**Files:**
- Modify: `module/dice/resolution.mjs` (파일 끝에 함수 추가)
- Test: `test/resolution.test.mjs` (파일 끝에 describe 블록 추가)

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces:
  ```
  buildFormulaRollView({ flavor, formula, total, dice }) → {
    title,                                  // string: flavor가 비어있지 않으면 flavor, 아니면 formula
    formula,                                // string: 원본 수식 라벨 ("1d6", "2d6+3" 등)
    total,                                  // number: 최종 합계(보정 포함)
    groups: [ { faces, isD6, dice: [ { value } ] } ]   // dice term별 그룹
  }
  ```
  입력 `dice`는 `[{ faces: number, values: number[] }]` 형태(각 DiceTerm에서 추출). `isD6 = (faces === 6)`.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/resolution.test.mjs`의 import 목록에 `buildFormulaRollView`를 추가한다. 기존 import 블록(1~15행)의 마지막 항목 `buildMoodResult,` 다음 줄에 추가:

```javascript
  buildMoodResult,
  buildFormulaRollView,
```

그리고 파일 맨 끝(175행 `});` 다음)에 describe 블록을 추가:

```javascript
describe("buildFormulaRollView", () => {
  it("builds a d6 group and uses flavor as title", () => {
    const view = buildFormulaRollView({
      flavor: "식량",
      formula: "1d6",
      total: 4,
      dice: [{ faces: 6, values: [4] }],
    });
    expect(view).toEqual({
      title: "식량",
      formula: "1d6",
      total: 4,
      groups: [{ faces: 6, isD6: true, dice: [{ value: 4 }] }],
    });
  });

  it("falls back to formula as title when flavor is empty", () => {
    const view = buildFormulaRollView({
      flavor: "",
      formula: "2d6",
      total: 7,
      dice: [{ faces: 6, values: [3, 4] }],
    });
    expect(view.title).toBe("2d6");
    expect(view.groups[0].dice).toEqual([{ value: 3 }, { value: 4 }]);
  });

  it("falls back to formula as title when flavor is undefined", () => {
    const view = buildFormulaRollView({ formula: "1d6", total: 2, dice: [{ faces: 6, values: [2] }] });
    expect(view.title).toBe("1d6");
  });

  it("marks non-d6 dice with isD6 false", () => {
    const view = buildFormulaRollView({
      flavor: "공격",
      formula: "1d20",
      total: 13,
      dice: [{ faces: 20, values: [13] }],
    });
    expect(view.groups[0].isD6).toBe(false);
    expect(view.groups[0].faces).toBe(20);
  });

  it("keeps the modifier in total but not in dice groups", () => {
    const view = buildFormulaRollView({
      flavor: "회복",
      formula: "1d6+3",
      total: 7,
      dice: [{ faces: 6, values: [4] }],
    });
    expect(view.total).toBe(7);
    expect(view.groups).toEqual([{ faces: 6, isD6: true, dice: [{ value: 4 }] }]);
  });

  it("supports multiple dice terms", () => {
    const view = buildFormulaRollView({
      flavor: "혼합",
      formula: "2d6 + 1d4",
      total: 9,
      dice: [
        { faces: 6, values: [3, 5] },
        { faces: 4, values: [1] },
      ],
    });
    expect(view.groups).toHaveLength(2);
    expect(view.groups[1]).toEqual({ faces: 4, isD6: false, dice: [{ value: 1 }] });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/resolution.test.mjs`
Expected: FAIL — `buildFormulaRollView is not a function` (또는 import 관련 에러).

- [ ] **Step 3: 최소 구현 작성**

`module/dice/resolution.mjs` 파일 끝(109행 `buildMoodResult` 함수 닫는 `}` 다음)에 추가:

```javascript

/**
 * 단순 합산 굴림(목표치/성공판정 없음)을 챗 카드용 뷰모델로 변환한다.
 * 능력치 판정과 달리 펌블/스페셜·목표치 비교가 없으며, 주사위 눈과 합계만 보여준다.
 * @param {object} args
 * @param {string} [args.flavor] 카드 제목으로 쓸 이름(아이템/기프트). 비어 있으면 수식을 제목으로.
 * @param {string} args.formula 원본 수식 라벨("1d6", "2d6+3" 등)
 * @param {number} args.total 최종 합계(보정 포함)
 * @param {{faces:number, values:number[]}[]} args.dice 각 DiceTerm의 면수와 굴린 값들
 * @returns {{title:string, formula:string, total:number, groups:{faces:number, isD6:boolean, dice:{value:number}[]}[]}}
 */
export function buildFormulaRollView({ flavor, formula, total, dice }) {
  return {
    title: flavor || formula,
    formula,
    total,
    groups: dice.map((d) => ({
      faces: d.faces,
      isD6: d.faces === 6,
      dice: d.values.map((value) => ({ value })),
    })),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/resolution.test.mjs`
Expected: PASS — 전체 통과(기존 테스트 포함, `buildFormulaRollView` 6개 추가 통과).

- [ ] **Step 5: 커밋**

```bash
git add module/dice/resolution.mjs test/resolution.test.mjs
git commit -m "feat: add buildFormulaRollView pure helper for themed formula rolls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `roll-formula.html` 템플릿 + 스타일 + preload 등록

테마 카드의 외형. `amade-dicecard` 자산을 재사용하되 칩 정보/성공판정 영역을 빼고 수식 라벨·합계를 넣는다. 자동 테스트는 불가하므로 **빌드 통과**로 검증한다.

**Files:**
- Create: `templates/chatcard/roll-formula.html`
- Modify: `scss/components/_chatcard.scss` (파일 끝에 스타일 블록 추가)
- Modify: `module/helpers/templates.mjs:26` (preload 목록에 추가)

**Interfaces:**
- Consumes: Task 1의 뷰모델 `{ title, formula, total, groups: [{ faces, isD6, dice: [{ value }] }] }`
- Produces: `systems/amadeus/templates/chatcard/roll-formula.html` (Task 3이 `renderTemplate`으로 호출)

- [ ] **Step 1: 템플릿 파일 생성**

Create `templates/chatcard/roll-formula.html` (pip SVG는 기존 `roll-amadeabl.html`과 동일 패턴 — d6일 때만 표시, d6 외는 숫자 chip):

```html
<div class="amadeus-chat chatcard amade-dicecard roll-formula-chatcard">
  <div class="chat-inner">
    <header class="chat-title">
      <i class="fa-solid fa-dice chat-title-icon"></i>
      <span class="chat-title-text">{{title}}</span>
    </header>
    <div class="chat-ornament" aria-hidden="true">
      <span class="chat-ornament-line chat-ornament-line--l"></span>
      <i class="fa-solid fa-diamond chat-ornament-dot"></i>
      <i class="fa-solid fa-dice-d20 chat-ornament-icon"></i>
      <i class="fa-solid fa-diamond chat-ornament-dot"></i>
      <span class="chat-ornament-line chat-ornament-line--r"></span>
    </div>
    <div class="chat-formula-label lnum">{{formula}}</div>
    <div class="chat-diceset">
      {{#each groups}}
      {{#each this.dice}}
      <div class="chat-die-col">
        {{#if ../isD6}}
        <div class="chat-die-chip chat-die-chip--{{this.value}}">
          {{#if (eq this.value 1)}}
          <svg class="chat-die-pips" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="4.4"/></svg>
          {{/if}}
          {{#if (eq this.value 2)}}
          <svg class="chat-die-pips" viewBox="0 0 60 60" aria-hidden="true"><circle cx="16" cy="16" r="4.4"/><circle cx="44" cy="44" r="4.4"/></svg>
          {{/if}}
          {{#if (eq this.value 3)}}
          <svg class="chat-die-pips" viewBox="0 0 60 60" aria-hidden="true"><circle cx="16" cy="16" r="4.4"/><circle cx="30" cy="30" r="4.4"/><circle cx="44" cy="44" r="4.4"/></svg>
          {{/if}}
          {{#if (eq this.value 4)}}
          <svg class="chat-die-pips" viewBox="0 0 60 60" aria-hidden="true"><circle cx="16" cy="16" r="4.4"/><circle cx="44" cy="16" r="4.4"/><circle cx="16" cy="44" r="4.4"/><circle cx="44" cy="44" r="4.4"/></svg>
          {{/if}}
          {{#if (eq this.value 5)}}
          <svg class="chat-die-pips" viewBox="0 0 60 60" aria-hidden="true"><circle cx="16" cy="16" r="4.4"/><circle cx="44" cy="16" r="4.4"/><circle cx="30" cy="30" r="4.4"/><circle cx="16" cy="44" r="4.4"/><circle cx="44" cy="44" r="4.4"/></svg>
          {{/if}}
          {{#if (eq this.value 6)}}
          <svg class="chat-die-pips" viewBox="0 0 60 60" aria-hidden="true"><circle cx="16" cy="14" r="4.2"/><circle cx="44" cy="14" r="4.2"/><circle cx="16" cy="30" r="4.2"/><circle cx="44" cy="30" r="4.2"/><circle cx="16" cy="46" r="4.2"/><circle cx="44" cy="46" r="4.2"/></svg>
          {{/if}}
          <span class="chat-die-num lnum">{{this.value}}</span>
        </div>
        {{else}}
        <div class="chat-die-chip chat-die-chip--plain">
          <span class="chat-die-num lnum">{{this.value}}</span>
        </div>
        {{/if}}
      </div>
      {{/each}}
      {{/each}}
    </div>
    <div class="chat-total">
      <span class="chat-total-lbl">합계</span>
      <span class="chat-total-val lnum">{{total}}</span>
    </div>
  </div>
</div>
```

- [ ] **Step 2: preload 목록에 등록**

`module/helpers/templates.mjs`의 chatcard 블록(26행 `mood-result.html` 다음 줄)에 추가:

```javascript
    "systems/amadeus/templates/chatcard/mood-result.html",
    "systems/amadeus/templates/chatcard/roll-formula.html",
```

- [ ] **Step 3: 스타일 추가**

`scss/components/_chatcard.scss` 파일 끝(451행 이후)에 추가:

```scss

// --------------------------------------------------------------------------
// Formula roll card (단순 합산 굴림 — 목표치/성공판정 없이 주사위 + 합계만)
// --------------------------------------------------------------------------
.amadeus-chat .chat-formula-label {
  text-align: center;
  font-family: $font-display;
  font-size: 14px;
  color: var(--pmuted);
  margin-top: 6px;
}

// d6 외 주사위(d20 등): 값별 색이 없으므로 중립 chip + 본문색 숫자
.amadeus-chat .chat-die-chip--plain {
  background: var(--pg2);
  border-color: var(--pgline2);

  .chat-die-num { color: var(--ptext); }
}

.amadeus-chat .chat-total {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin-top: 13px;
  padding-top: 10px;
  border-top: 1px solid var(--pgline2);
}

.amadeus-chat .chat-total-lbl {
  font-size: 12px;
  color: var(--pmuted);
}

.amadeus-chat .chat-total-val {
  font-family: $font-display;
  font-weight: 700;
  font-size: 26px;
  color: var(--pgold);
  line-height: 1;
}
```

- [ ] **Step 4: 빌드 통과 확인**

Run: `npm run build`
Expected: `✓ built` 메시지, 에러 없음. `dist/amadeus.css`에 `.chat-total-val` 포함 확인:

Run: `grep -c "chat-total-val" dist/amadeus.css`
Expected: `1` 이상.

그리고 템플릿이 dist로 복사됐는지 확인:

Run: `ls dist/templates/chatcard/roll-formula.html`
Expected: 파일 경로 출력(존재).

- [ ] **Step 5: 커밋**

```bash
git add templates/chatcard/roll-formula.html scss/components/_chatcard.scss module/helpers/templates.mjs
git commit -m "feat: add roll-formula chat card template and styles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `themeRollMessage` 훅 핸들러 + 등록

코어 Roll 메시지를 가로채 Task 2 템플릿으로 교체하는 Foundry 의존부. 자동 테스트 불가 → 빌드 통과 + Foundry 수동 검증.

**Files:**
- Modify: `module/chat/chat.mjs` (파일 끝에 함수 추가, 상단 import 추가)
- Modify: `module/amadeus.mjs` (상단 import 추가 + 최상위 훅 등록)

**Interfaces:**
- Consumes: Task 1 `buildFormulaRollView`, Task 2 `roll-formula.html`
- Produces: `themeRollMessage(message, html)` — `renderChatMessageHTML` 훅 핸들러

- [ ] **Step 1: 핸들러 구현**

`module/chat/chat.mjs` 상단에 import 추가(1행 위, 파일 맨 앞):

```javascript
import { buildFormulaRollView } from "../dice/resolution.mjs";
```

그리고 파일 끝(`postCard` 함수 닫는 `}` 다음)에 추가:

```javascript

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
```

- [ ] **Step 2: 훅 등록**

`module/amadeus.mjs` 상단 import 영역(21행 `PlotGMPanel` import 다음 줄)에 추가:

```javascript
import { PlotGMPanel } from "./initiative/gm-panel.mjs";
import { themeRollMessage } from "./chat/chat.mjs";
```

그리고 `getSceneControlButtons` 훅(168행) **앞**, "Scene Controls" 주석 블록 위에 최상위 훅 등록을 추가:

```javascript
/* -------------------------------------------- */
/*  Chat: 수식 롤 카드 테마 통일                 */
/* -------------------------------------------- */
Hooks.on("renderChatMessageHTML", themeRollMessage);
```

- [ ] **Step 3: 빌드 통과 확인**

Run: `npm run build`
Expected: `✓ built`, 에러 없음.

Run: `grep -c "renderChatMessageHTML" dist/amadeus.mjs`
Expected: `1` 이상.

- [ ] **Step 4: 커밋**

```bash
git add module/chat/chat.mjs module/amadeus.mjs
git commit -m "feat: theme plain Roll chat messages via renderChatMessageHTML hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Foundry 수동 검증** (사용자가 `dist/`를 서버에 배포 후 수행)

빌드된 `dist/`를 Foundry 서버의 `systems/amadeus`로 배포하고, 월드를 새로고침한 뒤 다음을 확인한다.

**테마 적용 확인(모두 새 카드로 표시):**
- [ ] 캐릭터 시트 인벤토리 "식량" 1D6 클릭 → 테마 카드(주사위 + 합계)
- [ ] 장비/무기 대미지 수식 클릭 → 테마 카드
- [ ] 기프트 수식(`giftFormulaRoll`) 클릭 → 테마 카드
- [ ] 활력 굴림(`vitalityRoll`, `level d6`) → 테마 카드
- [ ] 채팅창에 `/r 1d6`, `/r 2d6+3` 입력 → 테마 카드(합계에 보정 반영)
- [ ] 채팅창에 `/r 1d20` 입력 → 숫자 chip(중립색) + 합계

**회귀 확인(변하지 않아야 함):**
- [ ] 능력치 판정(랭크 클릭) → 기존 `roll-amadeabl` 카드 그대로(목표치/성공판정 표시)
- [ ] 기프트 판정(`itemRollCard`) → 기존 `roll-gift` 카드 그대로
- [ ] plot/mood/아이템정보(`itemDataCard`) 카드 → 변화 없음

---

## 참고: 검증 명령 요약

- 단위 테스트: `npx vitest run test/resolution.test.mjs`
- 전체 테스트: `npm test`
- 빌드: `npm run build`
- 린트: `npm run lint`
