# Handoff — Amadeus 디자인 리뉴얼 구현 완료 (2026-06-18)

다음 세션이 이어받기 위한 현황 스냅샷. **다음 작업 = Foundry 수동 검증(F12 DOM 확인 + 시각/기능 회귀).** 아키텍처/빌드 상세는 루트 `CLAUDE.md` 참조.

## 한 줄 요약

시안(`docs/design/*.dc.html` 3종) 기반 디자인 리뉴얼을 **8개 Task로 전부 구현 완료**하고 `develop`에 커밋, **`origin/develop`에 push 완료**(HEAD `2db69b4`). 정적 검증(build/lint/test) 통과. 코드/로직은 검증됐으나 **Foundry 런타임 수동 검증은 아직 미수행** → 다음 작업은 F12로 실제 AppV2 DOM 확인 + 5속성×라/다 시각 점검 + 기능 회귀(특히 멀티클라 플롯, 다이얼로그 close/drag).

## 브랜치 상태 (중요)

- 현재 작업 브랜치: **`develop`**, 작업 트리 clean.
- **`develop` = `origin/develop`** (이번 세션 마지막에 push 완료, 동기화됨).
- `develop`은 여전히 **`master` 미반영**(master는 구버전). master 병합/PR은 사용자 요청 시에만.
- 정적 검증: `npm run build` ✓, `npm run lint` **0 new**(기존 baseline 9건: `docs/design/support.js`는 이제 gitignore, `module/documents/actor.mjs` 미사용 인자 2건), `npm test` **22 passed**(Vitest).

## 이번 세션 완료 작업 (전부 develop, push됨)

spec `docs/superpowers/specs/2026-06-17-design-renewal-design.md`, plan `docs/superpowers/plans/2026-06-17-design-renewal.md`. subagent-driven으로 8 Task 실행, 각 Task마다 스펙 준수 + 코드 품질 2단계 리뷰.

1. **토큰 레이어 + 폰트 + 진입점**(`83124ee`) — `scss/utils/_tokens.scss` 신설: 런타임 CSS 변수 팔레트. 시트 `[data-skin]×[data-theme]` 10팔레트 + 다이얼로그 `.amadeus-dlg` 2 + 챗카드 `.amadeus-chat` 양피지 고정 + die-face(`--d1~6`) + 상태휠(`--w*`). 폰트 교체(Cormorant Garamond/Gowun Batang/Noto Serif KR). `amadeus.scss` 진입점 재정비.
2. **window AppV2**(`a09a1b3`) — `_window.scss`를 `.amadeus.sheet`/`.window-content`(AppV2 DOM) + 토큰 기반으로 재작성.
3. **테마 설정 + 토글 배선**(`58ba8db`) — `game.settings.register("amadeus","theme",{scope:"client"})`(`amadeus.mjs`). `actor-sheet.mjs` `_onRender`가 `dataset.skin = system.color`, `dataset.theme` 주입. 헤더 토글은 v13 AppV2 `DEFAULT_OPTIONS.window.controls` + `toggleTheme` 액션(검증: `_getHeaderControls`는 AppV2에 없음, `window.controls`가 정답). 토글 시 열린 amadeus 앱 `dataset.theme` 일괄 갱신, **actor 시트만 re-render**(아이콘 갱신; PlotPrompt 등은 제외 — 진행 중 상태 보존). `foundry.applications?.instances?.values() ?? []` 가드.
4. **캐릭터 시트**(`a5593d8`) — `actor-character-sheet.html` 시안 구조로 DOM 재작성(헤더/능력열/속성인장/상태/MEMO/탭) + `_sheet-actor.scss`. **모든 기능 바인딩 보존**(data-action/name/data-ability/data-tab/partial include). 탭 라벨만 시안 문구, `data-tab` 값(item/gift/bond/features)은 유지.
5. **이니셔티브 다이얼로그**(`52e3075`) — `gm-panel.html`/`plot-prompt.html` 시안 재작성 + `_dialog.scss` + 두 mjs에 `amadeus-dlg` 클래스 + `_onRender` data-theme. **블로커 수정됨**: 초기에 `.window-header{display:none}`로 close/drag 손실 → window-header 유지·스타일링 + 헤더 아이콘은 `window.icon`으로 이전.
6. **챗카드**(`311b579`) — `data-*`/`roll-*`/`plot-*` 7종 양피지 재작성 + `_chatcard.scss`. `chat.mjs` 컨텍스트 변수 전수 보존. die-face 색 mixin(`_mixins.scss` `die-face-colors`). 챗카드는 theme/skin 무관 고정.
7. **NPC/아이템 토큰화**(`1f1b3d9`) — `_forms/_items/_effects/_resource`의 하드코딩색·`$color-*` → 토큰. **대비 버그 수정됨**: `$color-bg`(옛 잉크색)를 `--bg`(배경)로 잘못 매핑한 텍스트/테두리 6곳 → `--text`/`--line`/`--gold`.
8. **정리 + 검증**(`2db69b4`) — legacy `_colors.scss` 삭제 + import/폰트 별칭 제거. dangling 참조 0 확인. build/lint/test 통과.

## 다음 작업: Foundry 수동 검증 (서브에이전트가 할 수 없던 부분)

> 정적 검증은 끝났으나 **Foundry 런타임 동작/외형은 미확인**. 아래를 직접 점검하고 어긋나면 SCSS/템플릿 미세조정.

### 배포 (다른 PC 포함)
```
git pull                       # origin/develop
npm install && npm run build   # dist/ 생성
# dist/ 를 Foundry 서버 systems/amadeus 로 배포
```
`system.json`(매니페스트) 미변경 → **브라우저 새로고침**으로 충분(서버 재시작 불필요).

### 검증 체크리스트
- **F12로 실제 AppV2 렌더 DOM 확인**(추측 금지) 후 어긋나는 셀렉터 미세조정. 토큰/구조는 v13 표준 가정으로 작성했으므로 실제와 다르면 보정.
- **시각**: 캐릭터 시트 5속성(적/청/녹/백/흑) × 라이트/다크 = 10팔레트 전환, 헤더 해/달 토글이 열린 시트 전체에 즉시 반영.
- **기능 회귀**: 능력/활력 굴림, 탭 4개 전환, 아이템 생성·편집·삭제, 부모신 드롭→색/능력 복사 + 인장/팔레트 갱신, 챗카드 각 종류 출력.
- **이니셔티브(GM+플레이어 2클라)**: 플롯 시작→프롬프트→선택/제출→집계→공개→행동순서 카드. **다이얼로그 닫기/드래그 동작 확인**(블로커였던 부분).
- **NPC/아이템 시트**: 깨지지 않고 토큰 팔레트 적용되는지(완성도 아닌 정돈 수준).

## 알려진 이슈 · follow-up(선택, 비차단)

리뷰에서 보류한 minor 항목(다음 디자인 패스 때 함께 처리 가능):
- 캐릭터 시트 **탭 콘텐츠 partial 내부**(`actor-item/gift/bond/features.html`)는 시안 미반영 — 메인 시트 레이아웃만 시안화, 탭 안은 기존 DOM + 토큰 상속. 시안 충실도를 더 높이려면 partial도 재작성 필요(별도 작업).
- 부모신 이미지 **빈 상태 아이콘(moon) fallback** 미구현(현재 빈 img는 CSS로 숨김). `{{#unless system.chardata.parentimg}}`로 추가 가능.
- `_sheet-actor.scss` `col-ability`/`col-memo` 고정폭(170/182px) 의도 주석 없음.
- 캐릭터 시트 portrait-label("캐릭터"/"부모신") 하드코딩 한국어(localize 미사용) — 시스템 한국어 전용이라 현재 무해.
- 이니셔티브 dual-class(legacy `plot-*` + 신규 `dlg-*`) 공존 — JS는 legacy 클래스로 query. 나중에 `dlg-*`로 통일 시 mjs querySelector도 갱신 필요(`// TODO` 대상).
- NPC 데이터모델에는 `color` 필드 없음 → NPC 시트는 `data-skin` 없이 `.amadeus.sheet` fallback(적·dark)만 받음. 속성별 팔레트를 원하면 NpcData에 color 추가 필요.
- 기존 lint baseline 2건: `actor.mjs` 미사용 `data`/`options` 인자(범위 밖).

## 다음 세션 시작 가이드

1. `CLAUDE.md` + 이 핸드오프 읽기.
2. Foundry에 `dist/` 배포 후 위 체크리스트로 수동 검증.
3. 어긋나는 외형은 **F12로 실제 DOM 확인 후** SCSS 셀렉터/값 보정(추측 금지). 토큰은 `_tokens.scss` 한 곳에서 관리.
4. 변경 후 `npm run build` → `dist/` 재배포 → 브라우저 새로고침. 멀티클라 기능은 GM+플레이어 2클라.
</content>
