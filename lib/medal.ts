export type Medal = "gold" | "silver" | "bronze";

/** How long a lapsing medal stays visible in the library. Gold is exempt. */
export const MEDAL_TTL_DAYS = 7;

/** Gold is permanent. Silver and bronze fade so the problem resurfaces. */
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

/**
 * A medal is LOCKED while it is active. Re-solving during the window does not
 * change it, which is the point: you cannot grind a bronze into a gold by
 * resetting and immediately retrying. Wait for it to lapse, then earn it cold.
 * Gold never lapses, so gold is final.
 */
export function medalAfterSolve(
  current: Medal | null,
  currentAt: string | null,
  cost: number,
  now = Date.now()
): { medal: Medal; medalAt: string; locked: boolean } {
  const active = activeMedal(current, currentAt, now);
  if (active && currentAt) {
    return { medal: active, medalAt: currentAt, locked: true };
  }
  return { medal: medalForCost(cost), medalAt: new Date(now).toISOString(), locked: false };
}

export function isExpired(medalAt: string | null | undefined, now = Date.now()): boolean {
  if (!medalAt) return true;
  const t = Date.parse(medalAt);
  if (Number.isNaN(t)) return true;
  return now - t > MEDAL_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The medal the library should paint, or null once it has lapsed.
 *
 * Resetting a problem deliberately does NOT clear this: the medal records that
 * you solved it, and only time takes it away. Gold is kept forever, since
 * solving cold is the thing worth keeping a permanent record of; silver and
 * bronze fade after MEDAL_TTL_DAYS so those problems come back around.
 */
export function activeMedal(
  medal: Medal | null | undefined,
  medalAt: string | null | undefined,
  now = Date.now()
): Medal | null {
  if (!medal) return null;
  if (!medalLapses(medal)) return medal;
  return isExpired(medalAt, now) ? null : medal;
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
