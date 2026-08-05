export type Medal = "gold" | "silver" | "bronze";

/** How long a lapsing medal stays visible in the library. Gold is exempt. */
export const MEDAL_TTL_DAYS = 7;

/** Gold is permanent. Silver and bronze fade so the problem resurfaces. */
export function medalLapses(medal: Medal): boolean {
  return medal !== "gold";
}

const RANK: Record<Medal, number> = { gold: 3, silver: 2, bronze: 1 };

/** Hints spent at the moment of the solve decide the medal. */
export function medalForHints(hints: number): Medal {
  if (hints <= 0) return "gold";
  if (hints === 1) return "silver";
  return "bronze";
}

/** Higher of two medals, so a cleaner re-solve upgrades and a worse one does not demote. */
export function bestMedal(a: Medal | null, b: Medal | null): Medal | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] >= RANK[b] ? a : b;
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
