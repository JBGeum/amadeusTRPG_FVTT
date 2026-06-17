# Amadeus 전체 리팩토링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v13 마이그레이션 직후 코드베이스에서 흩어진 굴림/챗카드 로직을 통합하고, 죽은 코드·중복 룩업·알려진 버그를 제거해 기능 추가가 쉬운 토대를 만든다.

**Architecture:** 하이브리드. Foundry 비의존 순수 로직(주사위 수/해석/초기치 계산)을 `module/dice/resolution.mjs`로 추출해 Vitest로 고정하고, Foundry 결합 부수효과(Roll 생성·챗 렌더)는 `module/chat/chat.mjs` 공유 헬퍼 + 문서 메서드로 모은다. 시트는 위임만 남긴다.

**Tech Stack:** Foundry VTT v13, ApplicationV2, Vite 8, Vitest(신규), ESLint flat config.

**참고 문서:** 설계 spec `docs/superpowers/specs/2026-06-17-full-refactor-design.md`. 동작·외형은 보존하고 내부 구조만 바꾼다(예외: 명시된 알려진 버그 수정). SCSS 리뉴얼·NpcData 확장은 범위 밖.

**Phase 의존성:** Phase 0/1은 독립. Phase 2는 0 의존. Phase 3은 0·2 의존. Phase 4는 독립. 각 Task는 단독 커밋.

**공통 검증 명령:**
- 빌드: `npm run build` (Expected: `✓ built` 출력, 에러 없음)
- 린트: `npm run lint` (Expected: 신규 error 0. 기존 경고는 무방)
- 테스트: `npm test` (Expected: 모든 테스트 PASS)

---

## Phase 0 — 테스트 안전망

### Task 1: Vitest 도입

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`

- [ ] **Step 1: vitest devDependency 설치**

Run:
```bash
npm install -D vitest@^3
```
Expected: `package.json`의 devDependencies에 `vitest` 추가, 설치 성공.

- [ ] **Step 2: `package.json`에 test 스크립트 추가**

`scripts` 블록의 `"build": "vite build",` 다음 줄에 추가:
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: `vitest.config.js` 생성**

`@foundryvtt/foundryvtt-cli`나 Foundry 전역 없이 node 환경에서 순수 모듈만 테스트한다. 별도 config로 vite 라이브러리 빌드 설정과 분리한다.
```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.mjs"],
  },
});
```

- [ ] **Step 4: 동작 확인용 임시 sanity 테스트 생성**

Create `test/sanity.test.mjs`:
```js
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 테스트 실행 확인**

Run: `npm test`
Expected: PASS (1 test passed). 실패하면 vitest 설치/config 경로 확인.

- [ ] **Step 6: 임시 테스트 제거**

Run:
```bash
rm test/sanity.test.mjs
```

- [ ] **Step 7: 커밋**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add vitest test runner"
```

---

### Task 2: 순수 로직 모듈 `resolution.mjs` 추출 + 테스트

**Files:**
- Create: `module/dice/resolution.mjs`
- Create: `test/resolution.test.mjs`

`config.mjs`(순수 JS)에서 rank/mod 룩업을 가져오고, 생명력/소지금 테이블은 이 모듈이 소유한다(`_fields.mjs`는 foundry 결합이라 node 테스트 불가하므로 이쪽으로 이전). 현재 동작과 1:1.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/resolution.test.mjs`:
```js
import { describe, it, expect } from "vitest";
import {
  diceCountForRank,
  resolveDie,
  rankVal,
  modVal,
  initHealth,
  initMoney,
} from "../module/dice/resolution.mjs";

describe("diceCountForRank", () => {
  it("maps ranks to dice counts", () => {
    expect(diceCountForRank("S")).toBe(4);
    expect(diceCountForRank("A")).toBe(3);
    expect(diceCountForRank("B")).toBe(2);
    expect(diceCountForRank("C")).toBe(1);
  });
  it("treats D as a 2-dice exception", () => {
    expect(diceCountForRank("D")).toBe(2);
  });
});

describe("resolveDie", () => {
  it("returns fumble on 1 regardless of mod/dc", () => {
    expect(resolveDie(1, 3, 4)).toBe("fumble");
  });
  it("returns special on 6 regardless of mod/dc", () => {
    expect(resolveDie(6, -2, 4)).toBe("special");
  });
  it("returns success when die+mod >= dc", () => {
    expect(resolveDie(3, 1, 4)).toBe("success");
  });
  it("returns fail when die+mod < dc", () => {
    expect(resolveDie(3, 0, 4)).toBe("fail");
  });
});

describe("rankVal / modVal", () => {
  it("maps rank letters to numeric value", () => {
    expect(rankVal("S")).toBe(4);
    expect(rankVal("D")).toBe(0);
  });
  it("maps mod letters to numeric value", () => {
    expect(modVal("+++")).toBe(3);
    expect(modVal(" ")).toBe(0);
    expect(modVal("--")).toBe(-2);
  });
  it("returns 0 for unknown keys", () => {
    expect(rankVal("Z")).toBe(0);
    expect(modVal("?")).toBe(0);
  });
});

describe("initHealth / initMoney", () => {
  const ability = {
    warfare: { rank: "A", mod: "+" },   // 7 + 1
    spirit: { rank: "B", mod: " " },    // 5 + 0
    love: { rank: "C", mod: "++" },     // money: 3 + 2
    mundane: { rank: "D", mod: "-" },   // money: 2 + (-1)
  };
  it("sums warfare + spirit rank/mod for health", () => {
    // 7 + 1 + 5 + 0 = 13
    expect(initHealth(ability)).toBe(13);
  });
  it("sums love + mundane rank/mod for money", () => {
    // love C(3)+ ++(2) = 5 ; mundane D(2) + -(-1) = 1 ; total 6
    expect(initMoney(ability)).toBe(6);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../module/dice/resolution.mjs'`

- [ ] **Step 3: `resolution.mjs` 구현**

Create `module/dice/resolution.mjs`:
```js
// Foundry 전역(game/Roll/ChatMessage)을 절대 참조하지 않는 순수 모듈.
// Vitest(node)에서 그대로 import 가능해야 한다.
import { AMADEUS } from "../helpers/config.mjs";

// 생명력/소지금 가산 테이블 (구 _fields.mjs에서 이전 — 순수 데이터).
const HEALTH_BY_RANK = { S: 10, A: 7, B: 5, C: 3, D: 1 };
const HEALTH_BY_MOD = { "+++": 6, "++": 3, "+": 1, " ": 0, "-": -1, "--": -2 };
const MONEY_BY_RANK = { S: 7, A: 5, B: 4, C: 3, D: 2 };
const MONEY_BY_MOD = { "+++": 3, "++": 2, "+": 1, " ": 0, "-": -1, "--": -2 };

/** 능력치 랭크 → 굴릴 d6 개수. D는 예외적으로 2d6. */
export function diceCountForRank(rank) {
  if (rank === "D") return 2;
  return AMADEUS.rank[rank] ?? 0;
}

/** 주사위 1개 판정. 1=펌블, 6=스페셜이 dc 비교보다 우선. */
export function resolveDie(die, modVal, dc) {
  if (die === 1) return "fumble";
  if (die === 6) return "special";
  return die + modVal >= dc ? "success" : "fail";
}

/** 랭크 문자 → 숫자값 (S4..D0). */
export function rankVal(rank) {
  return AMADEUS.rank[rank] ?? 0;
}

/** 수정치 문자 → 숫자값 (+++3..---2). */
export function modVal(mod) {
  return AMADEUS.modL[mod] ?? 0;
}

/** 생명력 초기치: warfare + spirit 의 (랭크+수정치) 합. */
export function initHealth(ability) {
  return (
    (HEALTH_BY_RANK[ability.warfare.rank] ?? 0) + (HEALTH_BY_MOD[ability.warfare.mod] ?? 0) +
    (HEALTH_BY_RANK[ability.spirit.rank] ?? 0) + (HEALTH_BY_MOD[ability.spirit.mod] ?? 0)
  );
}

/** 소지금 초기치: love + mundane 의 (랭크+수정치) 합. */
export function initMoney(ability) {
  return (
    (MONEY_BY_RANK[ability.love.rank] ?? 0) + (MONEY_BY_MOD[ability.love.mod] ?? 0) +
    (MONEY_BY_RANK[ability.mundane.rank] ?? 0) + (MONEY_BY_MOD[ability.mundane.mod] ?? 0)
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (모든 resolution 테스트 통과).

- [ ] **Step 5: 린트 확인**

Run: `npm run lint`
Expected: 신규 error 0.

- [ ] **Step 6: 커밋**

```bash
git add module/dice/resolution.mjs test/resolution.test.mjs
git commit -m "test: add pure dice resolution module with unit tests"
```

> 참고: 이 시점에 `resolution.mjs`는 추출만 됐고 아직 아무도 사용하지 않는다. `_fields.mjs`/`actor-character.mjs`/`templates.mjs`의 기존 로직과 값이 중복 상태다. Phase 2에서 그들을 이 모듈로 배선해 중복을 제거한다.

---

## Phase 1 — 죽은 코드 / 버그 제거

### Task 3: `item.mjs` 죽은 코드 정리

**Files:**
- Modify: `module/documents/item.mjs`

`getAmadeDiceCard`(주석 죽은코드 포함), `_getGiftChatCard`(미사용 중복), `getItemDataCard`의 빈 `if` 분기, 미사용 `getKeybyValue` import를 제거한다. `roll()`/`getItemDataCard`/`getGiftChatCard`/`getItemChatCard`/`getItemRollCard`는 사용 중이므로 유지.

- [ ] **Step 1: `getKeybyValue` import 제거**

`module/documents/item.mjs` 상단의 다음 줄을 삭제:
```js
import {getKeybyValue} from "../helpers/config.mjs";
```

- [ ] **Step 2: `getItemDataCard`의 빈 분기 제거**

`getItemDataCard` 내 타입 분기를 다음으로 교체(빈 background/parent 분기 삭제):
```js
    //타입별로 챗 카드 처리
    if (this.type === "gift") {
      content = await this.getGiftChatCard(this);
    } else if (this.type === "weapon" || this.type === "gear") {
      content = await this.getItemChatCard(this);
    }
```

- [ ] **Step 3: `_getGiftChatCard` 메서드 삭제**

`module/documents/item.mjs`에서 다음 메서드 전체를 삭제:
```js
  async _getGiftChatCard(templateData) {
    let content = await foundry.applications.handlebars.renderTemplate("systems/amadeus/templates/chatcard/roll-gift.html", templateData)
    return content;
  }
```

- [ ] **Step 4: `getAmadeDiceCard` 메서드 삭제**

`module/documents/item.mjs`에서 `getAmadeDiceCard(diceset, ...)` 메서드 전체(주석 블록 포함, 클래스 닫는 `}` 직전까지)를 삭제. 또한 `getItemRollCard` 내부의 죽은 주석도 삭제:
```js
    //let content = await this.getAmadeDiceCard(resultDiceset, rollData); //목표치 넣기
```
및
```js
    //const rollAbl = getKeybyValue(CONFIG.AMADEUS.ability,this.system.action.ability);
    // AMADEUS.ability.warfare -> warfare
```

- [ ] **Step 5: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, 신규 error 0 (특히 `no-empty` 경고 2건 해소).

- [ ] **Step 6: 커밋**

```bash
git add module/documents/item.mjs
git commit -m "refactor: remove dead code from item document"
```

---

### Task 4: `templates.mjs` 죽은 헬퍼/프리로드 정리

**Files:**
- Modify: `module/helpers/templates.mjs`

`getBond`/`getSupporter` 헬퍼는 어떤 템플릿도 사용하지 않으며 `index` 미정의 실버그다 → 삭제. preload 목록의 `actor-spells.html`은 참조 없음 → 제거. (`actor-features.html`은 `actor-character-sheet.html`에서 사용 중 → 유지.)

- [ ] **Step 1: `getBond`/`getSupporter` 헬퍼 삭제**

`module/helpers/templates.mjs`에서 다음 두 헬퍼 전체를 삭제:
```js
  Handlebars.registerHelper('getBond', function(n, system, block) {
    const bond = { "index": index, "bond": system.bond[index]}
    return bond;
  });
  Handlebars.registerHelper('getSupporter', function(n, system, block) {
    const supporter = { "index": index, "bond": system.supporter[index]}
    return supporter;
  });
```

- [ ] **Step 2: preload 목록에서 죽은 partial 제거**

`preloadHandlebarsTemplates`의 배열에서 다음 줄을 삭제:
```js
    "systems/amadeus/templates/actor/parts/actor-spells.html",
```

- [ ] **Step 3: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, `no-undef`(index) error 해소.

- [ ] **Step 4: 커밋**

```bash
git add module/helpers/templates.mjs
git commit -m "refactor: remove unused handlebars helpers and dead preload"
```

---

### Task 5: `config.mjs` 미사용 유틸 제거

**Files:**
- Modify: `module/helpers/config.mjs`

`getKeybyValue`의 마지막 참조(item.mjs 주석)가 Task 3에서 제거됐으므로 안전하게 삭제.

- [ ] **Step 1: `getKeybyValue` 삭제**

`module/helpers/config.mjs` 끝의 다음 함수를 삭제:
```js
export function getKeybyValue(obj, value) {
    return Object.keys(obj).find(key => obj[key] === value);
}
```

- [ ] **Step 2: 잔존 참조 없음 확인**

Run: `grep -rn "getKeybyValue" module/`
Expected: 출력 없음(0건).

- [ ] **Step 3: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, 신규 error 0.

- [ ] **Step 4: 커밋**

```bash
git add module/helpers/config.mjs
git commit -m "refactor: drop unused getKeybyValue util"
```

---

### Task 6: `amadeus.mjs` 정리 + 핫바 매크로 버그 수정

**Files:**
- Modify: `module/amadeus.mjs`
- Modify: `module/helpers/templates.mjs`

nd6 시스템과 무관한 `CONFIG.Combat.initiative`(d20 공식) 제거, 인라인 `concat`/`toLowerCase` 헬퍼를 `templates.mjs`로 이전(등록 일원화), `rollItemMacro`를 `game.amadeus`에 노출(핫바 매크로가 `game.amadeus.rollItemMacro`를 호출하나 미노출 → 깨진 상태. 버그 수정).

- [ ] **Step 1: `concat`/`toLowerCase` 헬퍼를 `templates.mjs`로 이전**

`module/helpers/templates.mjs`의 `registerHandlebarsHelpers` 함수 안(기존 `checked` 헬퍼 위)에 추가:
```js
  Handlebars.registerHelper("concat", function (...args) {
    // 마지막 인자는 Handlebars options 객체이므로 제외한다.
    return args.slice(0, -1).join("");
  });
  Handlebars.registerHelper("toLowerCase", function (str) {
    return String(str).toLowerCase();
  });
```

- [ ] **Step 2: `amadeus.mjs`의 인라인 헬퍼 등록 제거**

`module/amadeus.mjs`에서 다음 블록 전체(주석 포함)를 삭제:
```js
// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper('concat', function() {
  var outStr = '';
  for (var arg in arguments) {
    if (typeof arguments[arg] != 'object') {
      outStr += arguments[arg];
    }
  }
  return outStr;
});

Handlebars.registerHelper('toLowerCase', function(str) {
  return str.toLowerCase();
});
```

- [ ] **Step 3: nd6 무관 initiative 설정 제거**

`module/amadeus.mjs`에서 다음 블록을 삭제(원작자 주석대로 컴뱃 트래커 미사용):
```js
  /**
   * Set an initiative formula for the system
   * @type {String}
   * schmm 컴뱃트레커와 이니셔티브는 쓸 일 없을듯
   */
  CONFIG.Combat.initiative = {
    formula: "1d20 + @abilities.dex.mod",
    decimals: 2
  };
```

- [ ] **Step 4: `rollItemMacro`를 `game.amadeus`에 노출**

`module/amadeus.mjs`의 `init` 훅에서 `game.amadeus` 할당을 다음으로 교체:
```js
  game.amadeus = {
    AmadeusActor,
    AmadeusItem,
    rollItemMacro,
  };
```
(`rollItemMacro` 함수 정의는 파일 하단에 이미 존재하며 호이스팅되므로 init에서 참조 가능하다.)

- [ ] **Step 5: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, 신규 error 0.

- [ ] **Step 6: Foundry 수동 스모크**

Foundry에 `dist/` 배포 후: 아이템을 핫바로 드래그 → 매크로 클릭 시 아이템 굴림이 정상 동작(이전엔 `game.amadeus.rollItemMacro is not a function` 오류). 챗카드 출력 정상.

- [ ] **Step 7: 커밋**

```bash
git add module/amadeus.mjs module/helpers/templates.mjs
git commit -m "fix: expose rollItemMacro and consolidate handlebars helper registration"
```

---

### Task 7: 레거시 템플릿 파일 삭제

**Files:**
- Delete: `templates/item/item-sheet.html`
- Delete: `templates/item/item-spell-sheet.html`
- Delete: `templates/item/item-feature-sheet.html`
- Delete: `templates/actor/parts/actor-spells.html`

현 Item 타입/PARTS와 partial include 어디에도 참조 없는 boilerplate 잔재.

- [ ] **Step 1: 참조 없음 재확인**

Run:
```bash
grep -rn "item-sheet.html\|item-spell-sheet\|item-feature-sheet\|actor-spells" templates/ module/
```
Expected: 출력 없음(Task 4에서 preload도 제거됨).

- [ ] **Step 2: 파일 삭제**

Run:
```bash
git rm templates/item/item-sheet.html templates/item/item-spell-sheet.html templates/item/item-feature-sheet.html templates/actor/parts/actor-spells.html
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: `✓ built` (정적 복사 대상이 줄어도 에러 없음).

- [ ] **Step 4: Foundry 수동 스모크**

모든 Item 타입(gift/background/parent/weapon/gear/memory/treasure) 시트 + Actor 시트가 정상 렌더되는지 확인(삭제된 템플릿이 실제로 미사용이었음을 검증).

- [ ] **Step 5: 커밋**

```bash
git commit -m "chore: remove legacy boilerplate templates"
```

---

## Phase 2 — Config / 룩업 단일화

### Task 8: `_fields.mjs` 중복 룩업 제거, DataModel을 `resolution.mjs`로 배선

**Files:**
- Modify: `module/data/_fields.mjs`
- Modify: `module/data/actor-character.mjs`

`_fields.mjs`의 `RANK_VAL`/`MOD_VAL`은 `config.mjs`의 `AMADEUS.rank`/`AMADEUS.modL`과 값이 동일한 중복이고, `HEALTH_*`/`MONEY_*`는 Task 2에서 `resolution.mjs`로 이전됐다. `_fields.mjs`는 스키마 헬퍼만 남기고, `CharacterData.prepareDerivedData`는 `resolution.mjs` 순수 함수를 사용한다.

- [ ] **Step 1: `_fields.mjs`에서 룩업 상수 전부 삭제**

`module/data/_fields.mjs`에서 다음 블록(26~36행, 룩업 상수들)을 모두 삭제:
```js
// --- 파생 계산용 룩업 (기존 actor.mjs의 switch 테이블을 상수화) ---
export const RANK_VAL = { S: 4, A: 3, B: 2, C: 1, D: 0 };
export const MOD_VAL = { "+++": 3, "++": 2, "+": 1, " ": 0, "-": -1, "--": -2 };

// 생명력: 랭크/수정치별 가산치
export const HEALTH_BY_RANK = { S: 10, A: 7, B: 5, C: 3, D: 1 };
export const HEALTH_BY_MOD = { "+++": 6, "++": 3, "+": 1, " ": 0, "-": -1, "--": -2 };

// 소지금: 랭크/수정치별 가산치
export const MONEY_BY_RANK = { S: 7, A: 5, B: 4, C: 3, D: 2 };
export const MONEY_BY_MOD = { "+++": 3, "++": 2, "+": 1, " ": 0, "-": -1, "--": -2 };
```
삭제 후 `_fields.mjs`에는 `abilityField`/`abilitiesField`와 `RANKS`/`MODS` 상수만 남는다.

- [ ] **Step 2: `actor-character.mjs`의 import 교체**

`module/data/actor-character.mjs` 1행을 교체:
```js
import { abilitiesField } from "./_fields.mjs";
import { rankVal, modVal, initHealth, initMoney } from "../dice/resolution.mjs";
```

- [ ] **Step 3: `prepareDerivedData`를 순수 함수 사용으로 교체**

`module/data/actor-character.mjs`의 `prepareDerivedData` 본문을 다음으로 교체:
```js
  prepareDerivedData() {
    // 랭크/수정치 → 숫자값
    for (const ability of Object.values(this.ability)) {
      ability.rankVal = rankVal(ability.rank);
      ability.modVal = modVal(ability.mod);
    }
    // 생명력/소지금 초기치
    this.initHealth = initHealth(this.ability);
    this.initMoney = initMoney(this.ability);
  }
```

- [ ] **Step 4: 다른 `_fields.mjs` 룩업 import 잔존 없음 확인**

Run:
```bash
grep -rn "RANK_VAL\|MOD_VAL\|HEALTH_BY\|MONEY_BY" module/
```
Expected: `module/dice/resolution.mjs`(HEALTH_BY/MONEY_BY 내부 정의)만. `_fields.mjs`/`actor-character.mjs`에는 없음.

- [ ] **Step 5: 빌드·테스트·린트 확인**

Run: `npm run build && npm test && npm run lint`
Expected: `✓ built`, 테스트 PASS, 신규 error 0.

- [ ] **Step 6: Foundry 수동 스모크**

캐릭터 시트: 능력치 랭크/수정치 변경 시 생명력 placeholder(`initHealth`)·소지금 초기치가 이전과 동일하게 표시되는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add module/data/_fields.mjs module/data/actor-character.mjs
git commit -m "refactor: single-source rank/mod lookups via resolution module"
```

---

### Task 9: `successCheck` 헬퍼를 `resolveDie`로 배선

**Files:**
- Modify: `module/helpers/templates.mjs`

챗카드 템플릿이 쓰는 `successCheck` 헬퍼의 판정 로직을 순수 `resolveDie`로 위임하고, 표시용 한국어 라벨만 헬퍼가 매핑한다. 출력 문자열은 기존과 동일("펌블"/"스페셜"/"성공"/"실패").

- [ ] **Step 1: `resolveDie` import 추가**

`module/helpers/templates.mjs` 최상단에 추가:
```js
import { resolveDie } from "../dice/resolution.mjs";
```

- [ ] **Step 2: `successCheck` 헬퍼 본문 교체**

기존 `successCheck` 헬퍼를 다음으로 교체:
```js
  Handlebars.registerHelper("successCheck", function (die, modVal, rollDC) {
    const label = { fumble: "펌블", special: "스페셜", success: "성공", fail: "실패" };
    return label[resolveDie(die, modVal, rollDC)] ?? "?";
  });
```

- [ ] **Step 3: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, 신규 error 0.

- [ ] **Step 4: Foundry 수동 스모크**

능력치 굴림 챗카드에서 각 주사위 결과 라벨(펌블/스페셜/성공/실패)이 이전과 동일하게 표시되는지 확인. 특히 1·6 눈과 경계값(die+modVal == dc).

- [ ] **Step 5: 커밋**

```bash
git add module/helpers/templates.mjs
git commit -m "refactor: route successCheck helper through resolveDie"
```

---

## Phase 3 — Roll / ChatCard 통합

### Task 10: 공유 챗 헬퍼 `chat.mjs` 생성

**Files:**
- Create: `module/chat/chat.mjs`

speaker/rollMode/toMessage 및 renderTemplate+ChatMessage.create 보일러플레이트를 두 함수로 모은다. 부수효과 전용(테스트는 수동 스모크).

- [ ] **Step 1: `chat.mjs` 구현**

Create `module/chat/chat.mjs`:
```js
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
```

- [ ] **Step 2: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, 신규 error 0(아직 미사용이라 `no-unused`는 export라 무관).

- [ ] **Step 3: 커밋**

```bash
git add module/chat/chat.mjs
git commit -m "feat: add shared chat post helpers"
```

---

### Task 11: `roll.mjs` 이전 + `diceCountForRank` 사용

**Files:**
- Move: `module/documents/roll.mjs` → `module/dice/roll.mjs`
- Modify: `module/documents/actor.mjs` (import 경로)
- Modify: `module/documents/item.mjs` (import 경로)

`amadeRoll`이 D 예외를 직접 처리하던 것을 `diceCountForRank`로 통일하고, dice 폴더로 위치를 모은다.

- [ ] **Step 1: 파일 이동**

Run:
```bash
git mv module/documents/roll.mjs module/dice/roll.mjs
```

- [ ] **Step 2: `roll.mjs` 본문을 `diceCountForRank` 사용으로 교체**

`module/dice/roll.mjs` 전체를 교체:
```js
import { diceCountForRank } from "./resolution.mjs";

export async function amadeRoll(rank, rankVal, rollData) {
  const count = diceCountForRank(rank);
  const roll = new Roll(count + "d6", rollData);
  await roll.evaluate();
  return roll;
}
```
> 참고: 시그니처의 `rankVal` 인자는 호출부 호환을 위해 유지하되 더는 사용하지 않는다(D 예외가 `diceCountForRank`로 흡수됨). 비D 랭크는 `diceCountForRank(rank) === rankVal`이라 결과 동일.

- [ ] **Step 3: import 경로 수정 — actor.mjs**

`module/documents/actor.mjs` 1행을 교체:
```js
import {amadeRoll} from "../dice/roll.mjs";
```

- [ ] **Step 4: import 경로 수정 — item.mjs**

`module/documents/item.mjs`의 `import {amadeRoll} from "./roll.mjs";`를 교체:
```js
import {amadeRoll} from "../dice/roll.mjs";
```

- [ ] **Step 5: 빌드·테스트·린트 확인**

Run: `npm run build && npm test && npm run lint`
Expected: `✓ built`, 테스트 PASS, 신규 error 0.

- [ ] **Step 6: Foundry 수동 스모크**

능력치 굴림(각 랭크 S/A/B/C/D)과 아이템 굴림에서 주사위 개수가 이전과 동일한지 확인(특히 D=2d6).

- [ ] **Step 7: 커밋**

```bash
git add module/dice/roll.mjs module/documents/actor.mjs module/documents/item.mjs
git commit -m "refactor: move roll builder to dice module and use diceCountForRank"
```

---

### Task 12: `actor.mjs` / `item.mjs` 챗 생성을 `chat.mjs`로 위임

**Files:**
- Modify: `module/documents/actor.mjs`
- Modify: `module/documents/item.mjs`

`rollAmadeAbl`·`getItemRollCard`·`getItemDataCard`(및 그 하위 `getGiftChatCard`/`getItemChatCard`)의 인라인 `ChatMessage.create`/`renderTemplate`를 `postCard`로 교체. 데이터·템플릿·style은 동일하게 보존.

- [ ] **Step 1: `actor.mjs`에 `postCard` import 추가**

`module/documents/actor.mjs` 상단(`amadeRoll` import 다음)에 추가:
```js
import { postCard } from "../chat/chat.mjs";
```

- [ ] **Step 2: `rollAmadeAbl`의 챗 생성 교체**

`rollAmadeAbl` 끝의 다음 두 줄:
```js
    let content = await foundry.applications.handlebars.renderTemplate("systems/amadeus/templates/chatcard/roll-amadeabl.html", templateData)
    ChatMessage.create({content, speaker : ChatMessage.getSpeaker({actor: this})});
```
를 다음으로 교체:
```js
    await postCard({
      actor: this,
      template: "systems/amadeus/templates/chatcard/roll-amadeabl.html",
      data: templateData,
    });
```

- [ ] **Step 3: `item.mjs`에 `postCard` import 추가**

`module/documents/item.mjs` 상단에 추가:
```js
import { postCard } from "../chat/chat.mjs";
```

- [ ] **Step 4: `getItemDataCard` 계열을 `postCard`로 정리**

현재 `getGiftChatCard`/`getItemChatCard`는 "렌더된 HTML 문자열"을 반환하고 `getItemDataCard`가 `ChatMessage.create`로 출력한다. 이는 `postCard`(template 렌더를 담당)와 책임이 겹친다. 카드 생성 메서드를 `{ template, data }` 반환으로 바꾸고 `getItemDataCard`가 `postCard`로 출력하도록, 기존 세 메서드(`getItemDataCard`/`getGiftChatCard`/`getItemChatCard`) 전체를 다음으로 교체:
```js
  async getItemDataCard() {
    // 아이템 정보만 표시하는 카드
    let card = null;
    if (this.type === "gift") card = this.#giftCardData();
    else if (this.type === "weapon" || this.type === "gear") card = this.#itemCardData();
    if (card) {
      await postCard({ actor: this.actor, template: card.template, data: card.data });
    }
  }

  #giftCardData() {
    const system = this.system;
    return {
      template: "systems/amadeus/templates/chatcard/data-gift.html",
      data: {
        name: this.name,
        type: game.i18n.localize(system.type),
        requirement: system.requirement,
        roll: game.i18n.localize(system.action.roll),
        tag: system.tag,
        effect: system.effect,
      },
    };
  }

  #itemCardData() {
    const system = this.system;
    return {
      template: "systems/amadeus/templates/chatcard/data-item.html",
      data: {
        name: this.name,
        type: game.i18n.localize(system.type),
        price: system.price,
        power: system.action.damage,
        effect: system.effect,
        description: system.description,
      },
    };
  }
```
기존 `getItemDataCard`/`getGiftChatCard`/`getItemChatCard` 세 메서드는 위 세 메서드로 완전히 대체된다(기존 본문 삭제).

- [ ] **Step 5: `getItemRollCard`의 챗 생성 교체**

`getItemRollCard` 끝의:
```js
    let content;
    if (this.type === "gift") {
      content = await foundry.applications.handlebars.renderTemplate("systems/amadeus/templates/chatcard/roll-gift.html", templateData)
    }

    //let content = await this.getAmadeDiceCard(resultDiceset, rollData); //목표치 넣기
    if (content)
      ChatMessage.create({
        content,
        flavor: ablLabel + "판정",
        speaker: speaker,
        style: CONST.CHAT_MESSAGE_STYLES.EMOTE
      })
```
를 다음으로 교체:
```js
    if (this.type === "gift") {
      await postCard({
        actor,
        template: "systems/amadeus/templates/chatcard/roll-gift.html",
        data: templateData,
        flavor: ablLabel + "판정",
        style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      });
    }
```
(이 교체로 `getItemRollCard` 상단의 `const speaker = ...` 지역변수가 미사용이 되므로 그 줄도 삭제. `label`은 `templateData`에서 계속 사용되므로 유지.)

- [ ] **Step 6: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, 신규 error 0(미사용 변수 경고 없을 것).

- [ ] **Step 7: Foundry 수동 스모크**

능력치 굴림 카드, gift 굴림 카드(EMOTE 스타일), gift/weapon/gear 데이터 카드 출력이 이전과 동일한 외형·내용인지 확인.

- [ ] **Step 8: 커밋**

```bash
git add module/documents/actor.mjs module/documents/item.mjs
git commit -m "refactor: route document chat cards through postCard helper"
```

---

### Task 13: 시트 굴림 핸들러를 위임으로 축소

**Files:**
- Modify: `module/sheets/actor-sheet.mjs`
- Modify: `module/documents/actor.mjs`

시트의 인라인 `new Roll().toMessage()` 4곳(`#onRoll` ability 분기 / `#onDamageRoll` / `#onGiftFormulaRoll`)을 `postRoll`로, 활력 굴림(`#onVitalityRoll`)은 `health.max` 갱신을 포함하므로 `actor.rollVitality()` 메서드로 이전 후 위임한다.

- [ ] **Step 1: `actor.mjs`에 `rollVitality` 메서드 추가**

`module/documents/actor.mjs`에 `postRoll` import를 추가(기존 chat import 줄을 확장):
```js
import { postCard, postRoll } from "../chat/chat.mjs";
```
그리고 `rollAmadeAbl` 다음에 메서드 추가:
```js
  /** 활력 굴림: 결과를 챗에 출력하고 vitality / health.max(=initHealth+활력)를 갱신한다. */
  async rollVitality(formula, label = "") {
    const roll = await postRoll({ actor: this, formula, flavor: label, rollData: this.getRollData() });
    const initHealth = this.system.initHealth ?? 0;
    await this.update({
      "system.vitality": roll.total,
      "system.health.max": initHealth + roll.total,
    });
    return roll;
  }
```

- [ ] **Step 2: `actor-sheet.mjs`에 `postRoll` import 추가**

`module/sheets/actor-sheet.mjs` 상단(effects import 다음)에 추가:
```js
import { postRoll } from "../chat/chat.mjs";
```

- [ ] **Step 3: `#onRoll`의 formula 분기를 `postRoll`로 교체**

`#onRoll`의 `if (dataset.roll) { ... }` 블록을 다음으로 교체:
```js
    if (dataset.roll) {
      const label = dataset.label ? `[ability] ${dataset.label}` : "";
      return postRoll({ actor: this.document, formula: dataset.roll, flavor: label, rollData: this.document.getRollData() });
    }
```

- [ ] **Step 4: `#onDamageRoll`을 `postRoll`로 교체**

`#onDamageRoll`의 Roll 생성·toMessage 부분을 다음으로 교체(null guard 유지):
```js
  static #onDamageRoll(event, target) {
    const dataset = target.dataset;
    if (dataset.rolltype !== "item") return;
    const itemId = target.closest(".item")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return; // null guard
    return postRoll({ actor: this.document, formula: dataset.roll, flavor: item.name, rollData: this.document.getRollData() });
  }
```

- [ ] **Step 5: `#onVitalityRoll`을 `actor.rollVitality` 위임으로 교체**

`#onVitalityRoll` 전체를 다음으로 교체:
```js
  static #onVitalityRoll(event, target) {
    return this.document.rollVitality(target.dataset.roll, target.dataset.label ?? "");
  }
```

- [ ] **Step 6: `#onGiftFormulaRoll`을 `postRoll`로 교체**

`#onGiftFormulaRoll` 전체를 다음으로 교체:
```js
  static #onGiftFormulaRoll(event, target) {
    const itemId = target.closest(".item")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    const formula = target.previousElementSibling?.value;
    if (!formula) return;
    return postRoll({ actor: this.document, formula, flavor: item?.name, rollData: this.document.getRollData() });
  }
```

- [ ] **Step 7: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, 신규 error 0.

- [ ] **Step 8: Foundry 수동 스모크**

능력치 formula 굴림 / 무기 데미지 굴림 / 활력 굴림(→ health.max 자동 입력 확인) / gift formula 굴림이 모두 이전과 동일하게 동작하는지 확인.

- [ ] **Step 9: 커밋**

```bash
git add module/sheets/actor-sheet.mjs module/documents/actor.mjs
git commit -m "refactor: delegate sheet roll handlers to postRoll and rollVitality"
```

---

## Phase 4 — 시트/템플릿 잔여 정리

### Task 14: `_onDropItem` 부모신 능력치 복사 루프화

**Files:**
- Modify: `module/sheets/actor-sheet.mjs`

6능력치 × (rank/mod) 12줄의 수동 객체 리터럴을 키 루프로 축약한다. 결과 동작은 동일(동일 키에 동일 값 기록).

- [ ] **Step 1: `_onDropItem` parent 분기 교체**

`module/sheets/actor-sheet.mjs`의 `_onDropItem` 내 `if (item.type === "parent") { ... }` 블록을 다음으로 교체:
```js
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
```

- [ ] **Step 2: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: `✓ built`, 신규 error 0.

- [ ] **Step 3: Foundry 수동 스모크**

부모신(parent) 아이템을 캐릭터 시트에 드롭 → 6능력치 랭크/수정치 + 이름/색/판테온/portrait가 이전과 동일하게 복사되는지, 기존 parent가 교체되는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add module/sheets/actor-sheet.mjs
git commit -m "refactor: loop parent ability copy in onDropItem"
```

---

## 최종 검증

- [ ] **Step 1: 전체 검증 일괄 실행**

Run: `npm run build && npm test && npm run lint`
Expected: `✓ built`, 모든 테스트 PASS, 신규 error 0.

- [ ] **Step 2: 전체 Foundry 수동 스모크 체크리스트**

새 world에서:
- [ ] 캐릭터 생성, 6능력치 랭크/수정치 변경 → 생명력/소지금 초기치 표시 정상
- [ ] 능력치 굴림(S/A/B/C/D 각각) → 주사위 수·판정 라벨 정상
- [ ] 아이템 굴림(gift) / 데미지 굴림(weapon) / 활력 굴림 / gift formula 굴림
- [ ] gift·weapon·gear 데이터 카드 출력
- [ ] 부모신 드롭 → 능력치 일괄 복사
- [ ] 아이템 핫바 드래그 → 매크로 굴림(이전 버그 수정 확인)
- [ ] 7종 Item 시트 + Actor(character/npc) 시트 렌더

- [ ] **Step 3: handoff 문서 갱신(선택)**

`docs/superpowers/`에 리팩토링 완료 handoff를 남기고 싶다면 작성. 남은 작업(SCSS 리뉴얼)으로 연결.
