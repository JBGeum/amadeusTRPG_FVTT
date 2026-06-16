# Amadeus 시스템 Foundry VTT v13 마이그레이션 설계

- **날짜**: 2026-06-16
- **대상 브랜치**: `develop`
- **목표 버전**: Foundry VTT v13+
- **검증 환경**: 로컬 v13 설치(각 Phase 후 수동 테스트)

## 1. 목표와 범위

현재 Amadeus 시스템은 Foundry VTT v10~v11(`system.json` `compatibility.minimum: 10`) 기준으로 작성되어 있으며, v13에서 제거·deprecated된 다수의 API를 사용한다. 본 작업의 목표는 **v13에서 deprecation 경고 없이 깨끗하게 동작하도록 완전 현대화**하는 것이다.

완전 현대화는 4개의 축으로 구성되며, 이를 의존 순서에 따라 3개 Phase로 나눈다. 각 Phase는 독립적인 커밋 + v13 수동검증 단위다.

### 결정된 전제

- **진행 전략**: 의존순 단계별 (Phase 1 → 2 → 3). 위험이 낮은 것부터, 가장 위험한 AppV2 시트 전환은 안정된 데이터/API 기반 위에서 수행.
- **world 호환성**: 보존 불필요. 제작중 시스템이므로 기존 world 데이터가 깨져도 무방하며, 마이그레이션 스크립트는 작성하지 않는다. 새 world로 테스트한다.
- **스키마 정리**: 자유. DataModel 전환 시 `monster`↔`npc` 타입 불일치 등을 정리한다.

## 2. Phase 1 — 저위험 deprecated 정리 (시트는 AppV1 유지)

확인된 사용처를 v13 네임스페이스로 치환한다. 시트 클래스는 이 Phase에서 건드리지 않고 AppV1 호환 레이어(`foundry.appv1.sheets.*`)로 유지한 채 동작을 확인한다.

| 현재 | v13 | 위치 |
|------|-----|------|
| `mergeObject(...)` | `foundry.utils.mergeObject` | `sheets/item-sheet.mjs:9`, `sheets/actor-sheet.mjs:13` |
| `duplicate(...)` | `foundry.utils.duplicate` | `sheets/actor-sheet.mjs:287` |
| `DEFAULT_TOKEN` | `CONST.DEFAULT_TOKEN` (또는 빈값 처리) | `sheets/actor-sheet.mjs:108` |
| `renderTemplate(...)` | `foundry.applications.handlebars.renderTemplate` | `documents/item.mjs`(4곳), `documents/actor.mjs:243` |
| `loadTemplates(...)` | `foundry.applications.handlebars.loadTemplates` | `helpers/templates.mjs:7` |
| `roll.evaluate({async: true})` | `await roll.evaluate()` | `documents/roll.mjs:8` |
| `ChatMessage … type: 3` | `style: CONST.CHAT_MESSAGE_STYLES.EMOTE` | `documents/item.mjs:160` |
| `Actors` / `Items` 전역 | `foundry.documents.collections.*` | `module/amadeus.mjs:47-50` |
| `ActorSheet` / `ItemSheet` 전역 | `foundry.appv1.sheets.*` (Phase 3에서 AppV2로 대체) | `module/amadeus.mjs:47-50` |

### Phase 1 검증 시 확인 필요 항목

- **`type: 3` → `style: EMOTE` 치환**: `type: 3`은 `CHAT_MESSAGE_TYPES.EMOTE`로, speaker를 행동 주체로 표시하는 이모트 스타일이다. 단순 제거하면 표시가 바뀌므로 `style: CONST.CHAT_MESSAGE_STYLES.EMOTE`로 치환한다. v13에서 해당 카드(`getItemRollCard`)의 실제 렌더링이 기존과 동일한지(speaker 표시 형태) 확인한 뒤 확정한다.

### Phase 1 완료 기준

v13에 시스템을 로드해 콘솔에 위 API 관련 deprecation 경고가 사라지고, AppV1 호환 시트가 정상적으로 뜨는 것을 확인한다.

## 3. Phase 2 — DataModel 도입 + 스키마 정리

### 구조

- **신설 `module/data/`**: `foundry.abstract.TypeDataModel` 기반 클래스
  - `actor-character.mjs`, `actor-npc.mjs`
  - 아이템 7종(`gift` / `background` / `parent` / `weapon` / `gear` / `memory` / `treasure`). 공통 필드는 base mixin으로 공유하고, 타입별 차이는 각자 `defineSchema()`에 정의.
- `module/amadeus.mjs` init 훅에 데이터 모델 등록:
  - `CONFIG.Actor.dataModels = { character, npc }`
  - `CONFIG.Item.dataModels = { gift, background, parent, weapon, gear, memory, treasure }`
- `template.json`은 **types 목록만 유지**(`monster` → `npc`로 수정), 데이터 스키마 블록은 제거한다 → 스키마는 DataModel이 담당.

### 파생 계산 이동

`documents/actor.mjs`의 파생 계산(`_setRankModLetter`, `_calculateInitHealth`, `_calculateCalcHealth`, `_calculateInitMoney`)을 각 DataModel의 `prepareDerivedData()`로 이동한다. 능력치 랭크/수정치를 다루는 중복 `switch` 룩업은 `helpers/config.mjs`의 `AMADEUS.rank` / `AMADEUS.modL` 맵으로 통합한다.

### 스키마 정리

- `monster` ↔ `npc` 타입 불일치 해소 (코드가 `npc`를 사용하므로 `npc`로 통일).
- `bonds` / `supporters`를 명시적 `SchemaField`로 정의.

### Phase 2 완료 기준

새 world에서 캐릭터/NPC 액터와 모든 아이템 타입을 생성했을 때 DataModel 스키마대로 데이터가 구성되고, 파생값(생명력 초기치, 소지금, 랭크/수정치 숫자값)이 기존과 동일하게 계산되는 것을 확인한다.

## 4. Phase 3 — ApplicationV2 시트 전환 (가장 큼, 템플릿 수정 동반)

### 클래스 전환

- `AmadeusActorSheet extends HandlebarsApplicationMixin(ActorSheetV2)`
  - `const { HandlebarsApplicationMixin } = foundry.applications.api`
  - `const { ActorSheetV2 } = foundry.applications.sheets`
- `AmadeusItemSheet extends HandlebarsApplicationMixin(DocumentSheetV2)`
  - `const { DocumentSheetV2 } = foundry.applications.sheets` (아이템 시트는 자동 drag/drop이 없는 DocumentSheetV2 사용)

### API 매핑

- `getData()` → `_prepareContext()`
- jQuery `activateListeners(html)` → `static DEFAULT_OPTIONS.actions` (클릭 핸들러) + `_onRender(context, options)`의 이벤트 위임(`addEventListener`)
- `static get defaultOptions()` (mergeObject) → `static DEFAULT_OPTIONS` 객체 + `static PARTS` (template 분할)
- 부모신 드롭(`_onDropItem`): ActorSheetV2의 DragDrop 메커니즘으로 재배선. 기존 능력치 6종 + `system.color` 일괄 복사 로직은 유지.

### 템플릿 수정

- form 필드는 `name` 속성 기반 자동 바인딩(`form.submitOnChange`)으로 동작하도록 조정.
- 클릭 동작 요소에 `data-action` 속성을 부여해 `actions` 핸들러와 연결.
- 기존 jQuery 토글/슬라이드 로직(`_onOpenGiftMenu` 등)은 `_onRender` 내 vanilla JS 이벤트로 재작성.

### 시트 등록 갱신

`foundry.documents.collections.Actors` / `Items` 기반으로 unregister/register를 갱신한다.

### Phase 3 완료 기준

아래 "검증 시나리오" 전 항목이 v13에서 정상 동작한다.

## 5. 검증 시나리오 (각 Phase 후 v13 수동 테스트)

1. 시스템 로드 — 콘솔에 오류/관련 deprecation 경고 없음
2. 캐릭터 시트 및 NPC 시트 열기
3. 능력치 굴림 (랭크 기반 nd6, 챗카드 표시)
4. 기프트/아이템 굴림 및 데이터 챗카드 (EMOTE 표시 형태 포함)
5. 부모신(parent) 아이템 드롭 → 능력치 6종 + 속성(color) 복사 확인
6. rolltable draw
7. 아이템 생성/삭제
8. 체크박스/메모 변경 시 업데이트 반영

## 6. 주요 리스크

- **Phase 3 (AppV2)**: form 자동 제출 방식 변경과 템플릿 마크업 수정 범위가 가장 큰 난이도다. Phase 1·2에서 안정된 데이터/API 기반을 먼저 확보함으로써 이 위험을 격리한다.
- **챗카드 EMOTE 표시**: `style` 전환 후 speaker 표시 형태가 기존과 다를 수 있어 Phase 1에서 실측 확인이 필요하다.

## 7. 작업 단위(커밋) 요약

| Phase | 커밋 접두어(예시) | 내용 |
|-------|------------------|------|
| 1 | `refactor:` | deprecated API → v13 네임스페이스 치환, AppV1 시트 유지 |
| 2 | `feat:` | DataModel 도입, 스키마 정리, 파생계산 이동 |
| 3 | `refactor:` | ApplicationV2 시트 전환, 템플릿 수정 |

(커밋 메시지는 Conventional Commits 접두어 + 한 줄 영어 요약, co-author·세부나열 없음.)
