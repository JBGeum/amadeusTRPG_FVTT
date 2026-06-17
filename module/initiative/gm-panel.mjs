import { PlotSession, getActiveSession, setActiveSession } from "./session.mjs";
import { emitPlot } from "./socket.mjs";
import { postCard } from "../chat/chat.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** GM이 플롯 세션을 운영하는 패널. */
export class PlotGMPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "amadeus-plot-gm-panel",
    classes: ["amadeus", "plot-gm-panel-app"],
    tag: "div",
    position: { width: 460, height: "auto" },
    window: { title: "AMADEUS.initiative.panelTitle" },
    actions: {
      start: PlotGMPanel.#onStart,
      reveal: PlotGMPanel.#onReveal,
      reset: PlotGMPanel.#onReset,
      rerequest: PlotGMPanel.#onRerequest,
      addNpc: PlotGMPanel.#onAddNpc,
      setNpc: PlotGMPanel.#onSetNpc,
      removeParticipant: PlotGMPanel.#onRemoveParticipant,
    },
  };

  static PARTS = { main: { template: "systems/amadeus/templates/initiative/gm-panel.html" } };

  constructor(options) {
    super(options);
    this._onUpdate = () => this.render();
    Hooks.on("amadeus.plotUpdate", this._onUpdate);
  }

  /** @override AppV2 close 훅 */
  async _onClose(options) {
    Hooks.off("amadeus.plotUpdate", this._onUpdate);
    return super._onClose(options);
  }

  async _prepareContext() {
    const session = getActiveSession();
    const participants = session ? [...session.participants.values()] : [];
    const existingIds = new Set(participants.map((p) => p.actorId));
    const npcChoices = game.actors
      .filter((a) => a.type === "npc" && !existingIds.has(a.id))
      .map((a) => ({ id: a.id, name: a.name }));
    return {
      active: !!session,
      revealed: !!session?.revealed,
      participants: participants.map((p) => ({ ...p })),
      dice: [1, 2, 3, 4, 5, 6],
      npcChoices,
      order: session?.revealed ? session.computeOrder() : [],
    };
  }

  // --- actions (this === panel instance) ---

  static #onStart() {
    const session = new PlotSession(foundry.utils.randomID());
    // 각 플레이어의 배정 캐릭터(user.character)를 기본 참가자로 등록한다.
    // 플롯 프롬프트도 game.user.character로 제출하므로 actorId가 일치한다.
    for (const user of game.users) {
      if (user.isGM) continue;
      const actor = user.character;
      if (!actor) continue;
      session.addParticipant({ actorId: actor.id, name: actor.name, isNPC: false, userId: user.id });
    }
    setActiveSession(session);
    emitPlot("plot-start", { sessionId: session.id });
    this.render();
  }

  static #onRerequest() {
    const session = getActiveSession();
    if (session) emitPlot("plot-start", { sessionId: session.id });
  }

  static async #onReveal() {
    const session = getActiveSession();
    if (!session || session.revealed) return;
    if (session.participants.size === 0) {
      ui.notifications.warn(game.i18n.localize("AMADEUS.initiative.noParticipants"));
      return;
    }
    session.revealed = true;
    const order = session.computeOrder();
    const notSubmitted = [...session.participants.values()].filter((p) => !Number.isInteger(p.value)).map((p) => ({ name: p.name }));
    await postCard({
      actor: null,
      template: "systems/amadeus/templates/chatcard/plot-result.html",
      data: { order, notSubmitted },
    });
    emitPlot("plot-reveal", { sessionId: session.id });
    this.render();
  }

  static #onReset() {
    const session = getActiveSession();
    if (session) emitPlot("plot-cancel", { sessionId: session.id });
    setActiveSession(null);
    this.render();
  }

  static #onAddNpc(event, target) {
    const session = getActiveSession();
    if (!session) return;
    const select = target.closest(".plot-gm-addnpc")?.querySelector(".plot-npc-select");
    const id = select?.value;
    if (!id) return;
    const actor = game.actors.get(id);
    if (!actor) return;
    session.addParticipant({ actorId: actor.id, name: actor.name, isNPC: true });
    this.render();
  }

  static #onSetNpc(event, target) {
    const session = getActiveSession();
    if (!session) return;
    session.setValue(target.dataset.actorId, Number(target.dataset.value));
    this.render();
  }

  static #onRemoveParticipant(event, target) {
    const session = getActiveSession();
    if (!session) return;
    session.removeParticipant(target.dataset.actorId);
    this.render();
  }
}
