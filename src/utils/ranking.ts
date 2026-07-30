/**
 * Positions avec ex-aequo (dead heat FISA).
 * Ex. 7:00.000, 7:00.000, 7:05.000 → 1, 1, 3
 */
export function assignDeadHeatPositions<T>(
  sortedItems: T[],
  getTimeMs: (item: T) => number | null | undefined
): Array<T & { position: number | null }> {
  let currentPosition = 1;

  return sortedItems.map((item, index) => {
    const time = getTimeMs(item);

    if (time === null || time === undefined) {
      return { ...item, position: null };
    }

    if (index > 0) {
      const prevTime = getTimeMs(sortedItems[index - 1]);
      if (prevTime !== null && prevTime !== undefined && time !== prevTime) {
        currentPosition = index + 1;
      }
    } else {
      currentPosition = 1;
    }

    return { ...item, position: currentPosition };
  });
}
