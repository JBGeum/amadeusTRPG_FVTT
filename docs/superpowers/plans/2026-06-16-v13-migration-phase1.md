# v13 마이그레이션 Phase 1 구현 계획 (deprecated API 정리)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Foundry v13에서 제거·deprecated된 전역/호출 API를 v13 네임스페이스로 치환하되, 시트는 AppV1 호환 레이어로 유지해 동작을 보존한다.

**Architecture:** 데이터/시트 구조는 건드리지 않고 API 참조만 치환하는 저위험 리팩토링. 변경 후 `npm run build`(Vite 번들 성공)와 `npm run lint`(신규 에러 없음)로 정적 검증하고, Phase 종료 시 v13에서 수동 시나리오로 동작을 확인한다.

**Tech Stack:** Foundry VTT v13, ES modules, Vite 8, ESLint 10.

---

## 검증 방식 (이 Phase의 모든 Task 공통)

이 프로젝트는 Foundry 런타임 전역에 의존하여 단위 테스트가 없다. 각 Task의 검증은 다음으로 한다:

- `npm run build` → `✓ built` 출력, 오류 없음
- `npm run lint` → 해당 파일에서 **새로운 에러가 늘지 않음**(기존 경고/에러는 Phase 2 이후 대상)

`foundry.*` 네임스페이스는 런타임에만 존재하므로 ESLint globals에 추가해 `no-undef`를 피한다(Task 1에서 선반영).

## 파일 구조

| 파일 | 책임 | 변경 |
|------|------|------|
| `eslint.config.js` | 린트 설정 | `foundry`/`CONST` 전역은 이미 등록됨 — 확인만 |
| `module/documents/roll.mjs` | 굴림 헬퍼 | `evaluate({async})` 제거 |
| `module/helpers/templates.mjs` | 템플릿 프리로드/헬퍼 | `loadTemplates` 네임스페이스화 |
| `module/documents/item.mjs` | Item 문서 | `renderTemplate`(4곳), `type:3`→`style` |
| `module/documents/actor.mjs` | Actor 문서 | `renderTemplate`(1곳) |
| `module/sheets/item-sheet.mjs` | Item 시트(AppV1) | `mergeObject`, `extends` 네임스페이스화 |
| `module/sheets/actor-sheet.mjs` | Actor 시트(AppV1) | `mergeObject`, `duplicate`, `DEFAULT_TOKEN`, `extends` |
| `module/amadeus.mjs` | 진입점/등록 | `Actors`/`Items`/코어 시트 네임스페이스화 |

---

## Task 1: ESLint 전역 확인 및 roll.mjs evaluate 수정

**Files:**
- Verify: `eslint.config.js`
- Modify: `module/documents/roll.mjs:8`

- [ ] **Step 1: ESLint 전역에 `foundry`, `CONST`가 있는지 확인**

`eslint.config.js`의 Foundry 전역 블록에 `foundry: "readonly"`와 `CONST: "readonly"`가 이미 있다(이전 작업에서 등록됨). 없으면 추가한다. 본 Phase에서 새로 쓰는 네임스페이스는 모두 `foundry.*` 또는 `CONST.*`이므로 이 두 개면 충분하다.

- [ ] **Step 2: roll.mjs의 evaluate 옵션 제거**

`module/documents/roll.mjs`의 8번째 줄을 변경한다.

변경 전:
```javascript
    await roll.evaluate({async: true});
```

변경 후:
```javascript
    await roll.evaluate();
```

- [ ] **Step 3: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built` 출력. `roll.mjs`에 에러 없음.

---

## Task 2: helpers/templates.mjs — loadTemplates 네임스페이스화

**Files:**
- Modify: `module/helpers/templates.mjs:7`

- [ ] **Step 1: loadTemplates 호출을 네임스페이스로 치환**

`module/helpers/templates.mjs`의 7번째 줄을 변경한다.

변경 전:
```javascript
  return loadTemplates([
```

변경 후:
```javascript
  return foundry.applications.handlebars.loadTemplates([
```

> 참고: 같은 파일의 `getBond`/`getSupporter` 헬퍼의 `index` 미정의 버그는 Phase 2(스키마/계산 정리) 또는 별도 수정 대상이며, 이 Task에서는 건드리지 않는다.

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `templates.mjs`에 **새로운** 에러 없음(기존 `index` 에러는 그대로 남아 있을 수 있음).

---

## Task 3: documents/item.mjs — renderTemplate(4곳) + type:3 → style

**Files:**
- Modify: `module/documents/item.mjs` (108, 122, 151, 166번째 줄의 `renderTemplate`; 160번째 줄의 `type: 3`)

- [ ] **Step 1: 4개의 renderTemplate 호출을 네임스페이스로 치환**

`module/documents/item.mjs`에서 `renderTemplate(`을 `foundry.applications.handlebars.renderTemplate(`로 모두 치환한다. 해당 4개 라인은 다음과 같다(각각 동일 패턴):

변경 전 / 후 (4곳 모두 `await renderTemplate(` → `await foundry.applications.handlebars.renderTemplate(`):
```javascript
// 108: getGiftChatCard
let content = await foundry.applications.handlebars.renderTemplate("systems/amadeus/templates/chatcard/data-gift.html", templateData)
// 122: getItemChatCard
let content = await foundry.applications.handlebars.renderTemplate("systems/amadeus/templates/chatcard/data-item.html", templateData)
// 151: getItemRollCard
content = await foundry.applications.handlebars.renderTemplate("systems/amadeus/templates/chatcard/roll-gift.html", templateData)
// 166: _getGiftChatCard
let content = await foundry.applications.handlebars.renderTemplate("systems/amadeus/templates/chatcard/roll-gift.html", templateData)
```

- [ ] **Step 2: ChatMessage type:3 → style: EMOTE**

`module/documents/item.mjs`의 `getItemRollCard` 내 `ChatMessage.create` 호출(156-161줄 부근)을 변경한다.

변경 전:
```javascript
      ChatMessage.create({
        content,
        flavor: ablLabel + "판정",
        speaker: speaker,
        type: 3
      })
```

변경 후:
```javascript
      ChatMessage.create({
        content,
        flavor: ablLabel + "판정",
        speaker: speaker,
        style: CONST.CHAT_MESSAGE_STYLES.EMOTE
      })
```

> `type: 3`은 `CHAT_MESSAGE_TYPES.EMOTE`였다. v13에서 `type` → `style`로 이름이 바뀌었고 EMOTE 값은 `CONST.CHAT_MESSAGE_STYLES.EMOTE`다. **이 치환이 기존 표시(speaker를 행동 주체로 표시)를 유지하는지는 Phase 1 수동 검증(Task 8)에서 실측 확인한다.**

- [ ] **Step 3: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `item.mjs`에 새 에러 없음.

---

## Task 4: documents/actor.mjs — renderTemplate

**Files:**
- Modify: `module/documents/actor.mjs:243`

- [ ] **Step 1: renderTemplate 호출 치환**

`module/documents/actor.mjs`의 243번째 줄(`rollAmadeAbl` 내)을 변경한다.

변경 전:
```javascript
    let content = await renderTemplate("systems/amadeus/templates/chatcard/roll-amadeabl.html", templateData)
```

변경 후:
```javascript
    let content = await foundry.applications.handlebars.renderTemplate("systems/amadeus/templates/chatcard/roll-amadeabl.html", templateData)
```

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `actor.mjs`에 새 에러 없음.

---

## Task 5: sheets/item-sheet.mjs — mergeObject + extends 네임스페이스화

**Files:**
- Modify: `module/sheets/item-sheet.mjs:5`, `module/sheets/item-sheet.mjs:9`

- [ ] **Step 1: extends를 AppV1 네임스페이스로 치환**

`module/sheets/item-sheet.mjs`의 5번째 줄을 변경한다.

변경 전:
```javascript
export class AmadeusItemSheet extends ItemSheet {
```

변경 후:
```javascript
export class AmadeusItemSheet extends foundry.appv1.sheets.ItemSheet {
```

- [ ] **Step 2: mergeObject 치환**

같은 파일 9번째 줄을 변경한다.

변경 전:
```javascript
    return mergeObject(super.defaultOptions, {
```

변경 후:
```javascript
    return foundry.utils.mergeObject(super.defaultOptions, {
```

- [ ] **Step 3: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `item-sheet.mjs`에 새 에러 없음.

---

## Task 6: sheets/actor-sheet.mjs — mergeObject + duplicate + DEFAULT_TOKEN + extends

**Files:**
- Modify: `module/sheets/actor-sheet.mjs:7`, `:13`, `:108`, `:287`

- [ ] **Step 1: extends를 AppV1 네임스페이스로 치환**

`module/sheets/actor-sheet.mjs`의 7번째 줄을 변경한다.

변경 전:
```javascript
export class AmadeusActorSheet extends ActorSheet {
```

변경 후:
```javascript
export class AmadeusActorSheet extends foundry.appv1.sheets.ActorSheet {
```

- [ ] **Step 2: mergeObject 치환 (13번째 줄)**

변경 전:
```javascript
    return mergeObject(super.defaultOptions, {
```

변경 후:
```javascript
    return foundry.utils.mergeObject(super.defaultOptions, {
```

- [ ] **Step 3: DEFAULT_TOKEN 치환 (108번째 줄)**

변경 전:
```javascript
      i.img = i.img || DEFAULT_TOKEN;
```

변경 후:
```javascript
      i.img = i.img || CONST.DEFAULT_TOKEN;
```

- [ ] **Step 4: duplicate 치환 (287번째 줄)**

변경 전:
```javascript
    const data = duplicate(header.dataset);
```

변경 후:
```javascript
    const data = foundry.utils.duplicate(header.dataset);
```

- [ ] **Step 5: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `actor-sheet.mjs`에 새 에러 없음.

---

## Task 7: amadeus.mjs — Actors/Items/코어 시트 네임스페이스화

**Files:**
- Modify: `module/amadeus.mjs:47-50`

- [ ] **Step 1: 시트 등록 블록을 네임스페이스로 치환**

`module/amadeus.mjs`의 47-50번째 줄(시트 register/unregister)을 변경한다.

변경 전:
```javascript
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("amadeus", AmadeusActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("amadeus", AmadeusItemSheet, { makeDefault: true });
```

변경 후:
```javascript
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("amadeus", AmadeusActorSheet, { makeDefault: true });
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("amadeus", AmadeusItemSheet, { makeDefault: true });
```

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `amadeus.mjs`에 새 에러 없음.

---

## Task 8: v13 수동 검증 및 Phase 1 커밋

**Files:** (변경 없음 — 검증 및 커밋)

- [ ] **Step 1: 빌드 산출물 생성 확인**

Run: `npm run build`
Expected: `dist/amadeus.mjs`와 `dist/amadeus.css`가 생성됨.

- [ ] **Step 2: v13에 시스템 로드 후 수동 시나리오 확인**

로컬 Foundry v13에서 새 world를 만들고 Amadeus 시스템을 로드한 뒤 다음을 확인한다:

1. 시스템 로드 시 콘솔에 이 Phase에서 치환한 API 관련 deprecation 경고가 없음
2. 캐릭터 시트와 NPC 시트가 정상적으로 열림 (AppV1 호환 레이어)
3. 능력치 굴림 → 챗카드 표시
4. 기프트/아이템 굴림 및 데이터 챗카드 표시
5. **`getItemRollCard` 굴림 카드의 EMOTE 표시(speaker 형태)가 기존과 동일한지 확인** ← `type:3`→`style` 치환의 핵심 검증
6. 부모신(parent) 드롭 → 능력치 + 속성 복사
7. rolltable draw
8. 아이템 생성/삭제, 체크박스/메모 변경 반영

문제가 발견되면 해당 Task로 돌아가 수정한 뒤 이 검증을 반복한다.

- [ ] **Step 3: Phase 1 커밋**

검증 통과 후 변경 전체를 한 커밋으로 묶는다.

```bash
git add module/
git commit -m "refactor: replace deprecated APIs with v13 namespaces"
```

> 커밋 메시지는 Conventional Commits 접두어 + 한 줄 영어 요약, co-author·세부나열 없음(프로젝트 선호).

---

## Self-Review (작성자 체크 결과)

- **Spec 커버리지**: Phase 1 매핑 표의 9개 항목 전부 Task 1~7에 대응됨(evaluate=T1, loadTemplates=T2, renderTemplate+type:3=T3/T4, mergeObject/duplicate/DEFAULT_TOKEN/extends=T5/T6, Actors/Items=T7). EMOTE 실측 확인=T8.
- **Placeholder**: 모든 코드 step에 실제 before/after 코드 포함. "추후 구현" 없음.
- **타입 일관성**: `foundry.applications.handlebars.renderTemplate`/`loadTemplates`, `foundry.utils.mergeObject`/`duplicate`, `foundry.appv1.sheets.ActorSheet`/`ItemSheet`, `foundry.documents.collections.Actors`/`Items`, `CONST.DEFAULT_TOKEN`, `CONST.CHAT_MESSAGE_STYLES.EMOTE` — 표기가 Task 전반에서 일관됨.
