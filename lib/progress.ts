import type { Medal } from "./medal";

export type SolveRecord = {
  problemId: string;
  contest: string;
  num: number;
  statement: string;
  difficulty: number | null;
  topics: string[];
  medal: Medal;
  medalAt: string | null;
};

export type MedalCounts = { gold: number; silver: number; bronze: number };

export type ContestRow = {
  group: string;
  solved: number;
  total: number;
  counts: MedalCounts;
};

export type DifficultyBucket = { difficulty: number; counts: MedalCounts };

export const MEDAL_ORDER: Medal[] = ["gold", "silver", "bronze"];

export const emptyCounts = (): MedalCounts => ({ gold: 0, silver: 0, bronze: 0 });

export const totalOf = (c: MedalCounts): number => c.gold + c.silver + c.bronze;

/**
 * Collapse "2022 AMC 10A" into the contest family the progress page groups by.
 * Everything in the corpus is one of three families.
 */
export function contestGroup(contest: string): string {
  if (/AMC\s*10/i.test(contest)) return "AMC 10";
  if (/AMC\s*12/i.test(contest)) return "AMC 12";
  if (/AIME/i.test(contest)) return "AIME";
  return "OTHER";
}

/** Difficulty column for the histogram: 1 through 10, clamped. */
export function difficultyBucket(d: number | null): number | null {
  if (d == null || !Number.isFinite(d)) return null;
  return Math.min(10, Math.max(1, Math.ceil(d)));
}

export function countByMedal(records: SolveRecord[]): MedalCounts {
  const c = emptyCounts();
  for (const r of records) c[r.medal] += 1;
  return c;
}

export function byContest(
  records: SolveRecord[],
  archive: Record<string, number>
): ContestRow[] {
  return ["AMC 10", "AMC 12", "AIME"].map((group) => {
    const rows = records.filter((r) => contestGroup(r.contest) === group);
    return {
      group,
      solved: rows.length,
      total: archive[group] ?? 0,
      counts: countByMedal(rows),
    };
  });
}

export function byDifficulty(records: SolveRecord[]): DifficultyBucket[] {
  const buckets: DifficultyBucket[] = [];
  for (let d = 1; d <= 10; d++) buckets.push({ difficulty: d, counts: emptyCounts() });
  for (const r of records) {
    const b = difficultyBucket(r.difficulty);
    if (b) buckets[b - 1].counts[r.medal] += 1;
  }
  return buckets;
}

/** The hardest problem solved with no hints: the stat worth bragging about. */
export function hardestGold(records: SolveRecord[]): SolveRecord | null {
  const golds = records.filter((r) => r.medal === "gold" && r.difficulty != null);
  if (!golds.length) return null;
  return golds.reduce((best, r) =>
    (r.difficulty as number) > (best.difficulty as number) ? r : best
  );
}

/** Percentage widths for a stacked medal bar, summing to 100 when anything is solved. */
export function medalSplit(c: MedalCounts): MedalCounts {
  const t = totalOf(c);
  if (!t) return { gold: 0, silver: 0, bronze: 0 };
  return {
    gold: (c.gold / t) * 100,
    silver: (c.silver / t) * 100,
    bronze: (c.bronze / t) * 100,
  };
}

/** What a medal implies was spent, for the ledger's right-hand column. */
export function hintsLabel(m: Medal): string {
  return m === "gold" ? "NO HINTS" : m === "silver" ? "1 HINT" : "2+ HINTS";
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export function shortDate(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  return MONTHS[d.getMonth()] + " " + d.getDate();
}
