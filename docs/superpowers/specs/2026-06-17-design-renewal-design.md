# 디자인 리뉴얼 설계 — Amadeus (2026-06-17)

시안(`docs/design/*.dc.html`) 기반으로 전역 디자인을 정돈한다. v13 마이그레이션·리팩토링·플롯 기능은 완료됐고 기능은 정상이나, 시트가 ApplicationV2로 전환되며 DOM이 바뀌어 기존 SCSS(AppV1 가정)가 안 맞아 외형이 깨진 상태다. 신규 플롯/챗 UI는 스타일이 비어 있다.

## 목표와 범위

**목표**: 시안 3종(캐릭터 액터 시트 · 이니셔티브 · 챗카드)을 시안 그대로 풀 구현한다. 템플릿 DOM을 시안 구조로 재작성하고, SCSS를 CSS 커스텀 프로퍼티 토큰 시스템으로 전환한다.

**범위에 포함**:
- 캐릭터 액터 시트(`actor-character-sheet.html`) DOM 재작성 + 스타일
- 이니셔티브 다이얼로그(`gm-panel.html`, `plot-prompt.html`) 스타일
- 챗카드(`data-*`, `roll-*`, `plot-*` 템플릿 + `_chatcard.scss`) 스타일
- SCSS 토큰 레이어 신설 및 전역 컴포넌트 토큰 참조 전환
- 라이트/다크 테마 시스템 자체 토글(클라이언트 설정 + 시트 헤더 컨트롤)
- 폰트 교체(시안 폰트)

**범위에서 제외(깨지지만 않게 정돈)**:
- NPC 시트(`actor-npc-sheet.html`): 공통 토큰만 상속, 레이아웃 재설계 안 함
- 아이템 7종 시트(`item-*-sheet.html`): `_forms.scss` 토큰 정리 수준, 레이아웃 재설계는 후속 과제
- SCSS `@import`→`@use`/`@forward` 전환(별도 작업)

## 결정 사항(확정)

1. **풀 구현** — 템플릿 DOM 재작성 + SCSS 토큰 전면 도입(시안과 1:1).
2. **범위 = 시안 3종**, NPC/아이템 시트는 토큰만.
3. **라이트/다크 = 시스템 자체 토글**(코어 테마 연동 아님).
4. **SCSS 아키텍처 = 런타임 CSS 커스텀 프로퍼티 토큰**(접근법 A). 컴파일타임 생성(B)·점진 확장(C) 기각.

## 아키텍처

세 레이어로 분리한다.

```
토큰 레이어 (SCSS)        팔레트를 CSS 변수로 정의
  · 시트:   .amadeus.sheet[data-skin][data-theme]   5속성 × 라/다 = 10
  · 다이얼로그: .amadeus-dlg[data-theme]             중립 골드, 라/다 = 2
  · 챗카드:  .amadeus-chat (.pc)                     양피지 고정(테마 무관)
        ▲ var(--bg/--panel/--gold/--acc/...) 참조
컴포넌트 레이어 (SCSS)    global/ + components/, 색은 var() 토큰으로만
        ▲ 클래스/속성 부여
배선 레이어 (JS + HBS)    DOM 재작성, data-skin/data-theme 주입, 토글
```

### 테마 적용 매트릭스

| 영역 | `data-skin`(속성) | `data-theme`(라/다) | 근거 |
|------|:---:|:---:|------|
| 캐릭터 액터 시트 | 5속성 | O | `system.color`로 skin 결정 |
| 이니셔티브 다이얼로그(GM/플레이어) | 중립 | O | 시안 `.dlg` 중립 골드 |
| 챗카드(아이템/굴림/플롯) | — | **고정** | 시안 `.pc` 양피지 — 채팅 로그 일관성 |

라이트/다크 토글은 **시트와 다이얼로그에만** 영향을 주고, **챗카드는 양피지 톤으로 고정**한다.

### 속성↔skin 매핑

`system.color`는 `black`/`red`/`blue`/`green`/`white`(`config.mjs`의 `AMADEUS.color`)이며, 부모신(parent) 아이템 드롭 시 자동 설정되고 헤더 셀렉트로도 변경 가능하다. 이 값을 그대로 `data-skin`으로 내려보낸다. 시안의 `data-skin`(red/blue/green/white/black)과 일치한다. 속성 인장에 표시할 한 글자(적/청/녹/백/흑)는 i18n 라벨에서 파생한다.

## SCSS 파일 구조

```
scss/
  amadeus.scss            진입점 (import 순서 재정비)
  utils/
    _tokens.scss          신설: 팔레트 토큰(시트 10 + dlg 2 + chat 고정 + die-face --d1~6)
    _typography.scss      폰트 교체(Cormorant Garamond / Gowun Batang / Noto Serif KR)
    _variables.scss       비색상 토큰만 잔존(치수/radius/간격)
    _colors.scss          _tokens로 흡수 후 제거(또는 die-face만 보존)
    _mixins.scss          유지
  global/
    _window.scss          AppV2 DOM(.application / .window-content div)에 맞춰 재작성
    _grid.scss / _flex.scss   유지·소폭 조정
  components/
    _sheet-actor.scss     신설: 캐릭터 시트(헤더/능력/인장/상태/탭/MEMO)
    _dialog.scss          신설: 이니셔티브 GM패널·플레이어 프롬프트
    _chatcard.scss        시안 양피지 + 굴림 카드로 재작성
    _forms.scss / _items.scss / _effects.scss / _resource.scss   토큰 참조로 정리
```

**원칙**:
- 컴포넌트 SCSS에 하드코딩 색 금지, 전부 `var(--*)` 참조. 팔레트는 `_tokens.scss` 한 곳에서만 관리.
- CSS 이미지 참조는 런타임 절대경로(`/systems/amadeus/icons/...`) 유지(상대경로면 Vite가 base64 인라인).

## 컴포넌트별 DOM/매핑

DOM을 시안 구조로 재작성하되 **기능 바인딩(`data-action`/`name`/`data-item-id`/`data-ability`/`data-tab`)은 100% 보존**한다. 이것이 재작성의 최대 리스크다.

### 캐릭터 액터 시트(`actor-character-sheet.html` 재작성)
- 헤더: 캐릭터 초상화 + 부모신 카드(`system.chardata.parentimg`/`parent`) + 캐릭터명(`name`) + 레벨/경험치/소지금(`system.level`/`exp`/`money`, placeholder `initMoney`) + 메타칩(직업 `job`/신군 `pantheon`/배경 `background`/관계 `relationship`/예언 `prophecy`)
- 좌측열 능력치 6종: 등급(`system.ability.*.rank`)·보정(`system.ability.*.mod`) 셀렉트, 라벨 클릭 `data-action="ablRoll"` + `data-ability` 유지
- 중앙: 속성 인장(`system.color`→한자) + 목표치(`system.dc`) + 생명력(`system.health.value` / `health.max` placeholder `initHealth`) + 활력 굴림(`data-action="vitalityRoll"`) + 상태 6종(`system.status.desperation/fury/coward/depravity/disgrace/wound`, 휠 색 점)
- 우측 MEMO(`system.memo`)
- 탭 재구성(라벨: 아이템·기프트·인물·기타) → 기존 `data-tab` 값 `item`/`gift`/`bond`/`features`에 매핑. 인물 탭 = 인연(bonds) + 협력자(supporters), 기타 탭 = biography 에디터 + 보물 + 추억. `data-group="primary"` 유지.

### 이니셔티브(`gm-panel.html`·`plot-prompt.html` 재작성)
- `.amadeus-dlg` 중립 골드 + `data-theme`. 주사위 면색 토큰 `--d1~6`.
- GM 패널: 시작 전(플롯 시작 버튼 + NPC 추가) / 진행 중(재요청·공개·초기화 + 참가자 로스터 + NPC 추가). 기존 액션/소켓 배선 불변.
- 플레이어 프롬프트: 1~6 주사위 선택 그리드(`.plot-die`/`.selected`), "낮을수록 먼저" 안내.

### 챗카드(`data-*`/`roll-*`/`plot-*` + `_chatcard.scss`)
- `.amadeus-chat` 양피지 고정. 아이템 정보 카드(분류/가격/위력/효과)와 굴림 카드(판정/회복/대미지) 분리(이미 템플릿 분리됨).
- 굴림 카드: 주사위 칩에 실제 눈(svg dot) 반투명 + 숫자 그림자. `successCheck` 헬퍼 결과(성공/실패/스페셜/펌블)로 면색·라벨.
- 플롯 카드: 완료 알림(가벼운 상태 카드) / 행동 순서(테두리·디바이더 결과 카드). 순번 옆 주사위 칩 = 선택 면색·숫자.

## JS 테마 토글 배선

- **설정**: `game.settings.register("amadeus", "theme", { scope: "client", config: false, default: "dark" })`.
- **토글 위치**: 시트 윈도우 헤더 컨트롤(`_getHeaderControls`)에 라이트/다크 전환 버튼. 시안의 데모용 외부 버튼 대신 Foundry 네이티브 위치.
- **적용**: 시트/다이얼로그 `_onRender`에서
  - `this.element.dataset.skin = actor.system.color`(시트만)
  - `this.element.dataset.theme = game.settings.get("amadeus","theme")`
- **전역 반영**: 토글 시 설정 저장 후 열린 모든 amadeus 앱의 `dataset.theme` 갱신(CSS 변수라 리렌더 없이 즉시 전환).
- **순수 유틸 분리**: `color→data-skin`, `color→속성 한자` 매핑을 작은 순수 함수로 분리(예: `module/sheets/theme.mjs` 또는 기존 helpers)해 Vitest 단위테스트 대상화.

## 시안 외 화면(NPC·아이템 7종)

- NPC 시트: 기존 DOM 유지 + 토큰 배경/입력 스타일 상속. `color` 필드가 있으면 `data-skin` 자동 혜택.
- 아이템 7종 시트: `_forms.scss` 토큰 정리로 일관된 입력/배경. 레이아웃 재설계는 후속 과제.

## 폰트

- Google Fonts CDN: Cormorant Garamond(숫자/라틴), Gowun Batang(제목), Noto Serif KR(본문). 기존도 CDN이라 패턴 일관.
- Font Awesome: Foundry v13 내장 사용(추가 CDN 불필요). 빌드/렌더 시 아이콘 표시 검증.
- 기존 RIDIBatang / GyeonggiBatang / Roboto 제거.

## 에러/엣지 케이스

- `system.color`가 빈 문자열(부모신 미설정)일 때 `data-skin` 기본값(red, 시안의 first-paint fallback과 일치) 처리.
- 라이트/다크 설정 미존재 시 default `dark`.
- 챗카드는 시트 element와 무관(ChatMessage 렌더)하므로 `data-theme` 미적용, `.amadeus-chat` 클래스로만 양피지 스코프.

## 테스트/검증

- **정적**: `npm run build` 통과, `npm run lint` 0 errors 유지, Vitest(매핑 유틸 단위테스트).
- **수동(Foundry)**: F12로 실제 AppV2 렌더 DOM 확인 후 셀렉터 확정(추측 금지). 5속성 × 라이트/다크 × 3영역 시각 점검. 플롯은 GM+플레이어 2클라.
- **회귀 체크리스트**(DOM 재작성 핵심): 능력/활력 굴림, 탭 전환, 아이템 생성/편집/삭제(`data-item-id`=`_id`), 부모신 드롭→색/능력 복사, 챗카드 출력, 플롯 멀티클라. 모든 `data-action`/`name` 바인딩 보존 확인.
- **배포**: `npm run build` → `dist/`만 업로드. 매니페스트(`system.json`) 미변경이므로 브라우저 새로고침으로 확인(서버 재시작 불필요).

## 참고

- 시안: `docs/design/아마데우스 액터 시트.dc.html`, `아마데우스 이니셔티브.dc.html`, `아마데우스 채팅 카드.dc.html`.
- 핸드오프: `docs/superpowers/handoff-2026-06-17-design-renewal.md`.
- 아키텍처/빌드/DataModel/시트 패턴: 루트 `CLAUDE.md`.
</content>
</invoke>
