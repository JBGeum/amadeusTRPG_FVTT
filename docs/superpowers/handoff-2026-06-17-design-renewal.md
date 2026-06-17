# Handoff — Amadeus 디자인 리뉴얼 준비 (2026-06-17)

다음 세션이 이어받기 위한 현황 스냅샷. **다음 작업 = 디자인 시안 기반 전역 SCSS 정돈.** 아키텍처/빌드 상세는 루트 `CLAUDE.md` 참조.

## 한 줄 요약

v13 마이그레이션 이후 이번 세션에서 **전체 리팩토링 + 챗 출력 템플릿화 + 비밀 플롯 이니셔티브 기능**을 완료해 모두 `develop`에 통합했다. 기능·로직은 정상 동작하나 **시트/신규 UI의 SCSS 스타일이 비어 있거나 AppV2 DOM과 안 맞는 상태** → 다음 작업은 시안에 맞춘 전역 디자인 정돈이다.

## 브랜치 상태 (중요)

- 현재 작업 브랜치: **`develop`**.
- `develop`은 `master`(`07d577f`)보다 **36커밋 앞섬**. 즉 이번 세션 작업 전부 `develop`에만 있고 **`master` 미반영**.
- `develop`은 **로컬에서 `origin/develop`보다 34커밋 앞섬 — 아직 push 안 함**(사용자가 푸시 요청 시에만).
- 작업 트리 clean.
- 정적 검증: `npm run build` ✓, `npm test` **22 passed**(Vitest), `npm run lint` **0 errors / 2 warnings**(기존: `actor.mjs`의 미사용 `data`/`options` 인자).

## 이번 세션 완료 작업 (전부 develop)

1. **전체 리팩토링** — spec `docs/superpowers/specs/2026-06-17-full-refactor-design.md`, plan `docs/superpowers/plans/2026-06-17-full-refactor.md`. 14 Task:
   - **Vitest 도입**(`npm test`), 순수 로직 `module/dice/resolution.mjs`(주사위 수/해석/초기치) + 단위테스트
   - 죽은 코드/버그 제거, 룩업 단일화(`config.mjs` canonical), roll/chatcard 통합 → `module/chat/chat.mjs`(`postRoll`/`postCard`), 시트 굴림 위임
   - 스모크 중 잡은 **기존 마이그레이션 버그 3건**: ① `_prepareItems` 항목 키 `id`→`_id`(템플릿 `data-item-id="{{x._id}}"`와 불일치로 모든 아이템 액션 무동작이던 것) ② 식량 1D6 회복 굴림 ③ 식량 카드 자립형화(하드코딩 월드 아이템 의존 제거)
2. **챗 출력 템플릿화** — `item.roll()`의 raw 설명 출력을 `templates/chatcard/data-description.html`로 분리, 빈 `roll-item.html` 제거. **이제 모든 커스텀 챗 출력이 템플릿 기반**(`.chatcard.*-chatcard`).
3. **비밀 플롯 이니셔티브** — spec `docs/superpowers/specs/2026-06-17-plot-initiative-design.md`, plan `docs/superpowers/plans/2026-06-17-plot-initiative.md`. 8 Task:
   - `module/initiative/`(`order.mjs`·`session.mjs`·`socket.mjs`·`gm-panel.mjs`·`plot-prompt.mjs`), 템플릿 `templates/initiative/`·`templates/chatcard/plot-{done,result}.html`, i18n `AMADEUS.initiative.*`, 씬 컨트롤
   - **디버깅 핵심**: 커스텀 소켓이 클라 간 중계 안 되던 원인 = `system.json`에 **`"socket": true` 누락**(추가함). Foundry는 이 플래그가 있어야 `system.<id>` 네임스페이스를 할당·중계함.
   - 참가자 정합성 픽스(`#onStart`가 `user.character` 기준 등록 → 프롬프트의 `game.user.character`와 일치), '6' 표시를 '권외'로(값은 6 유지, `plotLabel` 헬퍼).

## 다음 작업: 전역 디자인 정돈 (시안 기반)

> 사용자: 디자인 시안을 받아 전역 디자인을 정돈할 예정. **시안 확정 후 brainstorming부터 시작할 것.**

### 핵심 문제 — SCSS ↔ AppV2 DOM 불일치
시트가 ApplicationV2로 전환되며 렌더 DOM이 바뀌었으나(`<form>` 자동 생성, 최상위 `.application` 클래스, `.window-content`가 `div`) 기존 SCSS는 **AppV1 구조를 가정**한다. 그래서 색/배경 등 스타일이 적용되지 않고 Foundry 기본 스타일이 노출된다.
- 예: `scss/global/_window.scss`의 `.window-app`, `scss/amadeus.scss`의 `.sheet.actor section.window-content` 등 → 실제 AppV2 렌더 DOM에 맞춰 셀렉터 갱신 필요.
- **방법**: F12로 실제 시트/앱의 렌더 DOM을 확인하고 셀렉터를 그 구조에 맞춘다(추측 금지).

### SCSS 구조 (`scss/`, Vite가 번들 → `dist/amadeus.css`)
- 진입 `scss/amadeus.scss`
- `global/`: `_flex.scss` `_grid.scss` `_window.scss`
- `components/`: `_chatcard.scss` `_effects.scss` `_forms.scss` `_items.scss` `_resource.scss`
- `utils/`: `_colors.scss` `_mixins.scss` `_typography.scss` `_variables.scss`

### 스타일링 대상(셀렉터 토대는 이미 마련됨)
- **챗 카드**: 일관된 `.chatcard.<type>-chatcard`로 통일됨 — `data-gift`/`data-item`/`data-description`/`roll-amadeabl`/`roll-gift`/`plot-done`/`plot-result`. `_chatcard.scss`에서 잡기 좋음.
- **신규 플롯 UI**: 아직 **스타일 0** 상태. 셀렉터:
  - 플레이어 프롬프트: `.plot-prompt`, `.plot-dice`, `.plot-die`(`.selected`), `.plot-prompt-status`
  - GM 패널: `.plot-gm-panel`, `.plot-gm-controls`, `.plot-gm-roster`, `.plot-p-name/type/value`, `.plot-p-submitted/pending`, `.plot-npc-dice`, `.plot-npc-die`(`.selected`), `.plot-gm-addnpc`, `.plot-gm-order`
  - 결과/완료 카드: `.plot-result-chatcard`, `.plot-order`, `.plot-slot`, `.plot-rank`, `.plot-value`, `.plot-members`, `.plot-notsubmitted`, `.plot-done-chatcard`
- **시트**: 액터(character/npc), 아이템 7종. AppV2 DOM 기준으로 셀렉터 재정비 필요.

### SCSS 주의점
- **CSS 이미지 참조는 런타임 절대경로** `/systems/amadeus/icons/...` 사용. 상대경로(`../icons/...`)면 Vite가 base64 인라인 → CSS 비대.
- `vite.config.js`에서 `@import` deprecation 경고는 의도적으로 억제(Dart Sass). `@use`/`@forward` 전환은 스타일 회귀 검증 필요한 **별도 작업**.

## 빌드·검증·배포 워크플로우 (중요)

- **빌드**: `npm run build` → `dist/`(자립형: `amadeus.mjs`/`amadeus.css` + `system.json`/`template.json`/`lang`/`templates`/`icons`/`packs` 복사). `dist/`는 git 추적 제외.
- **배포**: 빌드된 **`dist/`만** 서버 `systems/amadeus`로 업로드.
- **재시작 규칙**:
  - `system.json`(매니페스트) 변경 → **Foundry 서버 재시작 필수**(브라우저 새로고침으로 부족). 예: 이번 `"socket": true` 추가는 재시작해야 적용됐음.
  - 템플릿/`lang`/JS/CSS만 변경 → **브라우저 새로고침**으로 충분.
- **검증**: `npm test`(Vitest, 순수 로직만) + `npm run lint` 정적 + Foundry 수동. **멀티 클라이언트 기능(플롯)은 GM + 플레이어 2클라로** 테스트(플레이어는 배정 캐릭터 필요).

## 알려진 이슈·향후 정리(선택, 비차단)

- lint 경고 2건: `actor.mjs`의 미사용 `data`/`options` 인자(기존, 범위 밖).
- 최종 리뷰가 짚은 cosmetic: `module/data/actor-character.mjs:73` 옛 메서드명 언급 주석, `module/dice/roll.mjs`의 잔존 `rankVal` 파라미터(호출부 호환용, 미사용).
- 플롯: 세션 상태는 GM 메모리 임시(새로고침 시 진행 중 세션 소실, 합의됨). 비밀성은 UI 수준(협력 테이블 가정).

## 다음 세션 시작 가이드

1. `CLAUDE.md` 읽기(아키텍처/빌드/DataModel/시트 패턴 최신).
2. **디자인 작업이면 시안 확정 후 brainstorming 스킬부터.**
3. SCSS 셀렉터 갱신 전, F12로 **AppV2 실제 렌더 DOM 확인**(추측 금지). 신규 `.plot-*`/`.chatcard.*-chatcard`는 셀렉터가 이미 명확해 스타일 추가만 하면 됨.
4. 변경 후 `npm run build` → `dist/` 배포 → (매니페스트 안 건드리면) 브라우저 새로고침으로 확인.
