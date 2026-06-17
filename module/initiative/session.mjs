import { computeOrder } from "./order.mjs";

// 진행 중인 플롯 세션 1개를 GM 메모리에 보관한다(임시).
let activeSession = null;
export function getActiveSession() {
  return activeSession;
}
export function setActiveSession(session) {
  activeSession = session;
}

export class PlotSession {
  /** @param {string} id 세션 식별자(GM 패널이 foundry.utils.randomID()로 생성해 주입) */
  constructor(id) {
    this.id = id;
    this.revealed = false;
    /** @type {Map<string,{actorId,name,isNPC,userId,value,submitted}>} */
    this.participants = new Map();
  }

  addParticipant({ actorId, name, isNPC = false, userId = null }) {
    if (this.participants.has(actorId)) return;
    this.participants.set(actorId, { actorId, name, isNPC, userId, value: null, submitted: false });
  }

  removeParticipant(actorId) {
    this.participants.delete(actorId);
  }

  /** 1~6 정수만 허용. 성공 시 true. */
  setValue(actorId, value) {
    const p = this.participants.get(actorId);
    if (!p) return false;
    if (!Number.isInteger(value) || value < 1 || value > 6) return false;
    p.value = value;
    p.submitted = true;
    return true;
  }

  get entries() {
    return [...this.participants.values()].map((p) => ({ actorId: p.actorId, name: p.name, value: p.value }));
  }

  computeOrder() {
    return computeOrder(this.entries);
  }
}
