import { PlotSession, getActiveSession, setActiveSession } from "./session.mjs";
import { emitPlot } from "./socket.mjs";
import { postCard } from "../chat/chat.mjs";
import { FixedWidthMixin } from "../helpers/fixed-width.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** GM이 플롯 세션을 운영하는 패널. */
export class PlotGMPanel extends FixedWidthMixin(HandlebarsApplicationMixin(ApplicationV2)) {
  static DEFAULT_OPTIONS = {
    id: "amadeus-plot-gm-panel",
    classes: ["amadeus", "amadeus-dlg", "plot-gm-panel-app"],
    tag: "div",
    position: { width: 460, height: "auto" },
    window: { title: "AMADEUS.initiative.panelTitle", icon: "fa-solid fa-hourglass-half", resizable: true },
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

  /**
   * 싱글턴 인스턴스. 씬 컨트롤/매크로에서 매번 `new` 하면 같은 id의 ApplicationV2가
   * 중복 생성되고, height:"auto" 패널이 재오픈 렌더에서 offsetWidth(null) 크래시를 낸다.
   */
  static #instance = null;

  /** 멱등 오픈: 떠 있으면 앞으로, 닫혀 있으면 렌더한다. */
  static open() {
    this.#instance ??= new this();
    if (this.#instance.rendered) this.#instance.bringToFront?.();
    else this.#instance.render({ force: true });
  }

  /** @override AppV2 close 훅: 라이브 갱신 구독 해제 + 씬 컨트롤 비활성화로 재오픈 복원 */
  async _onClose(options) {
    if (this._onUpdate) {
      Hooks.off("amadeus.plotUpdate", this._onUpdate);
      this._onUpdate = null;
    }
    // 내 컨트롤이 활성 상태면 기본 컨트롤(tokens)로 되돌려 비활성화한다.
    // 그래야 다음 클릭이 false→true 전이가 되어 onChange(active:true)로 재오픈된다.
    const controls = ui.controls;
    if (controls?.control?.name === "amadeusPlot") void controls.activate({ control: "tokens" });
    return super._onClose(options);
  }

  /** @override data-theme 주입 + 라이브 갱신 구독(멱등 — 싱글턴 재오픈 시 복원) */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.theme = game.settings.get("amadeus", "theme");
    if (!this._onUpdate) {
      this._onUpdate = () => this.render();
      Hooks.on("amadeus.plotUpdate", this._onUpdate);
    }
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
