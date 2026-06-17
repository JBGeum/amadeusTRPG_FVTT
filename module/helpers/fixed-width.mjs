/**
 * AppV2 믹스인: 세로(height)만 리사이즈 허용, 가로(width)는 고정.
 *
 * Foundry ApplicationV2에는 리사이즈 축을 한쪽만 잠그는 옵션이 없다.
 * 리사이즈 핸들 드래그는 `setPosition({ width, height })`를 경유하므로,
 * 여기서 width를 DEFAULT_OPTIONS의 고정값으로 되돌려 가로 변경을 무효화한다.
 * (세로는 그대로 통과 → 핸들로 height만 조절된다.)
 *
 * 사용: `class Foo extends FixedWidthMixin(HandlebarsApplicationMixin(BaseV2)) { ... }`
 * 그리고 `DEFAULT_OPTIONS.window.resizable = true` 필요.
 *
 * @param {typeof foundry.applications.api.ApplicationV2} Base
 * @returns {typeof foundry.applications.api.ApplicationV2}
 */
export function FixedWidthMixin(Base) {
  return class FixedWidth extends Base {
    /** @override 가로를 고정값으로 핀하고 나머지는 그대로 적용한다. */
    setPosition(position = {}) {
      const fixed = this.options.position?.width;
      if (position && Number.isFinite(fixed)) position.width = fixed;
      return super.setPosition(position);
    }
  };
}
