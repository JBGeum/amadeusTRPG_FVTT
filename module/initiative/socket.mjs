import { getActiveSession } from "./session.mjs";

export const PLOT_CHANNEL = "system.amadeus";

/** 타입 태그 메시지를 브로드캐스트한다(발신자 제외 전체 수신). */
export function emitPlot(type, payload = {}) {
  game.socket.emit(PLOT_CHANNEL, { type, ...payload });
}

export function registerPlotSocket() {
  game.socket.on(PLOT_CHANNEL, onPlotMessage);
}

function onPlotMessage(data) {
  if (!data?.type) return;
  switch (data.type) {
    case "plot-start":
      Hooks.callAll("amadeus.plotStart", data);
      break;
    case "plot-submit": {
      if (!game.user.isGM) return;
      const session = getActiveSession();
      if (session && !session.revealed && session.id === data.sessionId) {
        session.setValue(data.actorId, data.value);
        Hooks.callAll("amadeus.plotUpdate");
      }
      break;
    }
    case "plot-reveal":
    case "plot-cancel":
      Hooks.callAll("amadeus.plotEnd", data);
      break;
  }
}
