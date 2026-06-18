import { FixedWidthMixin } from "../helpers/fixed-width.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * 2개 이상 주사위 판정에서 판정 다이스 1개 + 무드 다이스 1개를 고르는 다이얼로그.
 * 닫기 불가(확정 필수). 무드 다이스가 6(스페셜)이면 흑적청녹백 중 색을 추가로 고른다.
 */
export class MoodDialog extends FixedWidthMixin(HandlebarsApplicationMixin(ApplicationV2)) {
  static DEFAULT_OPTIONS = {
    id: "amadeus-mood-dialog",
    classes: ["amadeus", "amadeus-dlg", "mood-dialog-app"],
    tag: "div",
    position: { width: 340, height: "auto" },
    window: { title: "AMADEUS.mood.dialogTitle", icon: "fa-solid fa-dice", resizable: true },
    actions: {
      pickJudge: MoodDialog.#onPickJudge,
      pickMood: MoodDialog.#onPickMood,
      pickColor: MoodDialog.#onPickColor,
      confirm: MoodDialog.#onConfirm,
    },
  };

  static PARTS = { main: { template: "systems/amadeus/templates/dialog/mood-dialog.html" } };

  static #current = null;

  constructor(options) {
    super(options);
    this.diceset = options.diceset;
    this.modVal = options.modVal;
    this.dc = options.dc;
    this.label = options.label;
    this._resolve = options.resolve;
    this.judgeIndex = null;
    this.moodIndex = null;
    this.specialColor = null;
    this._confirmed = false;
  }

  /** 닫기 불가: 확정 전에는 X/ESC를 무시한다. */
  async close(options = {}) {
    if (!this._confirmed && !options.force) return this;
    return super.close(options);
  }

  /** 강제 종료 시 대기 중인 Promise를 안전하게 해제. */
  _onClose(options) {
    super._onClose(options);
    if (MoodDialog.#current === this) MoodDialog.#current = null;
    if (!this._confirmed) this._resolve?.(null);
  }

  /** @override data-theme 주입 */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.theme = game.settings.get("amadeus", "theme");
  }

  async _prepareContext() {
    const moodValue = this.moodIndex != null ? this.diceset[this.moodIndex].value : null;
    const moodIsSpecial = moodValue === 6;
    const canConfirm =
      this.judgeIndex != null &&
      this.moodIndex != null &&
      (!moodIsSpecial || this.specialColor != null);
    return {
      label: this.label,
      modVal: this.modVal,
      dc: this.dc,
      dice: this.diceset.map((d, i) => ({
        index: i,
        value: d.value,
        isJudge: i === this.judgeIndex,
        isMood: i === this.moodIndex,
      })),
      moodIsSpecial,
      colors: ["black", "red", "blue", "green", "white"].map((key) => ({
        key,
        selected: key === this.specialColor,
      })),
      canConfirm,
    };
  }

  static #onPickJudge(event, target) {
    const i = Number(target.dataset.index);
    this.judgeIndex = i;
    if (this.moodIndex === i) this.moodIndex = null; // 같은 주사위 중복 금지
    this.render();
  }

  static #onPickMood(event, target) {
    const i = Number(target.dataset.index);
    this.moodIndex = i;
    if (this.judgeIndex === i) this.judgeIndex = null;
    if (this.diceset[i].value !== 6) this.specialColor = null; // 6 아니면 색 선택 무효화
    this.render();
  }

  static #onPickColor(event, target) {
    this.specialColor = target.dataset.color;
    this.render();
  }

  static #onConfirm() {
    const moodValue = this.diceset[this.moodIndex]?.value;
    const ok =
      this.judgeIndex != null &&
      this.moodIndex != null &&
      (moodValue !== 6 || this.specialColor != null);
    if (!ok) return;
    this._confirmed = true;
    this._resolve?.({
      judgeIndex: this.judgeIndex,
      moodIndex: this.moodIndex,
      specialColor: this.specialColor,
    });
    this.close();
  }

  /**
   * 다이얼로그를 열고 선택 결과를 Promise로 반환한다.
   * 직전 다이얼로그가 미확정 상태로 떠 있으면 강제로 닫아(=null resolve) 그 Promise를 해제한 뒤
   * 새 다이얼로그를 연다. 같은 id 재렌더로 첫 Promise가 hang되는 것을 막는다(PlotPrompt와 동일 패턴).
   */
  static async prompt(context) {
    MoodDialog.#current?.close({ force: true });
    return new Promise((resolve) => {
      const dlg = new MoodDialog({ ...context, resolve });
      MoodDialog.#current = dlg;
      dlg.render(true);
    });
  }
}
