import { describe, it, expect } from "vitest";
import { PlotSession } from "../module/initiative/session.mjs";

function make() {
  const s = new PlotSession("sess1");
  s.addParticipant({ actorId: "a", name: "A", isNPC: false, userId: "u1" });
  s.addParticipant({ actorId: "b", name: "B", isNPC: true });
  return s;
}

describe("PlotSession", () => {
  it("records a valid value and marks submitted", () => {
    const s = make();
    expect(s.setValue("a", 3)).toBe(true);
    const p = s.participants.get("a");
    expect(p.value).toBe(3);
    expect(p.submitted).toBe(true);
  });

  it("rejects out-of-range or non-integer values", () => {
    const s = make();
    expect(s.setValue("a", 0)).toBe(false);
    expect(s.setValue("a", 7)).toBe(false);
    expect(s.setValue("a", 2.5)).toBe(false);
    expect(s.participants.get("a").submitted).toBe(false);
  });

  it("ignores unknown participant", () => {
    const s = make();
    expect(s.setValue("zzz", 3)).toBe(false);
  });

  it("does not duplicate an existing participant", () => {
    const s = make();
    s.addParticipant({ actorId: "a", name: "A2" });
    expect(s.participants.size).toBe(2);
    expect(s.participants.get("a").name).toBe("A");
  });

  it("computes order from current values, excluding unsubmitted", () => {
    const s = make();
    s.setValue("a", 1);
    const order = s.computeOrder();
    expect(order).toHaveLength(1);
    expect(order[0].members.map((m) => m.actorId)).toEqual(["a"]);
  });
});
