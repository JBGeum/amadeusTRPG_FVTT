# 롤테이블 테마 카드(시련표·휴식표·장면표) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시련표·휴식표·장면표 롤테이블 굴림을 코어 기본 카드 대신 `amadeus-chat` 테마 카드(제목=테이블 이름, 굴림값+결과 텍스트)로 출력하고, 이름으로 월드 롤테이블을 찾는 장면표 버튼을 추가한다.

**Architecture:** `#onRollTable`을 `data-rtid`(팩 ID) / `data-rtname`(월드 이름 우선 + 팩 fallback)으로 분기해 테이블을 찾고, `table.draw({displayChat:false})`로 결과만 받아 신규 `roll-table.html`을 `postCard`로 렌더한다. 결과 텍스트는 v13 `await result.getHTML()`로 얻는다.

**Tech Stack:** Foundry VTT v13 (RollTable/TableResult, ApplicationV2 ActorSheetV2), Handlebars, Vite 번들.

## Global Constraints

- 대상: **Foundry VTT v13+**. 결과 텍스트는 **`await result.getHTML()`**(enriched HTML; v11 `getChatText()` 대체). `table.draw({ displayChat: false })` → `{ roll, results }`.
- **제목 단순화**: 카드 제목 = `table.name`(예 `"시련표"`). 코어 flavor는 `displayChat:false`로 제거된다.
- **장면표 조회**: `game.tables.getName(name)`(월드 사이드바 우선) → 없으면 `amadeus.rolltable` 팩에서 `name` 매칭. 시련/휴식은 기존 `data-rtid`(팩 ID) 유지.
- 테이블을 못 찾으면 `ui.notifications.warn`으로 알리고 종료(크래시 없음).
- **DataModel·`template.json` 변경 없음.** 버튼은 `actor-character-sheet.html`에만 추가.
- 빌드 산출물 `dist/`는 자립형. 변경 후 **`npm run build`** 필요.
- 커밋 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: 롤테이블 테마 카드 + 장면표 버튼

신규 템플릿 + preload + 핸들러 분기 + 버튼을 한 번에 구현한다(하나라도 빠지면 기능 미완). Foundry/DOM 의존이라 자동 단위 테스트는 불가 → 빌드 통과 + Foundry 수동 검증.

**Files:**
- Create: `templates/chatcard/roll-table.html`
- Modify: `module/helpers/templates.mjs` (preload 목록)
- Modify: `module/sheets/actor-sheet.mjs` (`#onRollTable`)
- Modify: `templates/actor/actor-character-sheet.html` (장면표 버튼 추가)

**Interfaces:**
- Consumes: 기존 `postCard({ actor, template, data })` (`module/chat/chat.mjs`)
- Produces: `roll-table.html`가 받는 데이터 = `{ name: string, total: number|undefined, text: string(HTML) }`

- [ ] **Step 1: 신규 템플릿 생성**

Create `templates/chatcard/roll-table.html` (`data-description.html` 구조 재사용 + 굴림값 chip):

```html
<div class="amadeus-chat chatcard roll-table-chatcard">
  <div class="chat-inner">
    <header class="chat-title">
      <i class="fa-solid fa-scroll chat-title-icon"></i>
      <span class="chat-title-text">{{name}}</span>
    </header>
    <div class="chat-ornament" aria-hidden="true">
      <span class="chat-ornament-line chat-ornament-line--l"></span>
      <i class="fa-solid fa-diamond chat-ornament-dot"></i>
      <i class="fa-solid fa-dice chat-ornament-icon"></i>
      <i class="fa-solid fa-diamond chat-ornament-dot"></i>
      <span class="chat-ornament-line chat-ornament-line--r"></span>
    </div>
    {{#if total}}
    <div class="chat-chips">
      <div class="chat-chip">
        <span class="chat-chip-lbl">굴림</span>
        <span class="chat-chip-val lnum">{{total}}</span>
      </div>
    </div>
    {{/if}}
    <div class="chat-body">
      <div class="chat-description">{{{text}}}</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: preload 등록**

`module/helpers/templates.mjs`의 chatcard preload 블록에서 `roll-formula.html` 줄 다음에 추가한다. 변경 전(해당 줄):

```javascript
    "systems/amadeus/templates/chatcard/roll-formula.html",
```

변경 후:

```javascript
    "systems/amadeus/templates/chatcard/roll-formula.html",
    "systems/amadeus/templates/chatcard/roll-table.html",
```

- [ ] **Step 3: `#onRollTable` 핸들러 교체**

`module/sheets/actor-sheet.mjs`의 현재 `#onRollTable`(아래 형태)을 교체한다. 변경 전:

```javascript
  static async #onRollTable(event, target) {
    const rtid = target.dataset.rtid;
    if (!rtid) return;
    const pack = game.packs.get("amadeus.rolltable");
    const tables = await pack.getDocuments();
    const table = tables.find((t) => t.id === rtid);
    table?.draw();
  }
```

변경 후:

```javascript
  static async #onRollTable(event, target) {
    const { rtid, rtname } = target.dataset;
    let table;
    if (rtid) {
      // 시련표/휴식표: 컴펜디엄 팩에서 고정 ID로 조회
      const tables = await game.packs.get("amadeus.rolltable").getDocuments();
      table = tables.find((t) => t.id === rtid);
    } else if (rtname) {
      // 장면표: 월드 사이드바 우선, 없으면 팩에서 이름으로 조회
      table = game.tables.getName(rtname);
      if (!table) {
        const tables = await game.packs.get("amadeus.rolltable").getDocuments();
        table = tables.find((t) => t.name === rtname);
      }
    }
    if (!table) {
      ui.notifications.warn(`롤테이블을 찾을 수 없습니다: ${rtname ?? rtid}`);
      return;
    }
    // 코어 출력은 끄고(displayChat:false) 결과만 받아 테마 카드로 렌더한다.
    const { roll, results } = await table.draw({ displayChat: false });
    const parts = await Promise.all(results.map((r) => r.getHTML()));
    await postCard({
      actor: null,
      template: "systems/amadeus/templates/chatcard/roll-table.html",
      data: { name: table.name, total: roll?.total, text: parts.join("") },
    });
  }
```

(`postCard`는 이미 `actor-sheet.mjs` 상단에서 import되어 있다 — 추가 import 불필요.)

- [ ] **Step 4: 장면표 버튼 추가**

`templates/actor/actor-character-sheet.html`의 시련표/휴식표 버튼(아래) 바로 다음 줄에 장면표 버튼을 추가한다. 변경 전:

```html
          <a class="table-btn" data-action="rollTable" data-rtid="EroSbTqlikS55Zp5"><i class="fa-solid fa-skull"></i>시련표</a>
          <a class="table-btn" data-action="rollTable" data-rtid="IkNCphhCNk3Bx0yj"><i class="fa-solid fa-bed"></i>휴식표</a>
```

변경 후:

```html
          <a class="table-btn" data-action="rollTable" data-rtid="EroSbTqlikS55Zp5"><i class="fa-solid fa-skull"></i>시련표</a>
          <a class="table-btn" data-action="rollTable" data-rtid="IkNCphhCNk3Bx0yj"><i class="fa-solid fa-bed"></i>휴식표</a>
          <a class="table-btn" data-action="rollTable" data-rtname="장면표"><i class="fa-solid fa-masks-theater"></i>장면표</a>
```

- [ ] **Step 5: 빌드 통과 확인**

Run: `npm run build`
Expected: `✓ built`, 에러 없음.

Run: `ls dist/templates/chatcard/roll-table.html`
Expected: 파일 존재.

Run: `grep -c "roll-table.html" dist/amadeus.mjs`
Expected: `1` 이상 (preload 등록).

- [ ] **Step 6: 커밋**

```bash
git add templates/chatcard/roll-table.html module/helpers/templates.mjs module/sheets/actor-sheet.mjs templates/actor/actor-character-sheet.html
git commit -m "feat: render rolltable draws as themed cards and add 장면표 button

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Foundry 수동 검증** (사용자가 `dist/` 배포 후 수행)

빌드된 `dist/`를 서버의 `systems/amadeus`로 배포하고 월드 새로고침 후 캐릭터 시트에서 확인한다.

- [ ] 시련표 버튼 클릭 → 테마 카드 출력, 제목이 **"시련표"**(코어의 "표 …에서 결과를 뽑습니다" 아님), 굴림값 + 결과 텍스트 표시
- [ ] 휴식표 버튼 클릭 → 동일하게 테마 카드
- [ ] 월드 사이드바에 "장면표" 롤테이블을 만든 뒤 장면표 버튼 클릭 → 그 결과가 테마 카드로 출력
- [ ] 장면표 롤테이블이 없을 때 버튼 클릭 → "롤테이블을 찾을 수 없습니다: 장면표" 경고, 크래시 없음
- [ ] 결과 텍스트가 enriched HTML로 정상 표시(굵게/링크 등 포함 시)

> 결과 텍스트가 비거나 깨지면 v13에서 `result.getHTML()` 대신 `result.description`(원본 HTML)을 사용해야 할 수 있으니, 브라우저 콘솔에서 `game.tables.getName("장면표").results.contents[0]`를 확인해 필드를 점검한다.

---

## 참고: 검증 명령 요약

- 빌드: `npm run build`
- 전체 테스트(회귀): `npm test`
- 린트: `npm run lint`
