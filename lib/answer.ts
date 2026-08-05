/**
 * Answer checking, deliberately without a model.
 *
 * AMC answers are letters A-E. AIME answers are integers 0-999. A few corpus
 * rows carry prose instead, e.g. 2022 AIME II Problem 8 which the contest
 * accepted as either 80 or 81; those are stored as "080 or 081 (both were
 * accepted)". Matching every integer in the stored answer handles that case
 * without special-casing it, and without breaking single-answer problems.
 */
export function isChoiceAnswer(answer: string | null): boolean {
  return !!answer && /^[A-E]$/i.test(answer.trim());
}

export function isCorrect(input: string, answer: string | null): boolean {
  if (!answer) return false;
  const given = input.trim();
  if (!given) return false;
  const expected = answer.trim();

  if (isChoiceAnswer(expected)) {
    return given.toUpperCase() === expected.toUpperCase();
  }
  if (given === expected) return true;

  // Numeric compare against every integer the stored answer mentions, so
  // "080 or 081" accepts 80, 081, 81 and leading-zero variants alike.
  const givenNum = Number(given);
  if (!Number.isFinite(givenNum) || !/^\d+$/.test(given)) return false;
  const tokens = expected.match(/\d+/g);
  return !!tokens && tokens.some((t) => Number(t) === givenNum);
}

export function answerLabel(answer: string | null): string {
  if (isChoiceAnswer(answer)) return "ANSWER · MULTIPLE CHOICE";
  if (answer && /^\d{1,3}$/.test(answer.trim())) return "ANSWER · INTEGER 0-999";
  return "ANSWER";
}
