# 롤테이블(시련표·휴식표·장면표) 테마 카드 출력 — 설계 (2026-06-26)

## 개요

캐릭터 시트의 시련표·휴식표 버튼은 현재 코어 기본 롤테이블 카드("표 시련표에서 결과를 뽑습니다")로 결과를 출력한다. 이를 시스템 테마(`amadeus-chat`)와 통일된 카드로 바꾸고, 제목을 테이블 이름(`"시련표"`)으로 단순화한다. 더불어 **장면표** 버튼을 추가해, 월드 사이드바의 `"장면표"` 롤테이블을 이름으로 찾아 같은 방식으로 출력한다.

## 현황 / 원인

- `module/sheets/actor-sheet.mjs`의 `#onRollTable`(403-409행)이 `table.draw()`(기본 `displayChat:true`)를 호출해 코어 기본 챗 메시지를 출력한다. 제목/형식이 코어 표준("표 …에서 결과를 뽑습니다")이라 테마와 이질적이다.
- 버튼: `templates/actor/actor-character-sheet.html:178-179`. `data-rtid`(고정 ID)로 `amadeus.rolltable` 팩에서 테이블을 찾는다.

## 결정 사항 (확정)

- **출력 방식**: `table.draw({ displayChat: false })`로 결과만 받아 `postCard`로 테마 카드를 렌더한다(코어 출력 끔).
- **제목 단순화**: 카드 제목 = `table.name`(예 `"시련표"`). 코어 flavor는 `displayChat:false`로 제거된다.
- **카드 내용**: 제목 + **굴림값(`roll.total`)** + **결과 텍스트**. 테마는 `data-description.html` 구조 재사용.
- **장면표 조회**: ID를 모르므로 **이름**으로 찾는다 — `game.tables.getName("장면표")`(월드 사이드바 우선) ?? 팩에서 `name` 매칭(fallback). 시련/휴식은 기존대로 `rtid`(팩 ID).
- **데이터 모델·`template.json` 변경 없음.**

## 아키텍처 / 데이터 흐름

```
[시련표/휴식표/장면표 버튼 클릭]
  → #onRollTable(target)
      ├─ data-rtid  → 팩(amadeus.rolltable)에서 id 매칭          (시련/휴식)
      └─ data-rtname → game.tables.getName(name)                 (장면표; 월드 우선)
                       ?? 팩에서 name 매칭                         (fallback)
      → 못 찾으면 ui.notifications.warn 후 종료
  → table.draw({ displayChat: false })  → { roll, results }
  → 결과 텍스트 = results.map(텍스트 추출).join("")
  → postCard("roll-table.html", { name: table.name, total: roll?.total, text })
```

## 컴포넌트

### 1. 버튼 — `templates/actor/actor-character-sheet.html`
기존 시련표/휴식표 옆에 장면표 추가(이름 기반):
```html
<a class="table-btn" data-action="rollTable" data-rtname="장면표"><i class="fa-solid fa-masks-theater"></i>장면표</a>
```

### 2. 핸들러 — `#onRollTable` (actor-sheet.mjs)
- `target.dataset`의 `rtid` 또는 `rtname`으로 분기해 `table`을 찾는다(위 데이터 흐름).
- `table`이 없으면 `ui.notifications.warn`으로 알리고 종료.
- `await table.draw({ displayChat: false })` → `{ roll, results }`.
- 결과 텍스트 추출: `results.map(r => …).join("")`. **TableResult의 결과 텍스트 필드(`getChatText()` / `description` / `text`)는 v13 실제 객체로 구현 시 검증**(롤테이블 데이터를 extract하지 못해 표준 가정).
- `postCard`로 `roll-table.html` 렌더(`actor`는 speaker 불필요 시 생략 가능).

### 3. 신규 템플릿 — `templates/chatcard/roll-table.html`
`data-description.html` 구조 재사용 + 굴림값:
- `header.chat-title`: 아이콘 + `{{name}}`(table.name)
- `.chat-ornament`: 기존 장식
- 굴림값: `{{#if total}}` … `{{total}}` …`{{/if}}`(roll 없으면 생략)
- `.chat-body > .chat-description`: `{{{text}}}`(결과 텍스트, HTML 허용)

### 4. 등록·스타일
- `module/helpers/templates.mjs` preload에 `roll-table.html` 추가.
- SCSS: 기존 `.amadeus-chat`/`.chat-chip`/`.chat-body`/`.chat-description` 재사용. 굴림값 표시 보강은 필요 시 최소.

## 엣지 케이스

- `rtid`·`rtname` 둘 다 없으면 무시.
- 장면표가 월드·팩 어디에도 없으면 경고만(크래시 없음).
- `roll`이 없을 수 있으니 `roll?.total` 가드 — 없으면 굴림값 영역 생략.
- 결과가 여러 개면 텍스트 join(시련/휴식/장면은 보통 단일).

## 비범위 (Non-goals)

- 능력치/기프트/수식 등 다른 카드 변경
- 롤테이블 자체 데이터 편집, 추가 테이블
- `data-rtid` 방식의 시련/휴식을 이름 기반으로 전환(고정 ID가 더 안정적이라 유지)

## 검증

- **수동**: 시련표·휴식표·장면표 버튼 각각 클릭 →
  - 테마 카드로 출력, 제목이 테이블 이름(예 "시련표")으로 단순화
  - 굴림값 + 결과 텍스트 표시
  - 장면표가 월드 사이드바에서 이름으로 조회됨
  - (테이블 없을 때) 경고 노출, 크래시 없음
- 결과 텍스트 필드는 구현 중 v13 콘솔로 확인.
