<!-- 언어: [English](README.md) | **한국어** -->
**[English](README.md)** · 한국어

# Amadeus — Foundry VTT 게임 시스템

![Foundry v13](https://img.shields.io/badge/foundry-v13-green)
![언어](https://img.shields.io/badge/언어-한국어-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

일본 TRPG **「아마데우스(Amadeus)」**를 [Foundry VTT](https://foundryvtt.com/)에서 플레이하기 위한 **게임 시스템**입니다. 캐릭터 시트, 능력치·아이템 판정, 컴펜디엄(부모신·아이템·롤테이블) 등 세션 진행에 필요한 요소를 제공합니다. 화면과 룰 용어는 **전부 한국어**입니다.

> 신을 부모로 둔 아이들이 「절계」에서 임무를 수행하는 신화 판타지 TRPG입니다. 이 시스템은 그 룰을 Foundry VTT 위에서 굴릴 수 있게 해 줍니다.

## 무엇을 할 수 있나

- **캐릭터 관리** — 이름·나이·직업, 6종 능력치, 생명력, 소지금, 배경, 부모신, 신군(판테온), 속성을 한 시트에서 관리합니다.
- **아마데우스식 판정** — d20이 아니라 **랭크 기반 d6 굴림**입니다. 능력치 랭크에 따라 굴리는 주사위 개수가 달라지고(`S=4d6 · A=3d6 · B=2d6 · C=1d6 · D=2d6`), 주사위 하나하나가 목표치(기본 4) 대비 **개별 성공/실패**로 판정됩니다. `1=펌블`, `6=스페셜`.
- **활력·생명력 처리** — 활력 판정으로 초기 생명력을 자동 계산해 시트에 채워 줍니다. 좌측은 현재 HP, 우측은 최대치를 표시합니다.
- **아이템·기프트 굴림** — 신성무기, 장비, 추억, 보물, 그리고 기프트(술식/상주/보조)를 시트에서 굴리면 결과가 **채팅 카드**로 출력됩니다.
- **부모신 연동** — 부모신(parent) 아이템을 캐릭터에 끌어다 놓으면 6종 능력치의 랭크·수정치가 한 번에 적용됩니다.

### 6종 핵심 능력치

| 능력치 | 표기 |
|------|------------|
| 무용  | warfare    |
| 기술  | technique  |
| 두뇌  | brain      |
| 영력  | spirit     |
| 애정  | love       |
| 일상  | mundane    |

각 능력치는 **랭크(S~D)**와 **수정치(`+++`~`--`)**를 가지며, 이 둘이 판정 주사위 개수와 보정에 반영됩니다.

### 다루는 데이터

- **캐릭터 종류**: 플레이어 캐릭터, NPC
- **배경**: 창세의 아이 · 재앙의 아이 · 인도의 아이 · 짐승의 아이 · 전설의 아이 · 기계의 아이 · 망각의 아이 · 뒤바뀐 아이
- **신군(판테온)**: 그리스 · 야마토 · 이집트 · 크툴루 · 북유럽 · 중화 · 켈트 · 인도 · 메소아메리카 · 타이탄
- **아이템**: 기프트 · 배경 · 부모신 · 신성무기 · 장비 · 추억 · 보물

## 요구 사항

- **Foundry VTT v13 이상**

## 설치

### 방법 A — 매니페스트 URL (권장)

Foundry의 **Game Systems → Install System** 화면 하단 입력란에 아래 매니페스트 URL을 붙여넣어 설치합니다.

```
https://github.com/JBGeum/amadeusTRPG_FVTT/releases/latest/download/system.json
```

> ⚠️ 이 URL은 임시 placeholder입니다. `system.json`과 `amadeus.zip`을 포함한 GitHub Release가 게시된 뒤에만 동작합니다. 그 전까지는 방법 B를 사용하세요.

### 방법 B — 수동 설치

이 시스템은 빌드 산출물인 `dist/` 폴더 하나가 완전한 시스템 패키지입니다.

1. 시스템을 빌드합니다(아래 [개발자용 빌드](#개발자용-빌드) 참조). 이미 빌드된 `dist/`가 있다면 그대로 사용합니다.
2. `dist/` 폴더의 **내용물 전체**를 Foundry 데이터 경로의 `Data/systems/amadeus/` 안에 복사합니다.
   - Foundry 데이터 경로는 보통 다음 위치입니다.
     - Windows: `%localappdata%\FoundryVTT\Data\systems\`
     - macOS: `~/Library/Application Support/FoundryVTT/Data/systems/`
     - Linux: `~/.local/share/FoundryVTT/Data/systems/`
3. Foundry VTT를 실행하고 **Game Systems** 목록에서 *Amadeus*를 선택해 월드를 생성합니다.

> 시스템 파일(`system.json` 등)을 바꾼 뒤에는 Foundry를 **재시작**해야 변경이 반영됩니다.

## 라이선스

MIT — 자세한 내용은 `LICENSE.txt`를 참조하세요.

---

## 개발자용 빌드

소스에서 직접 빌드하려면 Node.js(LTS)와 npm이 필요합니다. 빌드 도구는 **Vite**이며, `npm run build`가 JS·SCSS·메타데이터를 묶어 자립형 `dist/`를 생성합니다.

```bash
npm install        # 의존성 설치 (최초 1회)
npm run build      # dist/ 로 번들 — 설치 전 필수
npm run dev        # 소스 변경 시 자동 재빌드
```

> 컴펜디엄 팩 편집(`npm run pack:extract` / `pack:compile`), 코드 컨벤션, 아키텍처 등 개발 관련 상세는 저장소의 `CLAUDE.md`를 참고하세요.