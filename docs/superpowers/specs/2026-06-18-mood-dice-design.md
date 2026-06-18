# 무드 다이스 선택 — 설계 (2026-06-18)

## 개요

아마데우스의 판정(성공/실패가 나오는 굴림, 대미지·회복량 제외)에서 2개 이상의 주사위를 굴렸을 때,
플레이어가 주사위 중 **판정 다이스 1개**와 **무드 다이스 1개**를 직접 고르게 한다.

- **판정 다이스**: 최종 성공/실패(또는 펌블/스페셜)를 결정하는 단일 주사위. 의도적으로 실패를 고를 수도 있다.
- **무드 다이스**: 주사위 눈의 **색**을 게임의 색 카운트에 +1 한다. 색 수치 자체는 시스템이 저장하지 않고 GM이 수동 관리하므로, 이 기능의 역할은 **선택한 무드 색을 챗카드로 명확히 출력**하는 것까지다.

선택 후, 어떤 주사위를 판정/무드로 골랐는지 **새 챗카드**로 출력한다.

## 룰 정의 (확정 사항)

- 모든 주사위는 지금처럼 각자 성공/실패(+펌블/스페셜)를 표시한다(기존 굴림 카드 유지).
- 결과는 **단일** 성공/실패다(다중 성공 개념 없음). 판정 다이스 1개가 결과를 결정한다.
- 주사위가 3개 이상이면 판정 1 + 무드 1을 고른 뒤 **나머지는 버림(무시)**.
- **주사위 눈 → 색**: `1=黑(black) 2=赤(red) 3=靑(blue) 4=綠(green) 5=白(white) 6=黃(special)`.
  - 黃(6)은 정식 색이 아니라 **스페셜** 표식이다. 무드 다이스로 6이 선택되면 플레이어가 **흑·적·청·녹·백 중 원하는 색**을 골라 +1 한다.
  - 1은 무드 시 단순히 흑(black) +1. (1은 판정 시 펌블이지만 무드 색에는 영향 없음)
- **판정 다이스의 펌블(1)/스페셜(6)**: 결과 카드에 "펌블"/"스페셜"로 **표기만** 한다. 실제 효과(펌블표 굴림, 스페셜 효과 등)는 시스템 밖에서 수동 처리하므로 표기로 충분하다.
- **자동 결정 케이스**: 사용 가능한 주사위가 1개뿐이면(=1d6 굴림, 또는 D랭크 2d6에서 높은 쪽이 "사용 불가") 다이얼로그 없이 그 1개가 판정 다이스로 자동 확정되고 무드 다이스는 없다.
- 선택은 **2개 이상 판정에서 무조건 발생**한다. 다이얼로그는 **닫기 불가**(확정 필수).

## 아키텍처

전용 모듈 + 공통 프롬프트 함수. 순수 로직은 `resolution.mjs`에 모아 Vitest로 검증하고,
Foundry 의존부(다이얼로그·챗 출력)는 얇게 유지한다. 이니셔티브(`module/initiative/`) 패턴과 일관되게 `module/mood/`에 둔다.

```
굴림 진입점(actor.rollAmadeAbl / item.getItemRollCard)
  → 기존 굴림 카드 출력 (현상 유지)
  → resolveMoodDice({ actor, values, rank, modVal, dc, label })   [module/mood/mood.mjs]
       ├─ usableCount < 2 → 자동: autoJudgeIndex로 판정 결정, 무드 없음 → 결과 카드
       └─ usableCount ≥ 2 → MoodDialog 표시(닫기 불가) → 확정 {judgeIndex, moodIndex, specialColor}
                              → buildMoodResult → 결과 카드
```

## 컴포넌트

### 1. 순수 로직 — `module/dice/resolution.mjs` 확장

기존 `buildDiceset(values, rank)`(D랭크 높은 주사위 `disabled` 표시)를 재사용한다.

- `dieColor(value)` → 색 키 반환. `{1:"black",2:"red",3:"blue",4:"green",5:"white",6:"special"}`.
- `usableCount(diceset)` → `buildDiceset` 결과에서 `disabled === false`인 항목 수.
- `autoJudgeIndex(diceset)` → `disabled === false`인 유일한 항목의 인덱스(자동 케이스 전용).
- `buildMoodResult({ values, modVal, dc, judgeIndex, moodIndex, specialColor })`
  → `{ judge: { value, outcome }, mood: null | { value, color } }`
  - `outcome`은 기존 `resolveDie(value, modVal, dc)` 결과(`fumble`/`special`/`success`/`fail`).
  - `moodIndex == null` → `mood: null`(자동 케이스).
  - 무드 `value === 6` → `color = specialColor`, 그 외 → `color = dieColor(value)`.

> 입력 검증(`judgeIndex !== moodIndex`, 인덱스 유효, 6일 때 `specialColor` 필수)은 다이얼로그의 확정 버튼 활성화 조건이 보장하므로, `buildMoodResult`는 주어진 인덱스를 신뢰하고 결과 객체만 만든다.

### 2. 굴림 진입점 통합

`module/documents/actor.mjs`의 `rollAmadeAbl`, `module/documents/item.mjs`의 `getItemRollCard`:
기존 굴림 카드를 출력한 뒤 공통 함수 `resolveMoodDice({ actor, values: roll.dice[0].values, rank, modVal, dc, label })`를 호출한다.
두 곳에 중복돼 있던 굴림→카드 흐름의 뒷부분(무드 처리)이 이 함수로 모인다.

### 3. `module/mood/` (신규)

- `mood.mjs` — `resolveMoodDice(context)`:
  - `buildDiceset`로 diceset 계산 → `usableCount`.
  - `< 2`: `autoJudgeIndex`로 `judgeIndex` 결정, `moodIndex=null` → `buildMoodResult` → 결과 카드(`postCard`).
  - `≥ 2`: `MoodDialog`를 열어 `await` → 확정값으로 `buildMoodResult` → 결과 카드.
- `mood-dialog.mjs` — `ApplicationV2 + HandlebarsApplicationMixin` 다이얼로그.
  - 표시: 굴린 주사위 전부(눈 + 색칩 + 각 성공/실패).
  - 입력: 판정 다이스 라디오, 무드 다이스 라디오(서로 다른 주사위만). 무드로 6 선택 시 5색(흑적청녹백) 선택 UI 노출.
  - **닫기 불가**: window 컨트롤/ESC로 닫히지 않게 하고, **판정+무드(+6이면 색)가 모두 선택돼야 확정 버튼 활성화**.
  - 확정 시 `Promise`를 `{ judgeIndex, moodIndex, specialColor }`로 resolve.
  - 스타일: `amadeus-dlg` 클래스 + `_onRender`에서 `data-theme` 주입(디자인 토큰 일관). 헤더/드래그는 이니셔티브 다이얼로그에서 검증된 방식(`window-header` 유지)을 따른다.
  - `templates/dialog/mood-dialog.html`.

### 4. 결과 챗카드 — `templates/chatcard/mood-result.html`

- 헤더: 캐릭터명 + 판정 라벨.
- 판정 다이스: 색칩 + 눈 + 최종 결과(성공/실패/펌블/스페셜).
- 무드 다이스: 색칩 + 색 이름. 6이면 선택한 색 + "스페셜" 배지. 자동 케이스면 "무드 없음" 표기.
- `amadeus-chat` 양피지 카드(챗카드는 skin/theme 무관 고정). 기존 `_chatcard.scss` 토큰/믹스인(die-face 색) 재사용.

### 5. i18n — `lang/ko.json`

- 색 이름은 기존 `AMADEUS.color.*` 재사용.
- 신규 라벨(다이얼로그 제목/판정·무드 안내/확정 버튼/결과 카드 문구/펌블·스페셜·무드 없음)을 `AMADEUS.mood.*`로 추가.

## 데이터 흐름

1. PL이 능력치/기프트 굴림 → `Roll` 평가 → 기존 굴림 카드 출력.
2. `resolveMoodDice`가 `usableCount` 판단.
3. 자동(1개): 결과 카드 즉시 출력(판정=그 1개, 무드 없음).
4. 수동(2개+): 굴린 본인 클라에 다이얼로그 표시 → 확정 → 결과 카드 출력.
5. 결과 카드는 `ChatMessage.create`로 출력되어 GM·타 PL이 모두 본다.

## 멀티플레이어

다이얼로그는 굴림을 실행한 클라(굴린 본인)에서만 뜬다. 확정 결과는 `ChatMessage.create`로 출력되므로
타 클라는 결과 카드만 본다. 굴림→선택→출력이 한 클라 안에서 완결되는 **단방향** 흐름이라 **소켓 중계가 필요 없다**
(이니셔티브의 양방향 GM↔PL 프롬프트와 다른 점).

## 테스트

- **Vitest(순수)**: `dieColor`(1~6 매핑, 6=special), `usableCount`(C/D=1, B=2, A=3, S=4), `autoJudgeIndex`(1d6/ D랭크에서 사용 가능 인덱스), `buildMoodResult`(자동→mood null / 일반 무드 색 / 6→specialColor / outcome 펌블·스페셜·성공·실패).
- **Foundry 수동 검증**: 다이얼로그 표시·닫기 불가·확정 버튼 활성 조건·6 색 선택, 결과 카드 외형, 자동 케이스 카드, 멀티클라(타 PL이 결과만 보는지), 능력치/기프트 양쪽 진입점.

## 범위 밖 (YAGNI)

- 색 수치 풀의 시스템 저장/자동 적용(명시적으로 GM 수동 관리).
- 펌블표/스페셜 효과의 자동 처리(표기만).
- 챗카드 인라인 버튼 방식(다이얼로그로 확정).
- 확정 후 재선택/되돌리기(필요 시 재굴림).
