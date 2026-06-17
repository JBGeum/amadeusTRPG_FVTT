# 설계 — 비밀 입찰 이니셔티브 (2026-06-17)

각 PL가 비밀리에 주사위 숫자(1~6, 굴림 아님)를 골라 GM에게 제출하고, GM이 모두 모은 뒤 공개하면 그 숫자대로 이니셔티브(행동 순서)가 배정되는 기능. Amadeus 시스템(Foundry VTT v13)에 신규 추가한다. 아키텍처/빌드는 루트 `CLAUDE.md` 참조.

## 목표와 범위

- **목표**: "비밀 입찰 → 동시 공개 → 순서 배정" 메커니즘을 독립 도구로 구현.
- **범위 밖**: Foundry 기본 전투 트래커(Combat/Combatant) 통합, 토큰/씬 인카운터 의존 — 사용하지 않는다. SCSS 디자인 리뉴얼과 별개(스타일은 셀렉터만 제공).
- **참가자**: 기본은 PC(각 플레이어가 자신의 character로 입찰). GM은 패널에서 NPC를 추가하고 그 주사위를 직접 입력할 수 있다.

## 핵심 규칙 (합의됨)

- 입찰값은 **1~6 정수 중 하나를 선택**(주사위를 굴리지 않음).
- 순서 방향: **낮은 수가 먼저**(1=최속, 6=최후).
- 동률: **같은 순번(동시 행동)으로 묶는다.** 시스템은 동률 내부를 정렬하지 않으며, 동률자끼리는 시스템 외적으로(구두) 정리한다.
- 비밀성: **UI 수준**(소켓으로 값이 전송되지만 공개 전까지 어떤 UI에도 표시하지 않음). 협력 테이블 가정.
- 세션 상태: **GM 클라이언트 메모리에 임시 보관**(영구 저장 안 함). GM 새로고침 시 진행 중 세션 소실 → 재시작.

## 아키텍처

### 모듈 구조 (신규 `module/initiative/`)

| 파일 | 책임 | 의존 | 테스트 |
|------|------|------|--------|
| `order.mjs` | **순수**: `computeOrder(entries)` — 입찰값 오름차순 정렬 + 동률 그룹핑 | 없음 | Vitest |
| `session.mjs` | GM 메모리 세션 상태 + 동작(시작/제출수집/NPC입력/공개/초기화) | Foundry(actors/users) | 수동 |
| `socket.mjs` | `system.amadeus` 소켓 채널 등록 + 메시지 라우팅 | game.socket | 수동 |
| `gm-panel.mjs` | AppV2 Application: GM 관리 패널 | session, socket | 수동 |
| `bid-prompt.mjs` | AppV2 Application: 플레이어 입찰 UI(1~6 선택·제출) | socket | 수동 |

**경계 원칙**: `order.mjs`는 Foundry 전역(`game`/`ChatMessage`/`Roll`)을 참조하지 않는다 → Vitest에서 import 가능. 소켓/부수효과는 `socket.mjs`/`session.mjs`/앱에만 둔다.

### 템플릿 (신규)
- `templates/initiative/gm-panel.html` — GM 패널
- `templates/initiative/bid-prompt.html` — 플레이어 입찰 프롬프트
- `templates/chatcard/initiative-plot-done.html` — "〈PL명〉 플롯 완료" 제출 알림 카드(값 비표시)
- `templates/chatcard/initiative-result.html` — 공개 결과(순서·값·동률 그룹) 카드

### i18n
- `lang/ko.json`에 `AMADEUS.initiative.*` 키 추가(패널/프롬프트/카드 라벨).

### 진입점 / 와이어링 (`amadeus.mjs`)
- `ready` 훅에서 `system.amadeus` 소켓 리스너 등록.
- GM 전용 **씬 컨트롤 버튼**(좌측 툴바)으로 GM 패널을 연다.

## 소켓 프로토콜 (`system.amadeus` 채널, 타입 태그 메시지)

> core `game.socket.emit`은 **발신자를 제외한 전체 클라이언트**에 전달된다. 따라서 GM 자신의 동작(NPC 입력 등)은 로컬 메모리를 직접 갱신하고, 플레이어 제출만 소켓으로 받는다.

- `bid-start` (GM→전체): `{ sessionId }`. 참가 character를 소유한 플레이어 클라이언트가 입찰 프롬프트를 자동으로 연다.
- `bid-submit` (플레이어→GM): `{ sessionId, actorId, userId, value }`. **GM만 처리** — 세션에 값 기록, 패널 갱신. (다른 클라이언트는 무시 → UI 비밀.)
- `bid-reveal` (GM→전체): `{ sessionId }`. 플레이어 프롬프트 닫힘. 영구 기록은 결과 챗 카드.
- `bid-cancel` (GM→전체): `{ sessionId }`. 세션 취소/프롬프트 닫힘.

## 세션 상태 (GM 메모리, 임시)

```
session = {
  id: string,
  active: boolean,
  revealed: boolean,
  participants: Map<actorId, {
    actorId, name, isNPC: boolean, userId?: string,
    value: 1..6 | null, submitted: boolean
  }>
}
```

- GM 패널만 세션을 보유한다. 플레이어는 세션 상태를 들지 않고 프롬프트만 띄운다.
- GM 패널은 **제출된 실제 값을 표시**(GM은 권위자라 숫자 확인 가능).

## 순서 계산 (순수, 테스트 대상)

```
computeOrder(entries) -> [{ rank: number, value: 1..6, members: [{actorId, name}] }, ...]
```
- 입력: `[{actorId, name, value}]` (value 1~6). value가 null/미제출인 항목은 제외.
- 처리: value 오름차순 정렬, **동값은 같은 rank로 그룹핑**(동시 행동). rank는 1부터 그룹 단위로 증가.
- 동률 내부 순서는 정하지 않는다(members 배열은 입력 순서 유지).

## 흐름

1. GM이 씬 컨트롤 버튼으로 패널을 연다 → 현재 PC(플레이어 소유 character)가 기본 참가자로 표시. GM은 NPC 추가/제거 가능.
2. GM **"입찰 시작"** → 세션 active → `bid-start` 브로드캐스트 → 각 플레이어에게 입찰 프롬프트(1~6 선택 + 제출).
3. 플레이어 제출 →
   - `bid-submit`을 GM에 전송 → GM 패널에 해당 참가자의 **실제 값** 표시(GM만).
   - 공개 **"〈PL명〉 플롯 완료"** 챗 카드 게시(값 비표시) → 테이블 전원이 제출 현황 확인.
   - 공개 전 **재제출 가능**: GM 패널 값만 조용히 갱신, 중복 "플롯 완료" 카드는 게시하지 않는다(최초 제출 시 1회).
4. GM은 패널에서 **NPC 주사위 직접 입력**, 로스터(제출/대기·값) 확인.
5. GM **"공개"** → `computeOrder` 실행 → 공개 **결과 챗 카드**(`initiative-result.html`: 순서·값·동률 그룹) 게시 + `bid-reveal` 브로드캐스트(플레이어 프롬프트 닫힘) → 세션 `revealed`.
6. GM **"초기화"**로 새 세션 시작.

## 엣지 케이스 / 에러 처리

- **값 검증**: 정수 1~6만 허용. 그 외 제출은 거부.
- **미제출자**: GM이 공개를 강행할 수 있다. 미제출자는 순서에서 **제외**하고 결과 카드에 "미제출"로 별도 표기.
- **플레이어 재접속**: 프롬프트가 닫힌다 → GM **"재요청"** 버튼으로 `bid-start`를 재송신해 프롬프트를 다시 연다.
- **GM 새로고침**: 메모리 세션 소실 → 재시작(임시 모델 합의대로).
- **GM 부재**: 플레이어 프롬프트의 제출을 비활성화하고 안내 표시.
- **PL명 표기**: "플롯 완료" 카드의 이름은 제출한 플레이어(user) 이름을 쓴다. NPC는 GM이 직접 입력하므로 "플롯 완료" 카드를 게시하지 않는다.

## 테스트

- **`computeOrder` Vitest 단위테스트**: 오름차순 정렬, 동률 그룹핑(같은 rank), 1=최속, 빈 입력, 전원 동값, 미제출(null) 제외.
- **소켓/UI 수동 검증**: GM + 플레이어 멀티 클라이언트로 입찰 시작/제출/플롯완료 카드/공개/결과 카드/재요청/초기화 시나리오.

## 위험과 완화

- **소켓 메시지 누락/순서**: GM 권위 단일 수집점이라 충돌 적음. 세션 id로 늦게 도착한 옛 세션 메시지를 무시.
- **비밀 누설**: UI 수준 비밀로 합의(협력 테이블). 진짜 비밀이 필요하면 추후 귓속말 기반으로 교체 가능(범위 밖).
- **GM 메모리 휘발**: 임시 모델 합의. 진행 중 새로고침은 재시작으로 대응.
