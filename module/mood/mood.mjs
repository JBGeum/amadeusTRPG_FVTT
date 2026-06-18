import { buildDiceset, usableCount, autoJudgeIndex, buildMoodResult } from "../dice/resolution.mjs";
import { postCard } from "../chat/chat.mjs";
import { MoodDialog } from "./mood-dialog.mjs";

/**
 * 굴림 직후 판정/무드 다이스를 확정하고 결과 카드를 출력한다.
 * 사용 가능 주사위가 1개(1d6 또는 D랭크)면 다이얼로그 없이 자동 확정, 2개 이상이면 다이얼로그.
 * @param {{actor:Actor, values:number[], rank:string, modVal:number, dc:number, label:string}} ctx
 */
export async function resolveMoodDice({ actor, values, rank, modVal, dc, label }) {
  const diceset = buildDiceset(values, rank);
  let judgeIndex;
  let moodIndex = null;
  let specialColor = null;

  if (usableCount(diceset) < 2) {
    judgeIndex = autoJudgeIndex(diceset);
  } else {
    const choice = await MoodDialog.prompt({ diceset, modVal, dc, label });
    if (!choice) return; // 강제 종료 안전장치
    ({ judgeIndex, moodIndex, specialColor } = choice);
  }

  const result = buildMoodResult({ values, modVal, dc, judgeIndex, moodIndex, specialColor });
  await postCard({
    actor,
    template: "systems/amadeus/templates/chatcard/mood-result.html",
    data: { label, ...result },
  });
}
