# 기프트·인벤토리 순서 유지 + 드래그앤드롭 정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기프트·인벤토리 아이템 목록을 `modifiedTime` 대신 Foundry `sort` 필드로 정렬해 수정 시 순서를 유지하고, 드래그앤드롭으로 순서를 바꿀 수 있게 한다.

**Architecture:** 정렬 비교 로직을 Foundry 비의존 순수 함수(`compareItemOrder`)로 분리해 Vitest로 검증하고, `_prepareItems`가 이를 써서 `sort`(동률 시 `createdTime`) 기준으로 정렬한다. 드래그앤드롭은 표준 ApplicationV2 패턴(`DEFAULT_OPTIONS.dragDrop` + `_onRender`에서 `DragDrop.bind`)으로 연결하고, 정렬 자체는 코어 `ActorSheetV2._onSortItem`(우리 `_onDropItem` → `super` 경로)이 처리한다.

**Tech Stack:** Foundry VTT v13 (ApplicationV2 / `ActorSheetV2` / `HandlebarsApplicationMixin`), Vite 번들, Vitest.

## Global Constraints

- 대상: **Foundry VTT v13+**. 시트는 `foundry.applications.sheets.ActorSheetV2` 기반. DragDrop 클래스는 `foundry.applications.ux.DragDrop`.
- `module/sheets/item-sort.mjs`는 **Foundry 전역을 참조하지 않는 순수 모듈**이어야 한다(Vitest에서 import 가능). `resolution.mjs`와 동일 원칙.
- **DataModel·`template.json` 변경 없음**: `sort`는 Foundry 기본 Document 필드다. 템플릿(`actor-gift.html`/`actor-item.html`)은 이미 `draggable="true"` + `data-item-id`를 가지므로 **변경하지 않는다**.
- 범위: **기프트 + 인벤토리(weapon/gear)만**. `memory`(현행 `createdTime`)·`treasure`·`background`·`parent`는 변경하지 않는다.
- 빌드 산출물 `dist/`는 자립형. 코드 변경 후 **`npm run build`** 로 재번들해야 Foundry에 반영된다.
- 커밋 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `sort` 기준 정렬로 전환

정렬 비교를 순수 함수로 분리(TDD)하고 `_prepareItems`에 적용한다. 이 task만으로 "수정 시 순서 유지" 버그가 해결된다(수정해도 `sort` 불변).

**Files:**
- Create: `module/sheets/item-sort.mjs`
- Test: `test/item-sort.test.mjs`
- Modify: `module/sheets/actor-sheet.mjs` (상단 import; `_prepareItems` 103·111-112행)

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces: `compareItemOrder(a, b)` — `a`/`b`는 `{ sort: number, createdTime: number }`. `sort` 오름차순, 동률 시 `createdTime` 오름차순. `Array.prototype.sort` 비교자로 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `test/item-sort.test.mjs`:

```javascript
import { describe, it, expect } from "vitest";
import { compareItemOrder } from "../module/sheets/item-sort.mjs";

describe("compareItemOrder", () => {
  it("orders by sort ascending", () => {
    expect(compareItemOrder({ sort: 100, createdTime: 5 }, { sort: 200, createdTime: 1 })).toBeLessThan(0);
    expect(compareItemOrder({ sort: 300, createdTime: 1 }, { sort: 200, createdTime: 9 })).toBeGreaterThan(0);
  });

  it("falls back to createdTime when sort ties", () => {
    expect(compareItemOrder({ sort: 0, createdTime: 10 }, { sort: 0, createdTime: 20 })).toBeLessThan(0);
    expect(compareItemOrder({ sort: 0, createdTime: 20 }, { sort: 0, createdTime: 10 })).toBeGreaterThan(0);
  });

  it("returns 0 when sort and createdTime are equal", () => {
    expect(compareItemOrder({ sort: 5, createdTime: 5 }, { sort: 5, createdTime: 5 })).toBe(0);
  });

  it("keeps creation order when all sorts are 0 (legacy data)", () => {
    const items = [
      { id: "c", sort: 0, createdTime: 30 },
      { id: "a", sort: 0, createdTime: 10 },
      { id: "b", sort: 0, createdTime: 20 },
    ];
    expect(items.sort(compareItemOrder).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/item-sort.test.mjs`
Expected: FAIL — `Failed to resolve import "../module/sheets/item-sort.mjs"` (파일 없음).

- [ ] **Step 3: 순수 함수 구현**

Create `module/sheets/item-sort.mjs`:

```javascript
// 시트 아이템 목록 표시 순서를 정하는 순수 비교자. Foundry 전역 미참조(Vitest 가능).

/**
 * 아이템 표시 순서 비교자: sort 필드 오름차순, 동률이면 생성 시각(createdTime) 오름차순.
 * sort가 전부 0인 기존 데이터에서도 생성순으로 안정적으로 정렬된다.
 * @param {{sort:number, createdTime:number}} a
 * @param {{sort:number, createdTime:number}} b
 * @returns {number} Array.prototype.sort 비교 결과
 */
export function compareItemOrder(a, b) {
  return (a.sort - b.sort) || (a.createdTime - b.createdTime);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/item-sort.test.mjs`
Expected: PASS — 4개 통과.

- [ ] **Step 5: `_prepareItems`에 적용**

`module/sheets/actor-sheet.mjs` 상단 import 영역(3행 `postCard` import 다음 줄)에 추가:

```javascript
import { postCard, postRoll } from "../chat/chat.mjs";
import { compareItemOrder } from "./item-sort.mjs";
```

`_prepareItems`의 entry 생성(103행)을 교체해 정렬 키를 포함시킨다:

```javascript
      const entry = { _id: i.id, name: i.name, img, type: i.type, system: i.system, _stats: i._stats, sort: i.sort, createdTime: i._stats.createdTime };
```

그리고 정렬 라인(111-112행)을 교체한다. 변경 전:

```javascript
    gifts.sort((a, b) => a._stats.modifiedTime - b._stats.modifiedTime);
    inventory.sort((a, b) => a._stats.modifiedTime - b._stats.modifiedTime);
```

변경 후:

```javascript
    gifts.sort(compareItemOrder);
    inventory.sort(compareItemOrder);
```

(113행 `memory.sort((a, b) => a._stats.createdTime - b._stats.createdTime);`는 그대로 둔다.)

- [ ] **Step 6: 빌드 통과 확인**

Run: `npm run build`
Expected: `✓ built`, 에러 없음.

Run: `npx vitest run`
Expected: PASS — 전체 통과(기존 42 + 신규 4 = 46).

- [ ] **Step 7: 커밋**

```bash
git add module/sheets/item-sort.mjs test/item-sort.test.mjs module/sheets/actor-sheet.mjs
git commit -m "fix: sort gift/inventory by sort field so edits keep order

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 드래그앤드롭 정렬 활성화

표준 ApplicationV2 DragDrop 보일러플레이트를 시트에 연결한다. 정렬 계산은 코어 `ActorSheetV2._onSortItem`이 수행한다. 자동 테스트 불가(Foundry 의존) → 빌드 통과 + Foundry 수동 검증.

**Files:**
- Modify: `module/sheets/actor-sheet.mjs` (`DEFAULT_OPTIONS`; constructor 신설; `_onRender` 126행; DnD 헬퍼 메서드 신설)

**Interfaces:**
- Consumes: Task 1의 `sort` 기준 `_prepareItems`(드래그로 바뀐 `sort`가 화면에 반영되려면 필수)
- Produces: 시트가 `.item[data-item-id]` 카드의 드래그를 받아 코어 `_onDropItem` → `_onSortItem`으로 `sort`를 재계산

- [ ] **Step 1: `DEFAULT_OPTIONS`에 `dragDrop` 추가**

`module/sheets/actor-sheet.mjs`의 `DEFAULT_OPTIONS`에서 `form` 블록(26행) 다음에 `dragDrop`을 추가한다:

```javascript
    form: { submitOnChange: true, closeOnSubmit: false },
    dragDrop: [{ dragSelector: ".item[data-item-id]", dropSelector: null }],
    actions: {
```

- [ ] **Step 2: constructor와 DnD 헬퍼 메서드 추가**

`static PARTS = {...}` 블록(46-49행) 다음, `_configureRenderOptions`(52행) 앞에 추가한다:

```javascript
  /** @type {DragDrop[]} ApplicationV2는 dragDrop 옵션을 자동 바인딩하지 않으므로 직접 만든다. */
  #dragDrop;

  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  /** DEFAULT_OPTIONS.dragDrop 항목마다 권한/콜백을 붙여 DragDrop 인스턴스를 만든다. */
  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new foundry.applications.ux.DragDrop.implementation(d);
    });
  }

  /** 드래그 시작 권한: 시트가 편집 가능할 때만. */
  _canDragStart(_selector) {
    return this.isEditable;
  }

  /** 드롭 권한: 시트가 편집 가능할 때만. */
  _canDragDrop(_selector) {
    return this.isEditable;
  }

  /** 드래그 시작: 카드의 data-item-id로 드래그 데이터를 구성한다(같은 액터 내 정렬용). */
  _onDragStart(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
  }
```

> 참고: `_onDrop`/`_onDropItem`/`_onSortItem`은 `ActorSheetV2`가 제공한다. 드롭이 같은 액터 아이템이면 `super._onDropItem`(시트의 parent 분기 뒤 호출)이 `_onSortItem`을 거쳐 `sort`를 재계산한다. 별도 구현하지 않는다.

- [ ] **Step 3: `_onRender`에서 DragDrop 바인딩**

`_onRender`(126행)의 `super._onRender(context, options);` 바로 다음 줄에 바인딩을 추가한다. 변경 전:

```javascript
  _onRender(context, options) {
    super._onRender(context, options);
    if (this.isEditable) {
```

변경 후:

```javascript
  _onRender(context, options) {
    super._onRender(context, options);
    this.#dragDrop.forEach((d) => d.bind(this.element));
    if (this.isEditable) {
```

- [ ] **Step 4: 빌드 통과 확인**

Run: `npm run build`
Expected: `✓ built`, 에러 없음.

Run: `grep -c "createDragDropHandlers" dist/amadeus.mjs`
Expected: `1` 이상.

- [ ] **Step 5: 커밋**

```bash
git add module/sheets/actor-sheet.mjs
git commit -m "feat: enable drag-and-drop reordering for gift/inventory items

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Foundry 수동 검증** (사용자가 `dist/`를 서버에 배포 후 수행)

빌드된 `dist/`를 Foundry 서버의 `systems/amadeus`로 배포하고 월드를 새로고침한 뒤 캐릭터 시트에서 확인한다.

**순서 유지(Task 1):**
- [ ] 기프트 여러 개가 있는 상태에서 한 기프트의 체크박스 토글·메모·수식을 수정 → 목록 순서가 **그대로 유지**(맨 뒤로 안 밀림)
- [ ] 인벤토리(장비/무기) 항목 수정 시에도 순서 유지

**드래그앤드롭(Task 2):**
- [ ] 기프트 카드를 잡아 다른 기프트 위로 드롭 → 순서 변경. 시트 닫았다 다시 열기·월드 새로고침 후에도 **유지**
- [ ] 인벤토리 카드 드래그로 순서 변경 → 유지
- [ ] 식량(food) 카드는 드래그되지 않음(맨 앞 고정)
- [ ] 관전자(편집 권한 없는 사용자)에서는 드래그가 동작하지 않음

**회귀 확인:**
- [ ] 부모신(parent) 아이템 드롭 시 기존 동작(능력치 복사)이 그대로 작동
- [ ] memory/treasure 목록은 변화 없음

> 만약 드래그가 전혀 작동하지 않으면(코어 `ActorSheetV2`가 dragDrop을 자체 바인딩해 이중 바인딩이 되거나 selector가 무시되는 경우), `_onRender`의 수동 `bind` 호출을 제거하고 `DEFAULT_OPTIONS.dragDrop`만 남겨 코어 바인딩에 위임한 뒤 재검증한다.

---

## 참고: 검증 명령 요약

- 단위 테스트: `npx vitest run test/item-sort.test.mjs`
- 전체 테스트: `npm test`
- 빌드: `npm run build`
- 린트: `npm run lint`
