import { diceCountForRank } from "./resolution.mjs";

export async function amadeRoll(rank, rankVal, rollData) {
  const count = diceCountForRank(rank);
  const roll = new Roll(count + "d6", rollData);
  await roll.evaluate();
  return roll;
}
