export type RoundResult = {
  correct: number;
  total: number;
  wrong: number;
  solved: boolean;
};

export function evaluateSelection(selected: Set<number>, targets: Set<number>, level: number) {
  let correct = 0;
  selected.forEach((index) => {
    if (targets.has(index)) correct += 1;
  });

  const wrong = selected.size - correct;
  return {
    result: {
      correct,
      total: targets.size,
      wrong,
      solved: correct === targets.size && wrong === 0,
    } satisfies RoundResult,
    nextLevel: level + 1,
  };
}
