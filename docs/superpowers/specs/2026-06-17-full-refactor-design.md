# 설계 — Amadeus 전체 리팩토링 (2026-06-17)

v13 마이그레이션 직후, 기능 추가 전에 토대를 정리하는 구조 리팩토링. 마이그레이션 현황은 `docs/superpowers/handoff-2026-06-16-v13-migration.md`, 아키텍처/빌드는 루트 `CLAUDE.md` 참조.

## 목표와 범위

- **목표**: 흩어진 굴림/챗카드 로직 통합, 죽은 코드·중복·알려진 버그 제거, 룩업 테이블 단일화. 기능 추가가 얹히기 쉬운 토대 확보.
- **전제 (동작 보존)**: 굴림 결과·챗카드 외형·시트 동작은 **현행과 동일하게 유지**한다. 내부 구조만 바꾼다.
  - **예외**: 아래 "알려진 버그"는 수정한다(동작이 의도대로 바뀜).
  - SCSS 디자인 리뉴얼은 **별개 작업**으로 이 spec 범위 밖.
  - `NpcData` 확장은 범위 밖(기능 미정, 현행 최소 구성 유지).
- **통합 구조 결정**: 하이브리드(C안). 순수·Foundry 비의존 로직만 테스트 가능 모듈로 추출하고, Foundry 결합 오케스트레이션은 문서 메서드 + 공유 헬퍼로 둔다. 사용자 코드 철학("2회 이상 재사용 시에만 추출, 과한 추상화 회피")과 테스트 목표를 동시 충족.

## 검증 전략

자동화 테스트가 0개인 코드베이스다. 회귀를 두 겹으로 막는다.

1. **순수 로직 단위테스트** (Vitest): rank→주사위 수, 주사위 해석(성공/스페셜/펌블), 초기 생명력/소지금 계산.
2. **단계별 수동 스모크** (Foundry): 능력치 굴림 / 아이템 굴림 / 활력 굴림 / 부모신 드롭 / 챗카드 외형.

각 Phase 완료 기준: `npm run build` ✓ · `npm run lint`(신규 에러 0) · `npm test` ✓ · Foundry 수동 스모크 통과.

## 아키텍처

### 신규/변경 모듈 경계

| 모듈 | 책임 | 의존 | 테스트 |
|------|------|------|--------|
| `module/dice/resolution.mjs` (신규) | **순수**: `diceCountForRank(rank)`, `resolveDie(die, modVal, dc)`, `rankVal`/`modVal`/`initHealth`/`initMoney` 계산 | 없음(`config.mjs` 상수만) | Vitest |
| `module/dice/roll.mjs` (기존 roll.mjs 이전) | Foundry `Roll` 빌더. `amadeRoll`이 `diceCountForRank` 사용 | resolution, Foundry Roll | 수동 |
| `module/chat/chat.mjs` (신규) | `postRoll({actor, formula, flavor, rollData})`, `postCard({actor, template, data, style})` — speaker/rollMode/toMessage/renderTemplate 보일러플레이트 1곳 | Foundry ChatMessage | 수동 |
| `module/documents/actor.mjs` | `rollAmadeAbl`, 활력 굴림(health.max 갱신)이 chat/resolution 헬퍼 사용 | chat, resolution | 수동 |
| `module/documents/item.mjs` | `getItemRollCard`/`getItemDataCard`가 chat/resolution 헬퍼 사용 | chat, resolution | 수동 |
| `module/sheets/actor-sheet.mjs` | 굴림 액션은 문서 메서드/`postRoll`로 위임(얇은 시트) | actor 메서드 | 수동 |

**경계 원칙**: `resolution.mjs`는 Foundry 전역(`game`, `Roll`, `ChatMessage`)을 절대 참조하지 않는다 → Vitest에서 그대로 import. 챗/굴림 부수효과는 `chat.mjs`와 문서 메서드에만 존재.

### 데이터/Config 단일화

- **결정**: `config.mjs`의 `AMADEUS.rank`/`AMADEUS.modL`을 canonical로 둔다.
  - 근거: 모든 코드가 `CONFIG.AMADEUS`로 참조하고, 시트의 UI 선택지 키 리스트(`Object.keys(CONFIG.AMADEUS.rank)`)로도 쓰인다. `config.mjs`는 순수 JS라 Vitest에서 import 가능. import가 없어 순환 위험 없음.
- `_fields.mjs`의 중복 `RANK_VAL`/`MOD_VAL` **제거**, `config.mjs`에서 import해 사용.
- `HEALTH_BY_RANK`/`HEALTH_BY_MOD`/`MONEY_BY_RANK`/`MONEY_BY_MOD`는 config 대응물이 없으므로 `_fields.mjs`에 잔류(순수 데이터 테이블).
- `resolution.mjs`는 canonical 룩업을 import해 순수 계산 제공. DataModel의 `prepareDerivedData`와 Handlebars `successCheck` 헬퍼가 동일 순수 함수를 공유 → 룩업 로직 단일화.

## 작업 단계 (순서 = 실행 순서)

### Phase 0 — 테스트 안전망 (먼저)

흩어진 굴림 로직을 건드리기 전에 회귀 기준선을 잠근다.

- Vitest devDependency 추가, `npm test` 스크립트.
- `module/dice/resolution.mjs` 신규: 위 순수 함수들. 현재 동작과 1:1(특히 `D` 랭크 → 2d6 예외를 `diceCountForRank` 한 곳에 집약; `resolveDie`는 현 `successCheck` 헬퍼 로직과 동일: `die==1`→fumble, `die==6`→special, `die+modVal>=dc`→success, 그 외 fail).
- characterization 테스트로 현재 동작 고정.

### Phase 1 — 죽은 코드 / 버그 제거 (저위험)

- `item.mjs`: `getAmadeDiceCard`(주석 죽은코드 포함) 삭제, `_getGiftChatCard`(미사용 중복) 삭제, `getItemDataCard`의 빈 `if` 분기(background/parent) 제거, `getKeybyValue` import 제거.
- `templates.mjs`: `getBond`/`getSupporter` 헬퍼 **삭제**(어떤 템플릿도 미사용, `index` 미정의 실버그). preload 목록에서 죽은 `actor-spells.html` 제거. (`actor-features.html`은 캐릭터 시트에서 사용 중 → 유지.)
- `config.mjs`: 미사용 `getKeybyValue` 삭제(마지막 참조가 item.mjs 주석뿐).
- `amadeus.mjs`: nd6와 무관한 `CONFIG.Combat.initiative`(`1d20+@abilities.dex.mod`) 정리. 인라인 `concat`/`toLowerCase` 헬퍼를 `templates.mjs`의 `registerHandlebarsHelpers`로 이전(헬퍼 등록 일원화). **`rollItemMacro`를 `game.amadeus`에 노출**(핫바 매크로가 `game.amadeus.rollItemMacro`를 호출하는데 미노출 → 현재 깨짐. 버그 수정).
- 레거시 템플릿 삭제: `item-sheet.html`, `item-spell-sheet.html`, `item-feature-sheet.html`, `actor-spells.html`(현 Item 타입/PARTS·partial 어디에도 참조 없음).

### Phase 2 — Config / 룩업 단일화

- 위 "데이터/Config 단일화"대로 `RANK_VAL`/`MOD_VAL` 중복 제거, canonical(`config.mjs`)로 통일.
- DataModel `prepareDerivedData`와 `successCheck` 헬퍼가 `resolution.mjs` 순수 함수 사용하도록 전환.
- 시트의 `context.label.rank`/`context.label.mod` 생성도 단일 소스 사용.

### Phase 3 — Roll / ChatCard 통합 (핵심)

- `roll.mjs` → `module/dice/roll.mjs`로 이전, `amadeRoll`이 `diceCountForRank` 사용.
- `module/chat/chat.mjs` 신규: `postRoll`/`postCard`.
- `actor.rollAmadeAbl`, `item.getItemRollCard`/`getItemDataCard`를 chat/resolution 헬퍼 사용으로 재작성.
- 시트 4개 인라인 굴림 핸들러(`#onRoll`/`#onDamageRoll`/`#onVitalityRoll`/`#onGiftFormulaRoll`)를 `postRoll`/문서 메서드로 위임. 활력 굴림의 `health.max` 갱신은 `actor` 메서드로 이동.

### Phase 4 — 시트/템플릿 잔여 정리

- `actor-sheet.mjs` `_onDropItem`의 부모신 능력치 복사 거대 객체 리터럴 → 6능력치 키 루프로 축약.

## 위험과 완화

- **굴림 결과 회귀**: Phase 0 단위테스트가 순수 해석을 고정. 통합(Phase 3) 시 동일 함수 재사용으로 결과 동일성 보장.
- **챗카드 외형 회귀**: `postCard`는 동일 템플릿·동일 데이터를 렌더 → 출력 동일. Phase 3 후 수동 스모크로 확인.
- **Config 단일화 import 순환**: `config.mjs`는 import가 없어 안전. `_fields`/`resolution`이 config를 단방향 참조.
- **단계 독립성**: Phase 0/1은 서로 독립. 2는 0(resolution) 의존. 3은 0·2 의존. 4는 독립. 각 Phase 단독 커밋·검증.
