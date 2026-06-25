# 수식 롤 카드 테마 통일 — 설계 (2026-06-25)

## 개요

식량 1d6·장비/무기 대미지·기프트 수식처럼 **목표치 없는 단순 합산 굴림**이 현재 Foundry 코어 기본(밋밋한) 롤 카드로 출력된다. 이를 능력치/기프트 **판정** 카드(`amade-dicecard` 테마)와 외형상 통일한다.

판정 롤과 달리 이 굴림들은 **목표치·성공/실패 판정이 없으므로**, 테마(헤더·장식선·주사위 chip·폰트)는 공유하되 카드 내용은 **굴린 주사위 눈 + 합계**만 보여준다.

적용 범위는 시트의 수식 롤 3종에 그치지 않고, **사용자가 채팅창에 직접 입력한 `/r` 등 모든 코어 Roll 메시지**까지 포함한다.

## 결정 사항 (확정)

- **카드 내용**: 주사위 눈 + 합계만. 목표치·랭크·모드 칩, 개별 성공/실패 표기 없음.
- **적용 범위**: `isRoll === true`인 모든 챗 메시지(시트 `postRoll` 3종 + 활력 롤 + 채팅 직접 입력 `/r`).
- **주사위 표현**: `faces === 6`인 주사위는 판정 카드와 **동일한 값별 색 chip + pip SVG**를 재사용한다. 그 외 주사위(d20 등)는 pip 없는 **숫자 chip**.
- **제외 대상**: 기존 커스텀 카드(능력치/기프트 판정·plot·mood·data 정보 카드)는 모두 `postCard`로 만들어져 `isRoll === false`이므로 자동 제외된다. content에 `.amadeus-chat`가 있으면 추가로 건너뛴다(안전망).

## 아키텍처

코어가 만든 Roll 메시지의 DOM을 **`renderChatMessageHTML` 훅에서 후처리**해, `.message-content`를 우리 템플릿 렌더 결과로 교체한다. 시트의 수식 롤·활력 롤·채팅 직접 입력이 전부 코어 Roll 경로(`Roll#toMessage`)를 거치므로, 훅 하나로 일괄 적용된다.

```
[식량 1d6 클릭 / 데미지 / 기프트 수식 / 활력 / 채팅 "/r 1d6"]
  → postRoll(...) 또는 코어가 Roll#toMessage  → ChatMessage 생성 (isRoll === true)
  → Hooks: renderChatMessageHTML(message, html)
       ├─ message.isRoll === false           → 무시 (postCard 커스텀 카드 전부 여기)
       ├─ content에 .amadeus-chat 포함        → 무시 (idempotent 안전망)
       └─ 그 외(순수 Roll)                     → buildFormulaRollView(roll)
                                                → roll-formula.html 렌더
                                                → html의 .message-content 교체
```

코어가 저장한 원본 `message.content`는 그대로 두고, 매 렌더마다 **렌더된 DOM만** 교체하므로 재렌더에 대해 idempotent하다.

## 컴포넌트

### 1. 순수 로직 — `module/dice/resolution.mjs` 확장

Foundry 전역을 참조하지 않는 순수 함수로 둔다(테스트 용이). Roll 객체에서 추출한 원시 데이터를 받아 뷰모델을 만든다.

- `buildFormulaRollView({ flavor, formula, total, dice })` →
  ```
  {
    title: flavor || formula,      // 제목: 아이템/기프트 이름, 없으면 수식
    formula,                       // "1d6", "2d6+3" 등 원본 수식 라벨
    total,                         // 최종 합계
    groups: [                      // dice term별 그룹
      { faces, isD6, dice: [{ value }, ...] }
    ]
  }
  ```
  - `isD6 = (faces === 6)` — 템플릿이 pip SVG vs 숫자 chip 분기에 사용.
  - 보정값(`+3`)·복합식은 수식 라벨과 `total`에 반영되며, 주사위 그룹에는 나타나지 않는다.

### 2. 훅 핸들러 — `module/chat/chat.mjs`

`export function themeRollMessage(message, html)`:

1. 대상 판별: `message.isRoll` 그리고 렌더된 content에 `.amadeus-chat` 없음.
2. Roll 데이터 추출: `message.rolls`를 순회하며 각 `roll.dice`(DiceTerm)의 `faces`·`results`(값)를 모은다.
3. `buildFormulaRollView(...)`로 뷰모델 생성.
4. `roll-formula.html` 렌더 → `html.querySelector(".message-content")`를 교체.

> v13 훅 시그니처(`renderChatMessageHTML`의 인자 형태, `html`이 `HTMLElement`인지)는 **구현 시 context7/공식 문서로 교차검증**한다. v12까지의 `renderChatMessage`(jQuery)는 deprecated.

### 3. 템플릿 — `templates/chatcard/roll-formula.html` (신규)

`amade-dicecard` 외형을 공유하되 콘텐츠만 교체한다.

- `header.chat-title` — 제목(`title`) + title icon
- `.chat-ornament` — 장식선 (기존 그대로)
- `.chat-formula-label` — 수식 라벨(`formula`) [신규]
- `.chat-diceset` — `groups` 순회:
  - `isD6` → 기존 `.chat-die-chip--{value}` + pip SVG 재사용 (`chat-die-mod`/`chat-die-result` 없음)
  - else → 숫자 chip
- `.chat-total` — 합계 강조 [신규]

칩 정보(목표치/랭크/모드)·개별 성공판정 영역은 포함하지 않는다.

### 4. 스타일 — `scss/components/_chatcard.scss`

기존 `.chat-die-chip`·pip·색 토큰·Pretendard 폰트를 재사용한다. 신규는 `.chat-formula-label`, `.chat-total` 정도. 기존 `data-theme` 토큰을 상속하므로 라이트/다크 자동 대응.

### 5. 등록 — `module/amadeus.mjs`

`Hooks.on("renderChatMessageHTML", themeRollMessage)` 추가(이미 chat 관련 import 존재).

## 엣지 케이스

- **d6 외 주사위**(d20/d100 등): pip 없는 숫자 chip으로 표시.
- **보정값·복합식**(`1d6+3`, `2d6+1d4`): 수식 라벨 + 합계로 표현, 그룹은 주사위 term만.
- **복수 dice term**: `groups`에 순서대로 나열.
- **Dice So Nice** 등 3D 주사위 모듈: 훅은 애니메이션 이후 발화하므로 호환. content 교체는 DSN 트리거(roll 데이터 기반)와 무관.
- **재렌더/메시지 업데이트**: 교체 후 content에 `.amadeus-chat`가 생기지만, 훅은 매번 원본 `message.content`로 렌더된 html을 받으므로 원본 기준 재처리 → idempotent.

## 비범위 (Non-goals)

- 판정/plot/mood/data 카드 외형·로직 변경 (현상 유지)
- 단순 합산 롤에 성공/실패·목표치 판정 추가
- `postCard`·`postRoll`·`amadeRoll` 시그니처 변경 (훅만 추가, 기존 경로 불변)
- 데이터 모델(`item-data.mjs` 등) 변경

## 검증

- 수동: 식량 1d6, 장비 대미지, 기프트 수식, 활력 롤, 채팅 `/r 1d6`·`/r 2d6+3`·`/r 1d20` 각각 출력 확인.
- 회귀: 능력치/기프트 판정 카드, plot/mood 카드가 변하지 않는지 확인.
- 순수 함수: `buildFormulaRollView`는 노드 테스트로 검증 가능(전역 비참조).
