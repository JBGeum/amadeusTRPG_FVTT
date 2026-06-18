# Handoff — 무드 다이스 기능 + 액터 시트 수정 (2026-06-18)

다음 세션이 이어받기 위한 현황 스냅샷. **다음 작업 = 무드 다이스 기능의 Foundry 수동 검증.** 아키텍처/빌드 상세는 루트 `CLAUDE.md` 참조.

## 한 줄 요약

디자인 리뉴얼(이전 핸드오프) 완료 이후, 이번 세션에서 **① D랭크 "사용 불가" 다이스 표시**, **② 무드 다이스 선택 기능(신규)**, **③ 액터 시트 리사이즈/스크롤 버그 수정**을 구현하고 전부 `develop`에 커밋 + **`origin/develop` push 완료**(HEAD `00912ec`). 정적 검증(build/lint/test) 통과. **무드 다이스의 Foundry 런타임 수동 검증만 미수행.**

## 브랜치 상태 (중요)

- 현재 작업 브랜치: **`develop`**, 작업 트리 clean.
- **`develop` = `origin/develop`** (push 완료, 동기화됨).
- `develop`은 여전히 **`master` 미반영**. master 병합/PR은 사용자 요청 시에만.
- 정적 검증: `npm run build` ✓, `npm run lint` **신규 0**(기존 baseline 9건: `docs/design/support.js` 3 errors + `actor.mjs` 미사용 인자 등), `npm test` **36 passed**(Vitest).

## 이번 세션 완료 작업 (전부 develop, push됨)

### 1. D랭크 "사용 불가" 다이스 표시 (`05fefb7`)
아마데우스 D랭크는 2d6 중 **높은 주사위를 판정에서 버린다**. 그 주사위를 챗카드에 "사용 불가"로 흐리게 표시. `module/dice/resolution.mjs`의 `buildDiceset(values, rank)`가 D랭크면 최댓값 인덱스를 `disabled:true`로 표시 → 챗카드(`roll-amadeabl`/`roll-gift`)·`_chatcard.scss`에서 흐림 처리. **회귀 아니라 원래 없던 기능이었음**(git 이력 전수 확인).

### 2. 무드 다이스 선택 기능 (신규)
spec `docs/superpowers/specs/2026-06-18-mood-dice-design.md`, plan `docs/superpowers/plans/2026-06-18-mood-dice.md`. **subagent-driven 5 Task** 실행 + 2단계 리뷰(spec/품질).

**룰**: 2개 이상 주사위 판정(성공/실패, 대미지/회복 제외)에서 PL이 **판정 다이스 1개**(최종 성공/실패, 의도적 실패 가능)와 **무드 다이스 1개**(눈의 색을 카운트)를 고른다. 3개+면 나머지 버림, 결과는 **단일** 성공/실패. 눈→색 `1黑 2赤 3靑 4綠 5白 6黃`, **6=스페셜→PL이 흑적청녹백 중 색 선택**. 1=흑(펌블이어도 색은 흑). 판정 다이스의 펌블/스페셜은 카드에 **표기만**(효과는 GM 수동). **색 수치 자체는 시스템이 저장하지 않음**(GM 수동 관리) — 기능 역할은 **무드 색을 챗카드로 출력**까지. **1다이스·D랭크는 자동**(다이얼로그 없이 판정1, 무드 없음).

**구현**:
- `module/dice/resolution.mjs`(순수, Vitest): `dieColor`/`colorToFace`/`usableCount`/`autoJudgeIndex`/`buildMoodResult`.
- `module/mood/mood.mjs`: 공통 진입 `resolveMoodDice({actor,values,rank,modVal,dc,label})` — 사용가능<2면 자동, ≥2면 다이얼로그 → 결과 카드.
- `module/mood/mood-dialog.mjs`: **닫기 불가**(확정 필수) AppV2 다이얼로그. `static prompt()`가 `{judgeIndex,moodIndex,specialColor}` Promise 반환. 6 선택 시 색 선택 UI. **`#current` 싱글톤 가드**(동시 2굴림 시 직전 다이얼로그 강제 닫아 Promise hang 방지). plot-prompt 패턴 준수.
- `templates/dialog/mood-dialog.html`, `templates/chatcard/mood-result.html`(결과 카드 2개째).
- `module/helpers/templates.mjs`: `outcomeLabel`·`colorFaceLit` 헬퍼 + `mood-result.html` 프리로드.
- `module/documents/actor.mjs`(`rollAmadeAbl`)·`item.mjs`(`getItemRollCard` gift 분기): 굴림 카드 후 `resolveMoodDice` 호출(카드 2개 흐름).
- `lang/ko.json`: `AMADEUS.mood.*`.
- 색 스와치는 `colorToFace`로 기존 `.chat-die-chip--N`(die-face 색) 재사용. 다이얼로그 칩 색은 `_dialog.scss`에 `@include die-face-colors` 추가(`.amadeus-chat` 외 스코프라 누락됐던 것 보정).
- **소켓 불필요**(단방향: 굴린 본인 클라에서 다이얼로그→`ChatMessage.create`).

### 3. 액터 시트 리사이즈/스크롤 수정 (`3b864d7`, `00912ec`)
디자인 리뉴얼 후 액터 시트 전용 증상 3종, 전부 `scss/components/_sheet-actor.scss`:
- **리사이즈 커서가 안 바뀜**: 핸들(`.window-resize-handle`)이 `z-index:auto`라 전면(full-bleed) 콘텐츠에 stacking으로 깔림 → `z-index:10`으로 올림(핸들은 `position:absolute`).
- **긴 탭 콘텐츠 잘림 + 스크롤바 없음**: `.window-content`(Foundry AppV2 flex 컬럼)의 자식 `.sheet-inner`가 기본 `flex-shrink:1`로 컨테이너 높이까지 줄어든 뒤 `overflow:hidden`으로 콘텐츠를 잘라냄(예: 콘텐츠 1059px가 811px로 잘림). → **`.sheet-inner { flex-shrink: 0 }`** 로 콘텐츠 높이만큼 커지게 해 `window-content`가 스크롤. (+보조 `.window-content { min-height: 0 }`)
- 기본 height `860→1000` 복원(`actor-sheet.mjs`).

## 알아둘 것: 창 최대 높이 제한(버그 아님)

액터 시트를 일정 높이(예: ~810px) 이상으로 **드래그해 키울 수 없는 건 Foundry 전역 동작**이다. AppV2가 창 최대 높이를 **브라우저 뷰포트(`window.innerHeight`)에서 여백을 뺀 값**으로 제한한다(예: `innerHeight 868` → 상한 ~810). 모니터에 여유가 있어도 브라우저 크롬/작업표시줄 때문에 `innerHeight`가 작으면 거기에 묶인다. **코드 수정 대상 아님** — 더 키우려면 브라우저 F11 전체화면/북마크바 숨김으로 뷰포트를 넓힌다. `FixedWidthMixin`은 width만 고정(height 리사이즈는 정상).

## 다음 작업: 무드 다이스 Foundry 수동 검증 (서브에이전트/정적검증 불가 영역)

`dist/` 배포 후 브라우저 새로고침(매니페스트 미변경). 점검:
- **B/A/S 랭크 굴림**(능력치·기프트) → 굴림 카드 직후 무드 다이얼로그 자동 팝업.
- 판정+무드 둘 다 골라야 확정 버튼 활성, **X/ESC로 안 닫힘**(닫기 불가).
- **무드=6 선택 시 5색 선택 UI** 노출, 색 골라야 확정 가능.
- 확정 후 **결과 카드**: 판정 다이스 색칩+성공/실패/펌블/스페셜, 무드 다이스 색칩+색이름(6이면 선택색+스페셜 배지).
- **C/D랭크·1다이스** → 다이얼로그 없이 결과 카드(무드 없음) 자동.
- **멀티클라(GM+PL)**: 다이얼로그는 굴린 본인만, 결과 카드는 전원. **동시 2굴림** 시 직전 다이얼로그 강제 닫힘.
- 다이얼로그 색칩/라이트·다크 테마 정상.

## 다음 세션 시작 가이드

1. `CLAUDE.md` + 이 핸드오프 읽기.
2. `dist/` 배포 후 위 무드 다이스 체크리스트로 수동 검증.
3. 어긋나는 외형/동작은 F12로 실제 DOM 확인 후 보정(추측 금지). 토큰은 `_tokens.scss` 한 곳.
4. 변경 후 `npm run build` → `dist/` 재배포 → 새로고침. 멀티클라 기능은 GM+PL 2클라.
5. 배포: `npm run build` → **`dist/`만** 서버 `systems/amadeus`로. 매니페스트(`system.json`) 변경 시에만 Foundry 재시작.
