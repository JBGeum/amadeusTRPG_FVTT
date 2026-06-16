# v13 마이그레이션 Phase 2 구현 계획 (DataModel 도입)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `template.json` 데이터 스키마를 `foundry.abstract.TypeDataModel` 클래스로 이전하고, 파생 계산을 DataModel로 옮기며 생명력 NaN 버그를 근본 해결한다.

**Architecture:** 액터/아이템 타입별 DataModel을 `module/data/`에 정의하고 init 훅에서 `CONFIG.Actor.dataModels`/`CONFIG.Item.dataModels`에 등록한다. 기존 필드 구조를 1:1 이전해 AppV1 시트가 그대로 동작하게 하고, 파생값(rankVal/modVal/initHealth/initMoney/calcHealth/xp)은 각 DataModel의 `prepareDerivedData()`에서 룩업 상수로 계산한다.

**Tech Stack:** Foundry VTT v13, `foundry.data.fields`, `foundry.abstract.TypeDataModel`, ES modules, Vite 8.

---

## 검증 방식 (공통)

단위 테스트 인프라가 없으므로 각 Task는 `npm run build`(✓ built) + `npm run lint`(신규 에러 없음)로 정적 검증하고, 마지막 Task에서 v13 수동 시나리오로 동작을 확인한다.

## 파일 구조

| 파일 | 책임 | 변경 |
|------|------|------|
| `module/data/_fields.mjs` | 재사용 스키마 헬퍼(ability) + 룩업 상수 | 신규 |
| `module/data/actor-character.mjs` | `CharacterData` (defineSchema + prepareDerivedData) | 신규 |
| `module/data/actor-npc.mjs` | `NpcData` | 신규 |
| `module/data/item-data.mjs` | 7개 아이템 타입 DataModel + action 헬퍼 | 신규 |
| `module/amadeus.mjs` | dataModels 등록 | 수정 |
| `template.json` | types만 유지(`monster`→`npc`), 데이터 블록 제거 | 수정 |
| `module/documents/actor.mjs` | 파생 계산 제거(DataModel로 이동), 문서 슬림화 | 수정 |
| `module/helpers/config.mjs` | (참조용) 기존 `AMADEUS.rank`/`modL` 유지 | 변경 없음 |

---

## Task 1: 공통 스키마 헬퍼와 룩업 상수 (`_fields.mjs`)

**Files:**
- Create: `module/data/_fields.mjs`

- [ ] **Step 1: 헬퍼/상수 파일 작성**

`module/data/_fields.mjs`를 생성한다. 능력치 스키마는 character와 parent가 공유하므로 헬퍼로 추출한다. 생명력/소지금/랭크 계산용 룩업 테이블을 상수로 둔다(기존 `actor.mjs`의 중복 `switch`를 대체).

```javascript
const fields = foundry.data.fields;

const RANKS = ["S", "A", "B", "C", "D"];
const MODS = ["+++", "++", "+", " ", "-", "--"];

/** 능력치 한 칸(rank/mod) */
export function abilityField() {
  return new fields.SchemaField({
    rank: new fields.StringField({ required: true, blank: false, initial: "A", choices: RANKS }),
    mod: new fields.StringField({ required: true, initial: " ", choices: MODS }),
  });
}

/** 6종 능력치 묶음 */
export function abilitiesField() {
  return new fields.SchemaField({
    warfare: abilityField(),
    technique: abilityField(),
    brain: abilityField(),
    spirit: abilityField(),
    love: abilityField(),
    mundane: abilityField(),
  });
}

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

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `_fields.mjs`에 에러 없음. (아직 import되지 않으므로 번들 영향은 없음.)

---

## Task 2: CharacterData DataModel

**Files:**
- Create: `module/data/actor-character.mjs`

`template.json`의 `character` 블록을 1:1로 이전한다. 파생값(rankVal/modVal/initHealth/initMoney/calcHealth)은 스키마에 넣지 않고 `prepareDerivedData()`에서 계산한다. **생명력 NaN 버그**는 `vitality`를 `NumberField(initial:0)`로 두고 숫자 연산하여 근본 해결한다.

- [ ] **Step 1: CharacterData 작성**

```javascript
import { abilitiesField, RANK_VAL, MOD_VAL, HEALTH_BY_RANK, HEALTH_BY_MOD, MONEY_BY_RANK, MONEY_BY_MOD } from "./_fields.mjs";

const fields = foundry.data.fields;

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const bond = () => new fields.SchemaField({
      index: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      chkbox: new fields.BooleanField({ initial: false }),
      name: new fields.StringField({ initial: "" }),
      truth: new fields.BooleanField({ initial: false }),
      score: new fields.NumberField({ initial: 0 }),
      relationship: new fields.StringField({ initial: "" }),
    });
    const supporter = () => new fields.SchemaField({
      index: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      chkbox: new fields.BooleanField({ initial: false }),
      score: new fields.NumberField({ initial: 0 }),
      relationship: new fields.StringField({ initial: "" }),
    });

    return {
      biography: new fields.HTMLField({ initial: "" }),
      health: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0 }),
        max: new fields.StringField({ initial: "" }),
      }),
      vitality: new fields.NumberField({ required: true, initial: 0 }),
      dc: new fields.NumberField({ required: true, integer: true, initial: 4 }),
      ability: abilitiesField(),
      chardata: new fields.SchemaField({
        pantheon: new fields.StringField({ initial: "" }),
        parent: new fields.StringField({ initial: "" }),
        parentkey: new fields.StringField({ initial: "" }),
        parentimg: new fields.StringField({ initial: "" }),
        background: new fields.StringField({ initial: "" }),
        prophecy: new fields.StringField({ initial: "" }),
        relationship: new fields.StringField({ initial: "" }),
      }),
      job: new fields.SchemaField({ chkbox: new fields.BooleanField({ initial: false }) }),
      status: new fields.SchemaField({
        desperation: new fields.BooleanField({ initial: false }),
        fury: new fields.BooleanField({ initial: false }),
        coward: new fields.SchemaField({
          chkbox: new fields.BooleanField({ initial: false }),
          level: new fields.NumberField({ initial: 0 }),
        }),
        depravity: new fields.BooleanField({ initial: false }),
        disgrace: new fields.BooleanField({ initial: false }),
        wound: new fields.SchemaField({
          chkbox: new fields.BooleanField({ initial: false }),
          level: new fields.NumberField({ initial: 0 }),
        }),
      }),
      money: new fields.StringField({ initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, initial: 1 }),
      exp: new fields.NumberField({ required: true, initial: 0 }),
      food: new fields.NumberField({ required: true, initial: 0 }),
      color: new fields.StringField({ initial: "" }),
      memo: new fields.StringField({ initial: "memo" }),
      attributes: new fields.ObjectField({ initial: {} }),
      groups: new fields.ObjectField({ initial: {} }),
      bonds: new fields.SchemaField({
        bond1: bond(), bond2: bond(), bond3: bond(), bond4: bond(), bond5: bond(),
      }),
      supporters: new fields.SchemaField({
        supporter1: supporter(), supporter2: supporter(), supporter3: supporter(), supporter4: supporter(),
      }),
    };
  }

  /** 파생 계산: 기존 actor.mjs의 _setRankModLetter/_calculateInitHealth/_calculateInitMoney/_calculateCalcHealth 이전 */
  prepareDerivedData() {
    // 랭크/수정치 → 숫자값
    for (const ability of Object.values(this.ability)) {
      ability.rankVal = RANK_VAL[ability.rank] ?? 0;
      ability.modVal = MOD_VAL[ability.mod] ?? 0;
    }
    // 생명력 초기치: warfare + spirit 의 (랭크+수정치) 합
    const initHealth =
      (HEALTH_BY_RANK[this.ability.warfare.rank] ?? 0) + (HEALTH_BY_MOD[this.ability.warfare.mod] ?? 0) +
      (HEALTH_BY_RANK[this.ability.spirit.rank] ?? 0) + (HEALTH_BY_MOD[this.ability.spirit.mod] ?? 0);
    this.initHealth = initHealth;
    // NaN 버그 수정: vitality는 NumberField라 항상 숫자 → parseInt 불필요
    this.calcHealth = initHealth + this.vitality;
    // 소지금 초기치: love + mundane 의 (랭크+수정치) 합
    this.initMoney =
      (MONEY_BY_RANK[this.ability.love.rank] ?? 0) + (MONEY_BY_MOD[this.ability.love.mod] ?? 0) +
      (MONEY_BY_RANK[this.ability.mundane.rank] ?? 0) + (MONEY_BY_MOD[this.ability.mundane.mod] ?? 0);
  }
}
```

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. 에러 없음.

---

## Task 3: NpcData DataModel

**Files:**
- Create: `module/data/actor-npc.mjs`

기존 코드(`actor.mjs:_prepareNpcData`)는 `cr`로 `xp`를 파생한다. 기존 `template.json`의 `monster`는 빈 객체였으나, 코드가 쓰는 `cr`/`xp`를 명시한다.

- [ ] **Step 1: NpcData 작성**

```javascript
const fields = foundry.data.fields;

export class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cr: new fields.NumberField({ required: true, initial: 0 }),
    };
  }

  /** 기존 _prepareNpcData: xp = cr^2 * 100 */
  prepareDerivedData() {
    this.xp = this.cr * this.cr * 100;
  }
}
```

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. 에러 없음.

---

## Task 4: 아이템 DataModel 7종 (`item-data.mjs`)

**Files:**
- Create: `module/data/item-data.mjs`

`template.json`의 7개 아이템 타입을 1:1 이전한다. `weapon`/`gear`는 동일 구조이므로 `action` 스키마를 헬퍼로 공유한다. `parent`는 ability 6종을 가지므로 `abilitiesField()`를 재사용한다.

- [ ] **Step 1: item-data.mjs 작성**

```javascript
import { abilitiesField } from "./_fields.mjs";

const fields = foundry.data.fields;

/** weapon/gear/gift 가 공유하는 action 블록 */
function actionField() {
  return new fields.SchemaField({
    roll: new fields.StringField({ required: false, nullable: true, initial: null }),
    damage: new fields.StringField({ initial: "" }),
    spAbl: new fields.ObjectField({ initial: {} }),
  });
}

export class GiftData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      chkbox: new fields.BooleanField({ initial: false }),
      type: new fields.StringField({ initial: "" }),
      requirement: new fields.StringField({ initial: "" }),
      action: actionField(),
      tag: new fields.StringField({ initial: "" }),
      effect: new fields.StringField({ initial: "." }),
      description: new fields.StringField({ initial: "." }),
      formula: new fields.StringField({ initial: "" }),
      memo: new fields.StringField({ initial: "" }),
    };
  }
}

export class BackgroundData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      type: new fields.StringField({ initial: "" }),
      modSet: new fields.ArrayField(new fields.ObjectField(), { initial: [] }),
    };
  }
}

export class ParentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      pantheon: new fields.StringField({ initial: "" }),
      color: new fields.StringField({ initial: "" }),
      weapon: new fields.StringField({ initial: "" }),
      authority: new fields.StringField({ initial: "" }),
      portrait: new fields.StringField({ initial: "" }),
      ability: abilitiesField(),
      description: new fields.StringField({ initial: "" }),
    };
  }
}

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      name: new fields.StringField({ initial: "" }),
      price: new fields.NumberField({ initial: 0 }),
      type: new fields.StringField({ initial: "" }),
      action: actionField(),
      effect: new fields.StringField({ initial: "." }),
      description: new fields.StringField({ initial: "." }),
    };
  }
}

export class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      name: new fields.StringField({ initial: "" }),
      price: new fields.NumberField({ initial: 0 }),
      type: new fields.StringField({ initial: "" }),
      action: actionField(),
      effect: new fields.StringField({ initial: "." }),
      description: new fields.StringField({ initial: "." }),
    };
  }
}

export class MemoryData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      date: new fields.SchemaField({
        year: new fields.NumberField({ integer: true, initial: 2022 }),
        month: new fields.NumberField({ integer: true, initial: 1 }),
        day: new fields.NumberField({ integer: true, initial: 1 }),
      }),
      island: new fields.StringField({ initial: "" }),
      mission: new fields.StringField({ initial: "" }),
      completed: new fields.BooleanField({ initial: false }),
    };
  }
}

export class TreasureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.StringField({ initial: "." }),
    };
  }
}
```

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. 에러 없음.

---

## Task 5: DataModel 등록 (`amadeus.mjs`)

**Files:**
- Modify: `module/amadeus.mjs` (import 추가 + init 훅 내 등록)

- [ ] **Step 1: import 추가**

`module/amadeus.mjs` 상단의 import 블록(기존 `import { AMADEUS } from "./helpers/config.mjs";` 아래)에 데이터 모델 import를 추가한다.

```javascript
// Import data models.
import { CharacterData } from "./data/actor-character.mjs";
import { NpcData } from "./data/actor-npc.mjs";
import { GiftData, BackgroundData, ParentData, WeaponData, GearData, MemoryData, TreasureData } from "./data/item-data.mjs";
```

- [ ] **Step 2: init 훅에 dataModels 등록**

`module/amadeus.mjs`의 init 훅에서 `CONFIG.Actor.documentClass = AmadeusActor;` 줄 바로 위(또는 아래)에 다음을 추가한다. (`Object.assign`으로 코어 static 보존.)

```javascript
  // Register system DataModels (keys must match template.json types).
  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData,
  });
  Object.assign(CONFIG.Item.dataModels, {
    gift: GiftData,
    background: BackgroundData,
    parent: ParentData,
    weapon: WeaponData,
    gear: GearData,
    memory: MemoryData,
    treasure: TreasureData,
  });
```

- [ ] **Step 3: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `amadeus.mjs`에 에러 없음.

---

## Task 6: template.json 정리 (types만 유지, monster→npc)

**Files:**
- Modify: `template.json`

DataModel이 스키마를 담당하므로 데이터 블록을 제거하고 타입 목록만 남긴다. Actor 타입을 `monster`→`npc`로 수정(코드가 `npc`를 사용).

- [ ] **Step 1: template.json을 타입 선언만 남기도록 교체**

`template.json` 전체를 다음으로 교체한다.

```json
{
  "Actor": {
    "types": ["character", "npc"]
  },
  "Item": {
    "types": ["gift", "background", "parent", "weapon", "gear", "memory", "treasure"]
  }
}
```

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. (정적 자산 복사 대상이므로 `dist/template.json`도 갱신됨.)

---

## Task 7: actor.mjs 파생 계산 제거 (DataModel로 이전 완료)

**Files:**
- Modify: `module/documents/actor.mjs`

파생 계산이 `CharacterData`/`NpcData`로 이전되었으므로, `AmadeusActor`에서 중복 로직을 제거하고 문서를 슬림화한다. `getRollData`와 `rollAmadeAbl`은 유지한다.

- [ ] **Step 1: prepareDerivedData와 계산 헬퍼들 제거**

`module/documents/actor.mjs`에서 `prepareDerivedData()`, `_prepareCharacterData()`, `_setRankModLetter()`, `_calculateInitHealth()`, `_calculateCalcHealth()`, `_calculateInitMoney()`, `_prepareNpcData()` 메서드를 **모두 삭제**한다. (이들의 로직은 Task 2·3의 DataModel `prepareDerivedData()`로 이전됨.)

`prepareData()`/`prepareBaseData()` 오버라이드는 단순 super 호출뿐이므로 함께 삭제해도 무방하다(기본 동작과 동일).

삭제 후 `AmadeusActor`에 남는 것은 `getRollData()`, `_getCharacterRollData()`, `_getNpcRollData()`, `rollAmadeAbl()` 이다.

- [ ] **Step 2: build + lint 검증**

Run: `npm run build && npm run lint`
Expected: `✓ built`. `actor.mjs`에 에러 없음. (사용하지 않게 된 변수 경고가 없는지 확인.)

---

## Task 8: v13 수동 검증 및 Phase 2 커밋

**Files:** (검증 및 커밋)

- [ ] **Step 1: 빌드 후 dist 확인**

Run: `npm run build`
Expected: `✓ built`, `dist/`에 `system.json`/`template.json`/번들 갱신.

- [ ] **Step 2: v13 수동 시나리오 (새 world)**

빌드된 `dist/`를 서버 `systems/amadeus`로 배포하고 **Foundry를 재시작**한 뒤 새 world에서 확인한다:

1. 시스템 로드 오류 없음, 콘솔에 DataModel 관련 오류 없음
2. **캐릭터 생성 → 능력치 랭크/수정치 변경 시 생명력(`calcHealth`)·소지금(`initMoney`)이 정상 숫자로 계산됨 (NaN 아님)** ← Phase 2 핵심
3. `vitality` 변경이 `calcHealth`에 반영됨
4. **NPC 타입** 액터 생성 가능(`monster` 아님), `cr` 입력 시 `xp` 계산
5. 모든 아이템 타입(gift/background/parent/weapon/gear/memory/treasure) 생성 가능
6. 부모신(parent) 드롭 시 능력치/속성 복사 정상
7. 능력치/기프트 굴림 정상

문제 발견 시 해당 Task로 돌아가 수정 후 재검증한다.

- [ ] **Step 3: Phase 2 커밋**

```bash
git add module/ template.json
git commit -m "feat: migrate system data to DataModel and fix health NaN"
```

> 커밋 메시지는 Conventional Commits 접두어 + 한 줄 영어 요약, co-author·세부나열 없음.

---

## 관련 버그 트랙 (Phase 2에서 함께 처리 / 별도 fix)

- **생명력 NaN** → 본 Phase Task 2에서 근본 해결(`vitality` NumberField + 숫자 연산).
- **`_onDamageRoll`의 `item` null 참조**(`actor-sheet.mjs:362`, `flavor: item.name`) → **deprecated/데이터와 무관한 시트 로직 버그**. Phase 3(시트 AppV2 재작성) 때 함께 정리하거나, 그 전에 거슬리면 별도 `fix:` 커밋으로 `if (!item) return;` 가드를 추가한다.

---

## Self-Review (작성자 체크 결과)

- **Spec 커버리지**: spec Phase 2 항목 — DataModel 신설(Task 1~4), init 등록(Task 5), `template.json` types/`monster`→`npc`(Task 6), 파생계산 이동·룩업 상수화(Task 1·2·3·7), 생명력 NaN(Task 2) 모두 대응. `bonds`/`supporters`는 1:1 이전(구조 정리는 Phase 3로 명시 분리).
- **Placeholder**: 모든 코드 step에 완전한 코드 포함. "추후 구현" 없음.
- **타입 일관성**: 클래스명(`CharacterData`/`NpcData`/`GiftData`/`BackgroundData`/`ParentData`/`WeaponData`/`GearData`/`MemoryData`/`TreasureData`)과 헬퍼(`abilitiesField`/`abilityField`/`actionField`), 상수(`RANK_VAL`/`MOD_VAL`/`HEALTH_BY_RANK`/`HEALTH_BY_MOD`/`MONEY_BY_RANK`/`MONEY_BY_MOD`)가 Task 1~5에서 일관되게 사용됨. `template.json` types 키(`character`/`npc`, 아이템 7종)가 Task 5 등록 키와 일치.
