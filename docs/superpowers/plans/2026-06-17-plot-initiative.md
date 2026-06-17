# 비밀 플롯 이니셔티브 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 각 PL가 비밀리에 1~6 숫자를 골라 GM에게 제출하고, GM이 동시 공개하면 그 숫자(낮을수록 먼저)대로 행동 순서가 배정되는 독립 도구를 만든다.

**Architecture:** Foundry 전투 트래커와 무관한 독립 기능. 순수 순서 계산(`order.mjs`)과 GM 메모리 세션(`session.mjs`)을 분리하고, `game.socket`(채널 `system.amadeus`)으로 플레이어→GM 제출을 전달한다. 소켓 수신은 Foundry Hooks로 UI에 통지해 import 순환을 피한다. UI는 ApplicationV2 앱 2개(GM 패널, 플레이어 플롯 프롬프트), 결과는 챗 카드.

**Tech Stack:** Foundry VTT v13, ApplicationV2(`HandlebarsApplicationMixin`), `game.socket`, Vite, Vitest.

**참고 문서:** 설계 spec `docs/superpowers/specs/2026-06-17-plot-initiative-design.md`. 용어는 "플롯"(입찰 아님). 채널/식별자는 `plot-*`.

**핵심 규칙:** 낮은 수 먼저(1=최속), 동값=같은 순번(동시행동, 내부 정렬 안 함), 비밀성은 UI 수준, 세션은 GM 메모리 임시.

**공통 검증:** `npm run build`(Expected `✓ built`) · `npm run lint`(신규 error 0) · `npm test`(PASS). 소켓/UI는 GM+플레이어 멀티 클라이언트 수동 검증.

---

## Task 1: 순수 순서 계산 `order.mjs` + 테스트

**Files:**
- Create: `module/initiative/order.mjs`
- Create: `test/order.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성** — Create `test/order.test.mjs`:
```js
import { describe, it, expect } from "vitest";
import { computeOrder } from "../module/initiative/order.mjs";

describe("computeOrder", () => {
  it("orders by ascending value (1 fastest)", () => {
    const result = computeOrder([
      { actorId: "a", name: "A", value: 3 },
      { actorId: "b", name: "B", value: 1 },
      { actorId: "c", name: "C", value: 5 },
    ]);
    expect(result.map((s) => s.value)).toEqual([1, 3, 5]);
    expect(result.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(result[0].members.map((m) => m.actorId)).toEqual(["b"]);
  });

  it("groups equal values into the same rank (ties share a slot)", () => {
    const result = computeOrder([
      { actorId: "a", name: "A", value: 2 },
      { actorId: "b", name: "B", value: 2 },
      { actorId: "c", name: "C", value: 4 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].rank).toBe(1);
    expect(result[0].value).toBe(2);
    expect(result[0].members.map((m) => m.actorId)).toEqual(["a", "b"]);
    expect(result[1].rank).toBe(2);
    expect(result[1].value).toBe(4);
  });

  it("excludes entries with null/non-integer value", () => {
    const result = computeOrder([
      { actorId: "a", name: "A", value: null },
      { actorId: "b", name: "B", value: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].members.map((m) => m.actorId)).toEqual(["b"]);
  });

  it("returns empty for empty input", () => {
    expect(computeOrder([])).toEqual([]);
  });

  it("returns a single slot when everyone picks the same value", () => {
    const result = computeOrder([
      { actorId: "a", name: "A", value: 6 },
      { actorId: "b", name: "B", value: 6 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
    expect(result[0].members).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — Run: `npm test`. Expected: FAIL — `Cannot find module '../module/initiative/order.mjs'`.

- [ ] **Step 3: 구현** — Create `module/initiative/order.mjs`:
```js
/**
 * 플롯 값 목록을 행동 순서로 계산한다. 낮은 값이 먼저, 동값은 같은 순번으로 묶는다(동시행동).
 * value가 정수(1~6)가 아닌 항목(미제출 등)은 제외한다.
 * @param {{actorId:string, name:string, value:number|null}[]} entries
 * @returns {{rank:number, value:number, members:{actorId:string,name:string}[]}[]}
 */
export function computeOrder(entries) {
  const byValue = new Map();
  for (const e of entries) {
    if (!Number.isInteger(e.value)) continue;
    if (!byValue.has(e.value)) byValue.set(e.value, []);
    byValue.get(e.value).push({ actorId: e.actorId, name: e.name });
  }
  const sortedValues = [...byValue.keys()].sort((a, b) => a - b);
  return sortedValues.map((value, i) => ({ rank: i + 1, value, members: byValue.get(value) }));
}
```

- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test`. Expected: PASS (모든 computeOrder 테스트).

- [ ] **Step 5: 린트** — Run: `npm run lint`. Expected: 신규 error 0.

- [ ] **Step 6: 커밋**
```bash
git add module/initiative/order.mjs test/order.test.mjs
git commit -m "feat: add pure plot initiative order computation"
```

---

## Task 2: 세션 상태 `session.mjs` + 테스트

**Files:**
- Create: `module/initiative/session.mjs`
- Create: `test/plot-session.test.mjs`

`PlotSession`은 Foundry 전역을 참조하지 않는 순수 상태 보관자다(id는 생성자 인자로 주입 → node 테스트 가능). 진행 중 세션 1개를 모듈 수준에서 가리키는 접근자도 제공한다.

- [ ] **Step 1: 실패하는 테스트 작성** — Create `test/plot-session.test.mjs`:
```js
import { describe, it, expect } from "vitest";
import { PlotSession } from "../module/initiative/session.mjs";

function make() {
  const s = new PlotSession("sess1");
  s.addParticipant({ actorId: "a", name: "A", isNPC: false, userId: "u1" });
  s.addParticipant({ actorId: "b", name: "B", isNPC: true });
  return s;
}

describe("PlotSession", () => {
  it("records a valid value and marks submitted", () => {
    const s = make();
    expect(s.setValue("a", 3)).toBe(true);
    const p = s.participants.get("a");
    expect(p.value).toBe(3);
    expect(p.submitted).toBe(true);
  });

  it("rejects out-of-range or non-integer values", () => {
    const s = make();
    expect(s.setValue("a", 0)).toBe(false);
    expect(s.setValue("a", 7)).toBe(false);
    expect(s.setValue("a", 2.5)).toBe(false);
    expect(s.participants.get("a").submitted).toBe(false);
  });

  it("ignores unknown participant", () => {
    const s = make();
    expect(s.setValue("zzz", 3)).toBe(false);
  });

  it("does not duplicate an existing participant", () => {
    const s = make();
    s.addParticipant({ actorId: "a", name: "A2" });
    expect(s.participants.size).toBe(2);
    expect(s.participants.get("a").name).toBe("A");
  });

  it("computes order from current values, excluding unsubmitted", () => {
    const s = make();
    s.setValue("a", 1);
    const order = s.computeOrder();
    expect(order).toHaveLength(1);
    expect(order[0].members.map((m) => m.actorId)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — Run: `npm test`. Expected: FAIL — `Cannot find module '../module/initiative/session.mjs'`.

- [ ] **Step 3: 구현** — Create `module/initiative/session.mjs`:
```js
import { computeOrder } from "./order.mjs";

// 진행 중인 플롯 세션 1개를 GM 메모리에 보관한다(임시).
let activeSession = null;
export function getActiveSession() {
  return activeSession;
}
export function setActiveSession(session) {
  activeSession = session;
}

export class PlotSession {
  /** @param {string} id 세션 식별자(GM 패널이 foundry.utils.randomID()로 생성해 주입) */
  constructor(id) {
    this.id = id;
    this.revealed = false;
    /** @type {Map<string,{actorId,name,isNPC,userId,value,submitted}>} */
    this.participants = new Map();
  }

  addParticipant({ actorId, name, isNPC = false, userId = null }) {
    if (this.participants.has(actorId)) return;
    this.participants.set(actorId, { actorId, name, isNPC, userId, value: null, submitted: false });
  }

  removeParticipant(actorId) {
    this.participants.delete(actorId);
  }

  /** 1~6 정수만 허용. 성공 시 true. */
  setValue(actorId, value) {
    const p = this.participants.get(actorId);
    if (!p) return false;
    if (!Number.isInteger(value) || value < 1 || value > 6) return false;
    p.value = value;
    p.submitted = true;
    return true;
  }

  get entries() {
    return [...this.participants.values()].map((p) => ({ actorId: p.actorId, name: p.name, value: p.value }));
  }

  computeOrder() {
    return computeOrder(this.entries);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test`. Expected: PASS.

- [ ] **Step 5: 린트** — Run: `npm run lint`. Expected: 신규 error 0.

- [ ] **Step 6: 커밋**
```bash
git add module/initiative/session.mjs test/plot-session.test.mjs
git commit -m "feat: add in-memory plot session state"
```

---

## Task 3: i18n 키 추가

**Files:**
- Modify: `lang/ko.json`

플롯 기능이 쓰는 한국어 라벨을 `AMADEUS.initiative.*`로 추가한다.

- [ ] **Step 1: `AMADEUS` 객체에 `initiative` 블록 추가** — `lang/ko.json`의 최상위 `"AMADEUS"` 객체 안(기존 `"ability"` 블록 바로 앞 또는 뒤, JSON 유효성만 지키면 됨)에 다음 키 그룹을 추가:
```json
    "initiative": {
      "panelTitle": "플롯 이니셔티브",
      "promptTitle": "플롯",
      "promptHint": "행동 순서를 위한 주사위 숫자를 비밀리에 고르세요 (낮을수록 먼저)",
      "start": "플롯 시작",
      "reveal": "공개",
      "reset": "초기화",
      "rerequest": "재요청",
      "addNpc": "NPC 추가",
      "submitted": "제출됨",
      "pending": "대기",
      "plotDone": "플롯 완료",
      "order": "행동 순서",
      "notSubmitted": "미제출",
      "pc": "PC",
      "npc": "NPC",
      "noCharacter": "배정된 캐릭터가 없습니다.",
      "noGm": "GM이 접속해 있지 않습니다.",
      "noParticipants": "참가자가 없습니다."
    },
```
(추가 위치 주의: 마지막 키면 앞 항목 끝에 콤마가 필요하고, 이 블록 끝에는 뒤 항목이 있으면 콤마를 둔다. JSON에 트레일링 콤마 금지.)

- [ ] **Step 2: JSON 유효성·빌드 확인** — Run: `npm run build`. Expected: `✓ built` (정적 복사 시 JSON 파싱 에러 없음). 추가로 Node로 파싱 확인: `node -e "JSON.parse(require('fs').readFileSync('lang/ko.json','utf8')); console.log('ok')"` → Expected: `ok`.

- [ ] **Step 3: 커밋**
```bash
git add lang/ko.json
git commit -m "feat: add i18n keys for plot initiative"
```

---

## Task 4: 챗 카드 템플릿 (플롯 완료 / 결과)

**Files:**
- Create: `templates/chatcard/plot-done.html`
- Create: `templates/chatcard/plot-result.html`
- Modify: `module/helpers/templates.mjs`

- [ ] **Step 1: 플롯 완료 카드 생성** — Create `templates/chatcard/plot-done.html`:
```html
<div class="chatcard plot-done-chatcard">
  <span class="plot-done-name">{{name}}</span> {{localize "AMADEUS.initiative.plotDone"}}
</div>
```

- [ ] **Step 2: 결과 카드 생성** — Create `templates/chatcard/plot-result.html`:
```html
<div class="chatcard plot-result-chatcard">
  <div class="plot-result-title">{{localize "AMADEUS.initiative.order"}}</div>
  <ol class="plot-order">
    {{#each order as |slot|}}
    <li class="plot-slot">
      <span class="plot-rank">{{slot.rank}}</span>
      <span class="plot-value">[{{slot.value}}]</span>
      <span class="plot-members">{{#each slot.members as |m|}}{{m.name}}{{#unless @last}}, {{/unless}}{{/each}}</span>
    </li>
    {{/each}}
  </ol>
  {{#if notSubmitted.length}}
  <div class="plot-notsubmitted">
    {{localize "AMADEUS.initiative.notSubmitted"}}: {{#each notSubmitted as |m|}}{{m.name}}{{#unless @last}}, {{/unless}}{{/each}}
  </div>
  {{/if}}
</div>
```

- [ ] **Step 3: preload 목록에 추가** — `module/helpers/templates.mjs`의 `preloadHandlebarsTemplates` 배열에서 `"systems/amadeus/templates/chatcard/data-description.html",` 다음 줄에 추가:
```js
    "systems/amadeus/templates/chatcard/plot-done.html",
    "systems/amadeus/templates/chatcard/plot-result.html",
```

- [ ] **Step 4: 빌드 확인** — Run: `npm run build`. Expected: `✓ built`.

- [ ] **Step 5: 커밋**
```bash
git add templates/chatcard/plot-done.html templates/chatcard/plot-result.html module/helpers/templates.mjs
git commit -m "feat: add plot done and result chat card templates"
```

---

## Task 5: 소켓 계층 `socket.mjs` + 등록

**Files:**
- Create: `module/initiative/socket.mjs`
- Modify: `module/amadeus.mjs`

소켓 수신은 Foundry Hooks로 UI에 통지한다(`socket.mjs`는 `session.mjs`만 import → 앱과 순환 없음). GM은 `plot-submit`을 받아 활성 세션에 기록하고 `amadeus.plotUpdate` 훅을 발생시킨다.

- [ ] **Step 1: `socket.mjs` 구현** — Create `module/initiative/socket.mjs`:
```js
import { getActiveSession } from "./session.mjs";

export const PLOT_CHANNEL = "system.amadeus";

/** 타입 태그 메시지를 브로드캐스트한다(발신자 제외 전체 수신). */
export function emitPlot(type, payload = {}) {
  game.socket.emit(PLOT_CHANNEL, { type, ...payload });
}

export function registerPlotSocket() {
  game.socket.on(PLOT_CHANNEL, onPlotMessage);
}

function onPlotMessage(data) {
  if (!data?.type) return;
  switch (data.type) {
    case "plot-start":
      Hooks.callAll("amadeus.plotStart", data);
      break;
    case "plot-submit": {
      if (!game.user.isGM) return;
      const session = getActiveSession();
      if (session && !session.revealed && session.id === data.sessionId) {
        session.setValue(data.actorId, data.value);
        Hooks.callAll("amadeus.plotUpdate");
      }
      break;
    }
    case "plot-reveal":
    case "plot-cancel":
      Hooks.callAll("amadeus.plotEnd", data);
      break;
  }
}
```

- [ ] **Step 2: `amadeus.mjs`에서 소켓 등록** — `module/amadeus.mjs` 상단 import 영역(다른 import들 아래)에 추가:
```js
import { registerPlotSocket } from "./initiative/socket.mjs";
```
그리고 `ready` 훅 본문(`Hooks.on("hotbarDrop", ...)` 다음 줄)에 추가:
```js
  registerPlotSocket();
```

- [ ] **Step 3: 빌드·린트 확인** — Run: `npm run build && npm run lint`. Expected: `✓ built`, 신규 error 0.

- [ ] **Step 4: 커밋**
```bash
git add module/initiative/socket.mjs module/amadeus.mjs
git commit -m "feat: add plot socket channel and message routing"
```

---

## Task 6: 플레이어 플롯 프롬프트 (AppV2)

**Files:**
- Create: `module/initiative/plot-prompt.mjs`
- Create: `templates/initiative/plot-prompt.html`
- Modify: `module/amadeus.mjs`

플레이어가 1~6을 골라 제출하는 작은 ApplicationV2. 제출 시 `plot-submit` 소켓 전송 + 최초 1회 "플롯 완료" 카드 게시. 공개 전까지 값 변경 가능.

- [ ] **Step 1: 템플릿 생성** — Create `templates/initiative/plot-prompt.html`:
```html
<div class="plot-prompt">
  <p class="plot-prompt-hint">{{localize "AMADEUS.initiative.promptHint"}}</p>
  <div class="plot-dice">
    {{#each dice as |d|}}
    <button type="button" class="plot-die{{#if d.selected}} selected{{/if}}" data-action="pick" data-value="{{d.value}}">{{d.value}}</button>
    {{/each}}
  </div>
  {{#if selected}}
  <p class="plot-prompt-status">{{localize "AMADEUS.initiative.submitted"}}: {{selected}}</p>
  {{/if}}
</div>
```

- [ ] **Step 2: 앱 구현** — Create `module/initiative/plot-prompt.mjs`:
```js
import { emitPlot } from "./socket.mjs";
import { postCard } from "../chat/chat.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** 플레이어가 플롯 숫자(1~6)를 비밀리에 고르는 프롬프트. */
export class PlotPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "amadeus-plot-prompt",
    classes: ["amadeus", "plot-prompt-app"],
    tag: "div",
    position: { width: 320, height: "auto" },
    window: { title: "AMADEUS.initiative.promptTitle" },
    actions: { pick: PlotPrompt.#onPick },
  };

  static PARTS = { main: { template: "systems/amadeus/templates/initiative/plot-prompt.html" } };

  static #current = null;

  constructor(options) {
    super(options);
    this.sessionId = options.sessionId;
    this.actor = options.actor;
    this.selected = null;
    this.posted = false;
  }

  async _prepareContext() {
    return {
      dice: [1, 2, 3, 4, 5, 6].map((value) => ({ value, selected: value === this.selected })),
      selected: this.selected,
    };
  }

  static #onPick(event, target) {
    this._pick(Number(target.dataset.value));
  }

  async _pick(value) {
    if (!game.users.some((u) => u.isGM && u.active)) {
      ui.notifications.warn(game.i18n.localize("AMADEUS.initiative.noGm"));
      return;
    }
    this.selected = value;
    emitPlot("plot-submit", { sessionId: this.sessionId, actorId: this.actor.id, userId: game.user.id, value });
    if (!this.posted) {
      this.posted = true;
      await postCard({
        actor: this.actor,
        template: "systems/amadeus/templates/chatcard/plot-done.html",
        data: { name: game.user.name },
      });
    }
    this.render();
  }

  /** 현재 유저의 배정 캐릭터로 프롬프트를 연다. */
  static openForUser(sessionId) {
    const actor = game.user.character;
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("AMADEUS.initiative.noCharacter"));
      return;
    }
    PlotPrompt.#current?.close();
    PlotPrompt.#current = new PlotPrompt({ sessionId, actor });
    PlotPrompt.#current.render(true);
  }

  static closeAll() {
    PlotPrompt.#current?.close();
    PlotPrompt.#current = null;
  }
}
```

- [ ] **Step 3: `amadeus.mjs`에서 시작/종료 훅 배선** — `module/amadeus.mjs` import 영역에 추가:
```js
import { PlotPrompt } from "./initiative/plot-prompt.mjs";
```
그리고 `ready` 훅 본문의 `registerPlotSocket();` 다음에 추가:
```js
  Hooks.on("amadeus.plotStart", (data) => {
    if (!game.user.isGM) PlotPrompt.openForUser(data.sessionId);
  });
  Hooks.on("amadeus.plotEnd", () => {
    if (!game.user.isGM) PlotPrompt.closeAll();
  });
```

- [ ] **Step 4: 빌드·린트 확인** — Run: `npm run build && npm run lint`. Expected: `✓ built`, 신규 error 0.

- [ ] **Step 5: 커밋**
```bash
git add module/initiative/plot-prompt.mjs templates/initiative/plot-prompt.html module/amadeus.mjs
git commit -m "feat: add player plot prompt application"
```

---

## Task 7: GM 관리 패널 (AppV2)

**Files:**
- Create: `module/initiative/gm-panel.mjs`
- Create: `templates/initiative/gm-panel.html`

GM이 세션을 운영하는 ApplicationV2. PC(플레이어 소유 character)를 기본 참가자로 잡고, NPC 추가/주사위 입력, 제출 현황(실제 값 표시), 공개(결과 카드 게시), 초기화, 재요청을 제공한다. `amadeus.plotUpdate` 훅으로 재렌더한다.

- [ ] **Step 1: 템플릿 생성** — Create `templates/initiative/gm-panel.html`:
```html
<div class="plot-gm-panel">
  <div class="plot-gm-controls">
    {{#if active}}
      <button type="button" data-action="rerequest">{{localize "AMADEUS.initiative.rerequest"}}</button>
      <button type="button" data-action="reveal">{{localize "AMADEUS.initiative.reveal"}}</button>
      <button type="button" data-action="reset">{{localize "AMADEUS.initiative.reset"}}</button>
    {{else}}
      <button type="button" data-action="start">{{localize "AMADEUS.initiative.start"}}</button>
    {{/if}}
  </div>

  <table class="plot-gm-roster">
    <tbody>
      {{#each participants as |p|}}
      <tr data-actor-id="{{p.actorId}}">
        <td class="plot-p-name">{{p.name}}</td>
        <td class="plot-p-type">{{#if p.isNPC}}{{localize "AMADEUS.initiative.npc"}}{{else}}{{localize "AMADEUS.initiative.pc"}}{{/if}}</td>
        <td class="plot-p-value">
          {{#if p.isNPC}}
            <div class="plot-npc-dice">
              {{#each ../dice as |n|}}
              <button type="button" class="plot-npc-die{{#if (eq n p.value)}} selected{{/if}}" data-action="setNpc" data-actor-id="{{p.actorId}}" data-value="{{n}}">{{n}}</button>
              {{/each}}
            </div>
          {{else}}
            {{#if p.submitted}}<span class="plot-p-submitted">{{p.value}}</span>{{else}}<span class="plot-p-pending">{{localize "AMADEUS.initiative.pending"}}</span>{{/if}}
          {{/if}}
        </td>
        <td class="plot-p-remove"><a data-action="removeParticipant" data-actor-id="{{p.actorId}}"><i class="fas fa-times"></i></a></td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="plot-gm-addnpc">
    <select class="plot-npc-select">
      <option value="">{{localize "AMADEUS.initiative.addNpc"}}</option>
      {{#each npcChoices as |npc|}}<option value="{{npc.id}}">{{npc.name}}</option>{{/each}}
    </select>
    <button type="button" data-action="addNpc">{{localize "AMADEUS.initiative.addNpc"}}</button>
  </div>

  {{#if revealed}}
  <ol class="plot-gm-order">
    {{#each order as |slot|}}
    <li><span class="plot-rank">{{slot.rank}}</span> <span class="plot-value">[{{slot.value}}]</span> {{#each slot.members as |m|}}{{m.name}}{{#unless @last}}, {{/unless}}{{/each}}</li>
    {{/each}}
  </ol>
  {{/if}}
</div>
```

> 주: 템플릿이 `eq` 헬퍼를 쓴다. 이 시스템엔 아직 없으므로 아래 Step 2에서 `templates.mjs`에 추가한다. (NPC 주사위의 현재 선택 표시용.)

- [ ] **Step 2: `eq` 헬퍼 추가** — `module/helpers/templates.mjs`의 `registerHandlebarsHelpers` 함수 안(기존 `checked` 헬퍼 위)에 추가:
```js
  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });
```

- [ ] **Step 3: 앱 구현** — Create `module/initiative/gm-panel.mjs`:
```js
import { PlotSession, getActiveSession, setActiveSession } from "./session.mjs";
import { emitPlot } from "./socket.mjs";
import { postCard } from "../chat/chat.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** GM이 플롯 세션을 운영하는 패널. */
export class PlotGMPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "amadeus-plot-gm-panel",
    classes: ["amadeus", "plot-gm-panel-app"],
    tag: "div",
    position: { width: 460, height: "auto" },
    window: { title: "AMADEUS.initiative.panelTitle" },
    actions: {
      start: PlotGMPanel.#onStart,
      reveal: PlotGMPanel.#onReveal,
      reset: PlotGMPanel.#onReset,
      rerequest: PlotGMPanel.#onRerequest,
      addNpc: PlotGMPanel.#onAddNpc,
      setNpc: PlotGMPanel.#onSetNpc,
      removeParticipant: PlotGMPanel.#onRemoveParticipant,
    },
  };

  static PARTS = { main: { template: "systems/amadeus/templates/initiative/gm-panel.html" } };

  constructor(options) {
    super(options);
    this._onUpdate = () => this.render();
    Hooks.on("amadeus.plotUpdate", this._onUpdate);
  }

  /** @override AppV2 close 훅 */
  async _onClose(options) {
    Hooks.off("amadeus.plotUpdate", this._onUpdate);
    return super._onClose(options);
  }

  async _prepareContext() {
    const session = getActiveSession();
    const participants = session ? [...session.participants.values()] : [];
    const npcIds = new Set(participants.map((p) => p.actorId));
    const npcChoices = game.actors
      .filter((a) => a.type === "npc" && !npcIds.has(a.id))
      .map((a) => ({ id: a.id, name: a.name }));
    return {
      active: !!session,
      revealed: !!session?.revealed,
      participants: participants.map((p) => ({ ...p })),
      dice: [1, 2, 3, 4, 5, 6],
      npcChoices,
      order: session?.revealed ? session.computeOrder() : [],
    };
  }

  // --- actions (this === panel instance) ---

  static #onStart() {
    const session = new PlotSession(foundry.utils.randomID());
    // 플레이어가 소유한 character를 기본 참가자로 등록한다.
    for (const actor of game.actors) {
      if (actor.type !== "character") continue;
      const owner = game.users.find((u) => !u.isGM && actor.testUserPermission(u, "OWNER"));
      if (!owner) continue;
      session.addParticipant({ actorId: actor.id, name: actor.name, isNPC: false, userId: owner.id });
    }
    setActiveSession(session);
    emitPlot("plot-start", { sessionId: session.id });
    this.render();
  }

  static #onRerequest() {
    const session = getActiveSession();
    if (session) emitPlot("plot-start", { sessionId: session.id });
  }

  static async #onReveal() {
    const session = getActiveSession();
    if (!session) return;
    session.revealed = true;
    const order = session.computeOrder();
    const notSubmitted = [...session.participants.values()].filter((p) => !Number.isInteger(p.value)).map((p) => ({ name: p.name }));
    await postCard({
      actor: null,
      template: "systems/amadeus/templates/chatcard/plot-result.html",
      data: { order, notSubmitted },
    });
    emitPlot("plot-reveal", { sessionId: session.id });
    this.render();
  }

  static #onReset() {
    const session = getActiveSession();
    if (session) emitPlot("plot-cancel", { sessionId: session.id });
    setActiveSession(null);
    this.render();
  }

  static #onAddNpc(event, target) {
    const session = getActiveSession();
    if (!session) return;
    const select = target.closest(".plot-gm-addnpc")?.querySelector(".plot-npc-select");
    const id = select?.value;
    if (!id) return;
    const actor = game.actors.get(id);
    if (!actor) return;
    session.addParticipant({ actorId: actor.id, name: actor.name, isNPC: true });
    this.render();
  }

  static #onSetNpc(event, target) {
    const session = getActiveSession();
    if (!session) return;
    session.setValue(target.dataset.actorId, Number(target.dataset.value));
    this.render();
  }

  static #onRemoveParticipant(event, target) {
    const session = getActiveSession();
    if (!session) return;
    session.removeParticipant(target.dataset.actorId);
    this.render();
  }
}
```

> 참고: `postCard`의 `actor: null` → speaker는 기본값(현재 유저=GM). `plot-result.html`은 actor를 쓰지 않는다.

- [ ] **Step 4: 빌드·린트 확인** — Run: `npm run build && npm run lint`. Expected: `✓ built`, 신규 error 0.

- [ ] **Step 5: 커밋**
```bash
git add module/initiative/gm-panel.mjs templates/initiative/gm-panel.html module/helpers/templates.mjs
git commit -m "feat: add GM plot panel application"
```

---

## Task 8: 진입점 — `game.amadeus.plotInitiative` + 씬 컨트롤 버튼

**Files:**
- Modify: `module/amadeus.mjs`

GM이 패널을 여는 신뢰 가능한 함수(`game.amadeus.plotInitiative`)를 노출하고, v13 씬 컨트롤 버튼에서 그 함수를 호출한다.

- [ ] **Step 1: 패널 import + 함수 노출** — `module/amadeus.mjs` import 영역에 추가:
```js
import { PlotGMPanel } from "./initiative/gm-panel.mjs";
```
`ready` 훅 본문 끝(플롯 훅 배선 다음)에 추가:
```js
  game.amadeus.plotInitiative = () => {
    if (!game.user.isGM) return ui.notifications.warn("GM only");
    new PlotGMPanel().render(true);
  };
```
> 주: `game.amadeus`는 `init` 훅에서 `{ AmadeusActor, AmadeusItem, rollItemMacro }`로 생성된다. `ready`에서 속성 추가는 안전하다.

- [ ] **Step 2: v13 씬 컨트롤 버튼 등록** — `module/amadeus.mjs` 파일 하단(`createItemMacro`/`rollItemMacro` 함수 정의들과 같은 최상위 스코프, ready 훅 밖)에 추가. v13에서 `getSceneControlButtons` 훅은 **이름으로 키된 객체**를 받고, 각 control의 `tools`도 이름으로 키된 객체다:
```js
/* -------------------------------------------- */
/*  Scene Controls (GM: 플롯 이니셔티브)         */
/* -------------------------------------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  controls.amadeusPlot = {
    name: "amadeusPlot",
    title: "AMADEUS.initiative.panelTitle",
    icon: "fas fa-dice",
    layer: "tokens",
    tools: {
      open: {
        name: "open",
        title: "AMADEUS.initiative.panelTitle",
        icon: "fas fa-dice",
        button: true,
        onClick: () => game.amadeus.plotInitiative(),
      },
    },
    activeTool: "open",
  };
});
```
> 검증 시 v13 빌드에서 좌측 툴바에 주사위 컨트롤이 GM에게만 보이고, 클릭 시 패널이 열리는지 확인한다. 만약 v13 빌드의 컨트롤 구조가 달라 버튼이 안 보이면, `game.amadeus.plotInitiative()`를 매크로로 실행하는 대체 경로가 항상 동작한다(Step 1).

- [ ] **Step 3: 빌드·린트 확인** — Run: `npm run build && npm run lint`. Expected: `✓ built`, 신규 error 0.

- [ ] **Step 4: 커밋**
```bash
git add module/amadeus.mjs
git commit -m "feat: expose plotInitiative and add GM scene control"
```

---

## Task 9: 최종 통합 검증

**Files:** (없음 — 검증만)

- [ ] **Step 1: 정적 검증 일괄 실행** — Run: `npm run build && npm test && npm run lint`. Expected: `✓ built`, 모든 테스트 PASS, 신규 error 0.

- [ ] **Step 2: 멀티 클라이언트 수동 스모크** — `dist/` 배포 후 GM 1 + 플레이어 1(이상)로:
  - [ ] GM: 좌측 씬 컨트롤(또는 `game.amadeus.plotInitiative()` 매크로)로 패널 오픈 → 플레이어 소유 character가 참가자로 표시
  - [ ] GM "플롯 시작" → 플레이어 클라이언트에 플롯 프롬프트 자동 오픈
  - [ ] 플레이어가 숫자 클릭 → 공개 챗 "〈PL명〉 플롯 완료" 표시, GM 패널에 해당 PC의 **실제 값** 표시(다른 플레이어 화면엔 값 미표시)
  - [ ] 플레이어가 다른 숫자 재클릭 → GM 패널 값 갱신, 중복 "플롯 완료" 카드 없음
  - [ ] GM이 NPC 추가 + 1~6 버튼으로 NPC 값 지정
  - [ ] GM "공개" → 결과 챗 카드(낮은 수 먼저, 동값 같은 슬롯, 미제출 별도 표기) 전원 표시, 플레이어 프롬프트 닫힘
  - [ ] GM "재요청" → 프롬프트 다시 열림 / GM "초기화" → 세션 리셋
  - [ ] 비-GM에게 씬 컨트롤 버튼이 보이지 않음

- [ ] **Step 3: (선택) handoff 메모** — 필요 시 `docs/superpowers/`에 기능 추가 handoff 작성. SCSS 스타일(`.plot-*` 셀렉터)은 디자인 리뉴얼 시 적용.
