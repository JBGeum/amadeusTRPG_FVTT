# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**Amadeus**(`id: amadeus`)는 일본 TRPG "아마데우스"를 위한 Foundry VTT **게임 시스템**이다. Foundry의 공식 **Boilerplate System** 템플릿을 기반으로 작성되었으며, UI/룰 텍스트는 전부 한국어(`lang/ko.json`만 존재)다.

- 현재 `system.json`의 `compatibility`는 **minimum 10 / verified 10.287** — 즉 v10~v11 시대에 멈춰 있는 코드베이스다.
- **이 저장소의 목표는 Foundry VTT v13 이상에서 동작하도록 업데이트/리팩토링하는 것이다.** 아래 "v13 마이그레이션 핵심 포인트"가 작업의 중심이다.

## 빌드 & 개발 명령어

빌드 도구는 **Vite**다(구 gulp 스택은 제거됨). 진입점 `module/amadeus.mjs`가 `scss/amadeus.scss`를 import하며, Vite가 JS와 SCSS를 함께 번들해 `dist/amadeus.mjs` + `dist/amadeus.css`를 생성한다.

**`dist/`는 자립형(self-contained) 시스템 패키지다.** `vite-plugin-static-copy`가 빌드 시 `system.json`·`template.json`·`lang/`·`templates/`·`icons/`·`packs/`·`LICENSE.txt`를 `dist/` 루트로 복사하므로, **`dist/` 폴더 하나만 Foundry 서버의 `systems/amadeus`로 배포하면 완전한 시스템이 된다.** 따라서 `system.json`의 경로(`esmodules: "amadeus.mjs"`, `packs: "packs/items"`, `lang: "lang/ko.json"` 등)는 **dist 루트 기준**으로 작성되어 있다(프로젝트 루트를 직접 시스템 폴더로 쓰지 않음).

```bash
npm install        # 의존성 설치 (최초 1회)
npm run build      # vite build — dist/ 로 번들 (배포/실행 전 필수)
npm run dev        # vite build --watch — 소스 변경 시 자동 재빌드
npm run lint       # ESLint (flat config, Foundry 전역 등록됨)
npm run lint:fix   # ESLint 자동 수정
npm run format     # Prettier 포맷 적용
```

- **`dist/`는 빌드 산출물이라 git 추적 제외**(`.gitignore`)다. 클린 체크아웃 후에는 반드시 `npm run build`를 먼저 실행해야 `dist/`가 생성된다.
- **배포**: Foundry는 별도 서버에서 동작하며, 빌드된 `dist/`를 서버의 `systems/amadeus`로 업로드해 사용한다. JS/CSS뿐 아니라 `system.json`·`templates/` 등 모든 변경이 `dist/`에 모이므로 `dist/`만 올리면 된다.
- **CSS의 이미지 참조는 런타임 절대경로(`/systems/amadeus/icons/...`)를 쓴다** — 상대경로(`../icons/...`)로 쓰면 Vite가 base64로 인라인해 CSS가 비대해진다.

### 컴펜디엄 팩 빌드 (Foundry CLI)

`tools/packs.mjs`가 `@foundryvtt/foundryvtt-cli`로 LevelDB ↔ YAML 텍스트 소스를 변환한다.

```bash
npm run pack:extract   # packs/<name> (LevelDB) → src/packs/<name>/*.yaml (diff 가능한 소스)
npm run pack:compile   # src/packs/<name> → packs/<name> (Foundry가 로드)
```

팩 데이터를 수정할 때는 `extract`로 YAML을 뽑아 편집·커밋한 뒤 `compile`로 LevelDB를 재생성하는 흐름을 쓴다.

### 테스트 / 린트

자동화된 단위 테스트는 없다. ESLint는 도입돼 있으나(`npm run lint`) 기존 코드에 다수의 경고와 실 버그(예: `helpers/templates.mjs`의 `getBond`/`getSupporter` — `index` 미정의)가 남아 있다. 동작 검증은 Foundry VTT에 시스템을 설치(`Data/systems/amadeus`에 심볼릭 링크 또는 복사)한 뒤 브라우저 콘솔과 시트 동작으로 수동 확인한다.

## 아키텍처

### 진입점과 등록 (`module/amadeus.mjs`)
`init` 훅에서 모든 것을 배선한다:
- `game.amadeus`에 `AmadeusActor`/`AmadeusItem` 노출
- `CONFIG.AMADEUS = AMADEUS` (설정 상수 주입)
- DataModel 등록 (`Object.assign(CONFIG.Actor.dataModels, …)`, `CONFIG.Item.dataModels`)
- 커스텀 Document 클래스 등록 (`CONFIG.Actor.documentClass`, `CONFIG.Item.documentClass`)
- 코어 시트 unregister 후 `AmadeusActorSheet`/`AmadeusItemSheet` 등록 (`foundry.documents.collections.*`)
- Handlebars 헬퍼 등록 + 템플릿 프리로드

### 데이터 모델 (`module/data/`, v13 DataModel)
시스템 데이터 스키마는 **`foundry.abstract.TypeDataModel` 클래스로 정의**된다(`module/data/`). `template.json`은 **타입 목록만** 선언하고(`Actor`: `character`/`npc`, `Item`: 7종), 스키마는 DataModel이 담당한다.
- `module/data/_fields.mjs`: 재사용 스키마 헬퍼(`abilityField`/`abilitiesField`) + 파생 계산용 룩업 상수(`RANK_VAL`/`MOD_VAL`/`HEALTH_BY_*`/`MONEY_BY_*`).
- `actor-character.mjs`(`CharacterData`), `actor-npc.mjs`(`NpcData`), `item-data.mjs`(아이템 7종 DataModel).
- **Actor 타입**: `character`, `npc` (구 `monster`는 `npc`로 통일됨).
- **Item 타입**: `gift`(기프트), `background`(배경), `parent`(부모신), `weapon`, `gear`, `memory`(추억), `treasure`.
- 핵심 능력치(`ability`)는 6종: `warfare/technique/brain/spirit/love/mundane`. 각각 **랭크(S~D)** 와 **수정치(`+++`~`--`)** 문자열을 가진다.
- 파생값(`rankVal`/`modVal`/`initHealth`/`initMoney`)은 각 DataModel의 `prepareDerivedData()`에서 계산한다.

### 굴림(Roll) 시스템 — 시스템의 핵심 메커니즘
아마데우스는 d20이 아니라 **랭크 기반 nd6** 시스템이다 (`module/documents/roll.mjs`):
- 능력치 랭크 → 주사위 개수: `S=4d6, A=3d6, B=2d6, C=1d6, D=2d6`(D는 예외적으로 2d6).
- 각 주사위에 수정치(`modVal`)를 더해 목표치(`dc`, 기본 4)와 비교, **주사위 하나하나가 개별 성공/실패** 판정된다. `1=펌블`, `6=스페셜`(헬퍼 `successCheck` 참조).
- `CharacterData.prepareDerivedData()`(`module/data/actor-character.mjs`)가 랭크/수정치 **문자열 → 숫자값**(`rankVal`, `modVal`) 변환과 생명력 초기치(`initHealth`)·소지금 초기치(`initMoney`)를 `_fields.mjs`의 룩업 상수로 계산한다.
- **파생값은 시트로 prepared 데이터로 전달해야 한다**: `actor-sheet.mjs`의 `getData()`는 `this.actor.system`(파생 포함)을 넘긴다 — `toObject(false)`(source)는 `initHealth`/`initMoney` 등 파생값을 포함하지 않으므로 사용하면 안 된다.
- **생명력 표시**: 좌측 `health.value`는 실제 변동 HP(빈칸 유지), 우측 `health.max`는 비었을 때 `initHealth`를 placeholder로 흐릿하게 표시한다. 활력 굴림(`_onRollVitality`)은 `health.max`에 `initHealth + 활력`을 또렷한 값으로 자동 입력한다.

### 시트와 챗 카드 흐름
- **시트 템플릿은 타입별로 분기**: `get template()`이 `actor-${type}-sheet.html` / `item-${type}-sheet.html`을 반환한다. (`defaultOptions`에 적힌 `actor-sheet.html`은 실제로 존재하지 않으며 `get template()`이 덮어쓴다.)
- `actor-sheet.mjs`의 `_prepareItems`가 소유 아이템을 타입별 컨테이너(gifts/background/parent/inventory/memory/treasure)로 분류해 컨텍스트에 넣는다.
- 굴림/액션 결과는 `renderTemplate("systems/amadeus/templates/chatcard/...")`로 **챗 카드 HTML을 만들어 `ChatMessage.create`** 로 출력한다. 능력치 굴림은 `actor.rollAmadeAbl`, 아이템 굴림은 `item.getItemRollCard` / `item.getItemDataCard`가 담당.
- **부모신(parent) 드롭 로직이 특수**: `actor-sheet.mjs`의 `_onDropItem`에서 parent 아이템을 드롭하면 기존 parent를 제거하고 6개 능력치 랭크/수정치 전체를 액터에 일괄 복사한다.

### 보조 모듈
- `module/helpers/config.mjs` — `AMADEUS` 설정 상수(능력치/배경/색상/기프트 분류 등 i18n 키 맵) + `getKeybyValue` 유틸.
- `module/helpers/templates.mjs` — 프리로드 대상 partial 목록 + Handlebars 헬퍼(`checked`, `successCheck`, `formatModVal`, `times` 등). 참고: `getBond`/`getSupporter` 헬퍼는 정의된 `index` 변수가 없어 **버그 상태**다.
- `module/helpers/effects.mjs` — Active Effect 관리(코어 보일러플레이트 그대로).

### 컴펜디엄 팩 (`packs/`)
**LevelDB 디렉토리 형식**(v11+)으로 전환 완료: `packs/items/`, `packs/parents/`, `packs/rolltable/`가 데이터를 보유한다. `gifts` 팩은 데이터가 없어 디렉토리가 없으며 Foundry 첫 실행 시 자동 생성된다. `system.json`의 `packs[].path`는 확장자 없는 디렉토리 경로(`packs/items` 등)를 가리킨다. LevelDB의 런타임 파일(`LOCK`, `LOG`, `LOG.old`)은 `.gitignore`로 추적 제외하고, 실제 데이터(`*.ldb`, `*.log`, `CURRENT`, `MANIFEST-*`)만 커밋한다.

## v13 마이그레이션 핵심 포인트

이 코드베이스를 v13+로 올릴 때 손봐야 할 deprecated/제거된 API들. (수정 전 반드시 해당 버전의 공식 마이그레이션 노트로 교차 확인할 것 — 추측 금지.)

1. **전역 유틸 네임스페이스화**: `mergeObject(...)`, `duplicate(...)`, `DEFAULT_TOKEN` 등 전역 호출 → `foundry.utils.mergeObject`, `foundry.utils.duplicate` 등으로 이동. (`actor-sheet.mjs`, `item-sheet.mjs`에서 사용 중)
2. **컴펜디엄 팩 포맷**: NeDB `.db` → LevelDB 디렉토리 팩 전환 **완료**(`system.json` path도 디렉토리로 갱신됨). 남은 작업은 팩 내부 문서가 새 DataModel 스키마와 일치하는지 검증하는 것.
3. **데이터 모델**: `template.json` 선언 방식은 여전히 지원되나, v13에서는 `defineSchema` 기반 **DataModel 클래스**가 권장된다. `monster` vs `npc` 타입 불일치도 이때 정리.
4. **시트 API**: `ActorSheet`/`ItemSheet`(AppV1)는 v13에서 `foundry.appv1.sheets.*`로 이동했고 장기적으로 **ApplicationV2 / HandlebarsApplicationMixin** 전환이 권장된다. jQuery `activateListeners` 기반 이벤트 → AppV2의 `actions`/이벤트 위임으로 재작성 고려.
5. **템플릿/렌더 헬퍼**: `loadTemplates`, `renderTemplate` → v13에서 `foundry.applications.handlebars.*` 네임스페이스로 이동(전역은 deprecated).
6. **Roll**: `roll.evaluate({async: true})`의 `async` 옵션은 제거됨 → `await roll.evaluate()`. (`roll.mjs`)
7. **ChatMessage**: `ChatMessage.create({ type: 3 })`처럼 숫자 타입 지정(`CHAT_MESSAGE_TYPES`)은 v12+에서 deprecated → `style` 사용. (`item.mjs`의 `getItemRollCard`)
8. **전역 문서 컬렉션**: `Actors`, `Items` 전역 → `foundry.documents.collections.*` 이동.
9. **`system.json`**: `compatibility.minimum`/`verified`를 13으로 갱신, 비어 있는 `url`/`manifest`/`download` 채우기, 존재하지 않는 `CHANGELOG.md` 참조 처리.

## 코드 컨벤션 메모

- 원작 한국어 룰 용어가 식별자/주석/i18n 값에 그대로 쓰인다(예: 기프트=gift, 부모신=parent, 추억=memory). 새 코드도 이 매핑을 따를 것.
- 원작자(`schmm` 주석)의 한국어 개발 메모가 코드 곳곳에 남아 있다 — 룰 의도를 파악할 단서이므로 무리하게 제거하지 말 것.
- 능력치 랭크/수정치를 다루는 `switch` 룩업 테이블이 `actor.mjs`에 중복되어 있다(`_calculateInitHealth`, `_calculateInitMoney`, `_setRankModLetter`). 리팩토링 시 `config.mjs`의 `AMADEUS.rank`/`AMADEUS.modL` 맵으로 통합 가능.
