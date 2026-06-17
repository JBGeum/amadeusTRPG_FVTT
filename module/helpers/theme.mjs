/**
 * 열려 있는 모든 Amadeus 앱(.amadeus / .amadeus-dlg)에 테마를 즉시 반영한다.
 *
 * 테마는 CSS 변수(data-theme 토큰) 전환이라 대부분 재렌더 없이 적용된다.
 * 액터 시트만 헤더 토글 컨트롤의 아이콘/라벨 갱신을 위해 재렌더한다.
 * (instanceof 대신 DOM 클래스로 식별 → actor-sheet.mjs와의 순환 import 회피.)
 *
 * @param {"dark"|"light"} theme
 */
export function applyThemeToOpenApps(theme) {
  for (const app of foundry.applications?.instances?.values() ?? []) {
    const el = app.element;
    if (!el) continue;
    if (el.classList?.contains("amadeus") || el.classList?.contains("amadeus-dlg")) {
      el.dataset.theme = theme;
    }
    // 액터 시트(.amadeus.sheet.actor)는 재렌더하여 헤더 토글 아이콘도 갱신한다.
    if (el.classList?.contains("sheet") && el.classList?.contains("actor")) {
      app.render();
    }
  }
}
