/**
 * 플롯 값 목록을 행동 순서로 계산한다. 낮은 값이 먼저, 동값은 같은 순번으로 묶는다(동시행동).
 * value가 정수(1~6)가 아닌 항목(미제출 등)은 제외한다.
 * @param {{actorId:string, name:string, value:number|null}[]} entries
 * @returns {{rank:number, value:number, members:{actorId:string,name:string}[]}[]}
 */
export function computeOrder(entries) {
  const byValue = new Map();
  for (const e of entries) {
    if (!Number.isInteger(e.value)) continue;
    if (!byValue.has(e.value)) byValue.set(e.value, []);
    byValue.get(e.value).push({ actorId: e.actorId, name: e.name });
  }
  const sortedValues = [...byValue.keys()].sort((a, b) => a - b);
  return sortedValues.map((value, i) => ({ rank: i + 1, value, members: byValue.get(value) }));
}
