// 시트 아이템 목록 표시 순서를 정하는 순수 비교자. Foundry 전역 미참조(Vitest 가능).

/**
 * 아이템 표시 순서 비교자: sort 필드 오름차순, 동률이면 생성 시각(createdTime) 오름차순.
 * sort가 전부 0인 기존 데이터에서도 생성순으로 안정적으로 정렬된다.
 * @param {{sort:number, createdTime:number}} a
 * @param {{sort:number, createdTime:number}} b
 * @returns {number} Array.prototype.sort 비교 결과
 */
export function compareItemOrder(a, b) {
  return (a.sort - b.sort) || (a.createdTime - b.createdTime);
}
