# Handoff — Amadeus v13 마이그레이션 (2026-06-16)

다음 세션이 이어받기 위한 현황 스냅샷. 아키텍처/빌드 상세는 루트 `CLAUDE.md` 참조.

## 한 줄 요약

구 Foundry VTT v10~v11 시스템(Amadeus TRPG)을 **v13 호환으로 마이그레이션 완료** — 빌드 시스템 현대화 + deprecated API 정리 + DataModel 전환 + 시트 ApplicationV2 전환. v13에서 기능 정상 동작 확인됨.

## 브랜치 상태

- `master` == `develop` == `07d577f` (동일 커밋, 둘 다 origin push 완료)
- 작업은 `develop`에서 이어간다(유지됨). 기능별 새 브랜치도 가능.
- 작업 트리 clean.

## 완료된 작업 (전부 master 통합·push)

| 단계 | 내용 | 핵심 커밋 |
|------|------|----------|
| 최신본 동기화 | `WebstormProjects/amadeus`(실사용본)와 repo 동기화, packs를 NeDB→LevelDB | `0751705` |
| 빌드 시스템 | gulp 제거 → **Vite 8** 자립 패키지(dist에 모든 자산 복사), ESLint/Prettier, Foundry CLI | `76ad0f1` |
| Phase 1 | deprecated 전역/API → v13 네임스페이스(`foundry.utils.*`/`foundry.applications.*`/`foundry.documents.collections.*`), `ChatMessage type:3`→`style:EMOTE`, `roll.evaluate({async})` 제거 | `9c481e4` |
| Phase 2 | `template.json` 스키마 → `module/data/`의 **TypeDataModel**(character/npc/item 7종), `monster`→`npc`, 생명력 NaN 수정 | `cf261d2`, `48c73cf` |
| Phase 3a | **Item 시트 → DocumentSheetV2**(타입별 PARTS), `{{#select}}`→`{{selectOptions}}`, `{{editor}}`→`<prose-mirror>` | `5b9fd0e` |
| Phase 3b | **Actor 시트 → ActorSheetV2**(actions 13개 + 부모신 `_onDropItem` + 수동 탭), parts/npc 템플릿 변환, `_onDamageRoll` null guard | `b827121` |
| 마무리 | `system.json` compatibility → v13 | `07d577f` |

설계/계획 문서: `docs/superpowers/specs/2026-06-16-v13-migration-design.md`, `docs/superpowers/plans/2026-06-16-v13-migration-phase{1,2,3a,3b}-*.md`.

## 빌드·검증·배포 워크플로우 (중요)

- **빌드**: `npm run build` → `dist/`에 자립형 시스템(`amadeus.mjs`/`amadeus.css` + `system.json`/`template.json`/`lang`/`templates`/`icons`/`packs` 복사). `dist/`는 git 추적 제외.
- **배포**: Foundry는 **별도 서버**에서 동작. 빌드된 **`dist/`만** 서버의 `systems/amadeus`로 업로드. `system.json`/`template.json` 변경 시 **Foundry 재시작 필수**(안 하면 캐시로 오류).
- **검증**: 단위 테스트 없음. `npm run build`(✓ built) + `npm run lint`(신규 에러 없음) 정적 검증 + v13 수동 시나리오. lint의 기존 에러 6개(아래)는 알려진 것.
- **CSS 이미지**: 런타임 절대경로 `/systems/amadeus/icons/...` 사용(상대경로 쓰면 Vite가 base64 인라인).

## 남은 작업 (우선순위 순)

1. **SCSS 디자인 리뉴얼** (사용자: 시안 확정 후 계획 예정)
   - AppV2 전환으로 시트 DOM이 바뀌어 기존 SCSS 셀렉터가 안 맞음(`_window.scss`의 `.window-app`, `amadeus.scss`의 `.sheet.actor section.window-content` 등). 색/배경 미적용 상태. **기능은 정상, 외형만 영향.** 시안 확정 후 AppV2 실제 DOM에 맞춰 셀렉터 갱신.
2. **기능 추가** (사용자: 다음 작업으로 예정 — 내용 미정. 브레인스토밍부터 시작할 것.)
3. **레거시 템플릿 정리**: `templates/item/item-{feature,spell,sheet}.html`은 현재 Item 타입에 없는 boilerplate 잔재(PARTS에 없어 미사용). 정리 가능.
4. **lint 기존 에러 정리**: `helpers/templates.mjs`의 `getBond`/`getSupporter`(`index` 미정의 실버그, no-undef 4), `item.mjs` 빈 블록(no-empty 2). DataModel 전환 후 일부는 불필요할 수 있으니 검토.

## 알려진 이슈·주의점

- `system.json`의 `compatibility.verified`가 `"13"`(구체 빌드 번호 아님). 실제 검증한 v13 빌드 번호로 교체하면 정확.
- **NPC 시트는 최소 구성**(`cr`/`xp`만). `NpcData`가 `cr`만 정의 → 기존 boilerplate(health/power) 제거됨. NPC에 생명력/아이템 등 필요하면 `NpcData`와 시트 확장 필요.
- **world 데이터 비호환**: Phase 2에서 스키마 정리(보존 안 함 합의). 구 world는 깨질 수 있음 — 새 world로 테스트.
- `bonds`/`supporters`는 기존 객체 구조(bond1~5) 유지(배열 정리 안 함).
- 줄바꿈: 저장소가 CRLF. git이 LF→CRLF 경고는 정상.

## 다음 세션 시작 가이드

1. `CLAUDE.md` 읽기(아키텍처/빌드/DataModel/시트 패턴 최신 반영됨).
2. 기능 추가 작업이면 **brainstorming 스킬**부터.
3. AppV2 시트 패턴 참고: Item=`module/sheets/item-sheet.mjs`(DocumentSheetV2), Actor=`module/sheets/actor-sheet.mjs`(ActorSheetV2, actions/탭/DragDrop 예시).
4. DataModel 추가/수정: `module/data/`(헬퍼 `_fields.mjs`).
