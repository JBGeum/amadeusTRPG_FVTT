import { emitPlot } from "./socket.mjs";
import { postCard } from "../chat/chat.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** 플레이어가 플롯 숫자(1~6)를 비밀리에 고르는 프롬프트. */
export class PlotPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "amadeus-plot-prompt",
    classes: ["amadeus", "plot-prompt-app"],
    tag: "div",
    position: { width: 320, height: "auto" },
    window: { title: "AMADEUS.initiative.promptTitle" },
    actions: { pick: PlotPrompt.#onPick },
  };

  static PARTS = { main: { template: "systems/amadeus/templates/initiative/plot-prompt.html" } };

  static #current = null;

  constructor(options) {
    super(options);
    this.sessionId = options.sessionId;
    this.actor = options.actor;
    this.selected = null;
    this.posted = false;
  }

  async _prepareContext() {
    return {
      dice: [1, 2, 3, 4, 5, 6].map((value) => ({ value, selected: value === this.selected })),
      selected: this.selected,
    };
  }

  static #onPick(event, target) {
    this._pick(Number(target.dataset.value));
  }

  async _pick(value) {
    if (!game.users.some((u) => u.isGM && u.active)) {
      ui.notifications.warn(game.i18n.localize("AMADEUS.initiative.noGm"));
      return;
    }
    this.selected = value;
    emitPlot("plot-submit", { sessionId: this.sessionId, actorId: this.actor.id, userId: game.user.id, value });
    if (!this.posted) {
      this.posted = true;
      await postCard({
        actor: this.actor,
        template: "systems/amadeus/templates/chatcard/plot-done.html",
        data: { name: game.user.name },
      });
    }
    this.render();
  }

  /** 현재 유저의 배정 캐릭터로 프롬프트를 연다. */
  static openForUser(sessionId) {
    const actor = game.user.character;
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("AMADEUS.initiative.noCharacter"));
      return;
    }
    PlotPrompt.#current?.close();
    PlotPrompt.#current = new PlotPrompt({ sessionId, actor });
    PlotPrompt.#current.render(true);
  }

  static closeAll() {
    PlotPrompt.#current?.close();
    PlotPrompt.#current = null;
  }
}
