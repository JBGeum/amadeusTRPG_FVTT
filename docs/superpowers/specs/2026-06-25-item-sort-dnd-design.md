# 기프트·인벤토리 순서 유지 + 드래그앤드롭 정렬 — 설계 (2026-06-25)

## 개요

기프트/인벤토리 아이템을 수정하면 목록 순서가 뒤섞여 맨 뒤로 밀린다. 원인은 시트가 아이템을 **최종 수정 시각(`modifiedTime`)으로 정렬**하기 때문이다. 정렬 기준을 Foundry 표준 **`sort` 필드**로 바꿔 ① 수정해도 순서가 유지되고 ② 드래그앤드롭으로 순서를 바꿀 수 있게 한다. 두 요구는 한 솔루션으로 동시에 해결된다.

## 현황 / 원인

- `module/sheets/actor-sheet.mjs:111-112` — `_prepareItems`가 `gifts`/`inventory`를 `_stats.modifiedTime` 오름차순으로 정렬한다. 체크박스 토글(`itemChk`)·메모/수식 입력 등 `item.update()`가 일어나면 `modifiedTime`이 갱신돼 해당 아이템이 맨 뒤로 이동한다. (`memory`는 `createdTime` 정렬이라 이 문제가 없다.)
- 템플릿 `templates/actor/parts/actor-gift.html:4`, `templates/actor/parts/actor-item.html:21` — 카드에 `draggable="true"`와 `data-item-id`가 **이미 있으나**, 클래스가 `.item`이라 코어 `ActorSheetV2`의 기본 드래그 selector(`.draggable`)와 맞지 않아 드래그 정렬이 작동하지 않는다.
- `ActorSheetV2`는 `_onDropItem` 내부에서 "같은 액터에 drop"을 감지해 `_onSortItem`으로 `sort` 필드를 자동 재계산한다. 현재 시트의 `_onDropItem`(actor-sheet.mjs:188)은 parent 처리 후 `super._onDropItem`을 호출하므로 이 경로가 살아 있다.

## 결정 사항 (확정)

- **범위**: 기프트 + 인벤토리(weapon/gear). `memory`/`treasure`/`background`/`parent`는 제외.
- **정렬 기준**: `sort` 필드 오름차순, 동률 시 `createdTime`으로 tie-break.
- **DnD**: 코어 `ActorSheetV2`의 `_onSortItem`을 활용한다. 커스텀 dragstart/drop 핸들러는 작성하지 않는다.
- **데이터 모델·`template.json` 변경 없음**: `sort`는 Foundry 기본 Document 필드다.

## 아키텍처

```
[기프트 수정(체크/메모/수식)]  → item.update → modifiedTime만 갱신, sort 불변 → 순서 유지
[기프트/인벤토리 카드 드래그] → ActorSheetV2._onDrop → _onDropItem(super) → _onSortItem
                                  → sort 재계산 + item.update({sort})
                                  → 재렌더 시 _prepareItems가 sort 기준 정렬 → 새 순서 표시
```

핵심 연결: `_onSortItem`이 `sort`를 바꿔도, `_prepareItems`가 `sort` 기준으로 정렬해야 화면에 반영된다. 두 변경은 짝이다.

## 컴포넌트

### 1. 정렬 기준 변경 — `module/sheets/actor-sheet.mjs` `_prepareItems`

- entry 객체에 `sort: i.sort`를 추가한다(현재 `{_id, name, img, type, system, _stats}`).
- `gifts`/`inventory` 정렬을 다음으로 교체:
  ```js
  const bySort = (a, b) => (a.sort - b.sort) || (a._stats.createdTime - b._stats.createdTime);
  gifts.sort(bySort);
  inventory.sort(bySort);
  ```
- `memory`(`createdTime`)·나머지는 현행 유지.

### 2. DnD 활성화 — 드래그 요소를 코어 selector에 정합

코어 `ActorSheetV2`가 기프트·인벤토리 카드를 드래그 대상으로 인식하도록 맞춘다. 구현 시 코어의 기본 `dragDrop` 설정을 확인해 **둘 중 하나**로 처리한다(구현 단계에서 실제 동작으로 확정):
- (a) 템플릿 드래그 요소에 `.draggable` 클래스를 추가(코어 기본 selector가 `.draggable`인 경우), 또는
- (b) 시트 `DEFAULT_OPTIONS.dragDrop`에 `{ dragSelector: ".item[data-item-id]", dropSelector: null }`를 지정.

`_onDropItem`은 parent 분기 후 `super._onDropItem`을 호출하는 현 구조를 유지한다(같은 액터 정렬은 super → `_onSortItem` 경로).

## 엣지 케이스

- **기존 `sort=0` 동률**: 모든 아이템 `sort`가 0이면 `createdTime` tie-break로 생성순 안정 표시. 첫 드래그가 `performIntegerSort`로 `sort` 값을 부여한 뒤부터 그 순서가 유지된다.
- **식량(food)**: `data-item-id` 없는 고정 특수 카드 → 드래그 대상 아님(맨 앞 유지).
- **weapon/gear 혼합 인벤토리**: 한 목록으로 표시·정렬. 구현 시 코어 `_onSortItem`의 siblings 계산이 타입 혼합에서 의도대로 동작하는지 확인.
- **권한**: 코어 `_canDragStart`/`_canDragDrop`가 소유자/편집 권한을 검사. 추가 가드 불필요.

## 비범위 (Non-goals)

- memory/treasure/background/parent 정렬·DnD
- 타입 그룹 간 이동(기프트↔인벤토리), 정렬 방향 토글, 수동 정렬 버튼
- DataModel·`template.json`·커스텀 sort 알고리즘

## 검증

- **수동**:
  - 기프트 체크박스/메모/수식 수정 후 목록 순서가 유지되는지(맨 뒤로 안 밀림).
  - 기프트·인벤토리 카드를 드래그해 순서 변경 → 재렌더·시트 재오픈·월드 새로고침 후에도 순서 유지.
  - 식량 카드는 맨 앞 고정, 드래그 안 됨.
- **자동(선택)**: `bySort` 비교 로직을 순수 함수로 분리하면 Vitest로 정렬 안정성(동률 tie-break) 단위 검증 가능.
