export type Medal = "gold" | "silver" | "bronze";

/** How long silver and bronze lock a problem before its next fresh attempt. */
export const MEDAL_TTL_DAYS = 7;

/** Silver and bronze have a retry cooldown. Gold is already final. */
export function medalLapses(medal: Medal): boolean {
  return medal !== "gold";
}

/**
 * What a solve cost: every revealed hint plus every wrong guess. A wrong answer
 * is information too, so it is priced the same as peeking at a rung.
 */
export function solveCost(hintsRevealed: number, wrongAttempts: number): number {
  return Math.max(0, hintsRevealed) + Math.max(0, wrongAttempts);
}

/** Cost at the moment of the solve decides the medal. */
export function medalForCost(cost: number): Medal {
  if (cost <= 0) return "gold";
  if (cost === 1) return "silver";
  return "bronze";
}

function betterMedal(a: Medal, b: Medal): Medal {
  const rank: Record<Medal, number> = { gold: 0, silver: 1, bronze: 2 };
  return rank[a] <= rank[b] ? a : b;
}

/**
 * A medal is LOCKED during its cooldown. Silver and bronze can be improved only
 * after the problem has reset for a fresh attempt; gold is final.
 */
export function medalAfterSolve(
  current: Medal | null,
  currentAt: string | null,
  cost: number,
  now = Date.now()
): { medal: Medal; medalAt: string; locked: boolean } {
  const locked = current === "gold" || (!!current && !isExpired(currentAt, now));
  if (locked && current) {
    return {
      medal: current,
      medalAt: currentAt ?? new Date(now).toISOString(),
      locked: true,
    };
  }
  const earned = medalForCost(cost);
  return {
    medal: current ? betterMedal(current, earned) : earned,
    medalAt: new Date(now).toISOString(),
    locked: false,
  };
}

export function isExpired(medalAt: string | null | undefined, now = Date.now()): boolean {
  if (!medalAt) return true;
  const t = Date.parse(medalAt);
  if (Number.isNaN(t)) return true;
  return now - t > MEDAL_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The medal the library should paint. Earned medals remain visible forever;
 * the timestamp controls only when a silver or bronze problem may reset.
 */
export function activeMedal(
  medal: Medal | null | undefined,
  medalAt: string | null | undefined,
  now = Date.now()
): Medal | null {
  return medal ?? null;
}

export function medalLabel(m: Medal): string {
  return m === "gold" ? "GOLD · NO HINTS" : m === "silver" ? "SILVER · 1 HINT" : "BRONZE";
}

/** Whole days left before a lapsing medal expires, floored at 0. Gold never calls this. */
export function daysLeft(medalAt: string | null | undefined, now = Date.now()): number {
  if (!medalAt) return 0;
  const elapsed = now - Date.parse(medalAt);
  const left = MEDAL_TTL_DAYS * 24 * 60 * 60 * 1000 - elapsed;
  return left <= 0 ? 0 : Math.ceil(left / (24 * 60 * 60 * 1000));
}
