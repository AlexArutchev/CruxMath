import type { Medal } from "./medal";
import { MEDAL_ORDER } from "./progress";

export type Hints = "all" | "with" | "without";

export type Filters = {
  q: string;
  year: string;
  type: string | null;
  tiers: Set<string>;
  topics: Set<string>;
  hints: Hints;
  /** Medals to keep. Empty means no medal filter, not "none earned". */
  medals: Set<Medal>;
  dlo: number;
  dhi: number;
};

export const DIFF_MIN = 1;
export const DIFF_MAX = 10;

export function freshFilters(): Filters {
  return {
    q: "",
    year: "",
    type: null,
    tiers: new Set<string>(),
    topics: new Set<string>(),
    hints: "all",
    medals: new Set<Medal>(),
    dlo: DIFF_MIN,
    dhi: DIFF_MAX,
  };
}

export function isDefault(f: Filters): boolean {
  return (
    f.q === "" &&
    f.year === "" &&
    f.type === null &&
    f.tiers.size === 0 &&
    f.topics.size === 0 &&
    f.hints === "all" &&
    f.medals.size === 0 &&
    f.dlo === DIFF_MIN &&
    f.dhi === DIFF_MAX
  );
}

/**
 * Filters live in the URL so that leaving for a problem and coming back, using
 * the back button, or reloading all restore the same view. It also makes a
 * filtered library shareable, which component state never could.
 *
 * Only non-default values are written, so an unfiltered library stays at a
 * clean /browse.
 */
export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.year.trim()) p.set("year", f.year.trim());
  if (f.type) p.set("type", f.type);
  if (f.tiers.size) p.set("tier", Array.from(f.tiers).join(","));
  if (f.topics.size) p.set("topic", Array.from(f.topics).join(","));
  if (f.hints !== "all") p.set("hints", f.hints);
  // Written in MEDAL_ORDER, not insertion order, so the same selection always
  // produces the same URL and shared links compare equal.
  if (f.medals.size) p.set("medal", MEDAL_ORDER.filter((m) => f.medals.has(m)).join(","));
  if (f.dlo !== DIFF_MIN) p.set("dlo", String(f.dlo));
  if (f.dhi !== DIFF_MAX) p.set("dhi", String(f.dhi));
  const s = p.toString();
  return s ? "?" + s : "";
}

function clampDifficulty(raw: string | null, fallback: number): number {
  // Number(null) is 0, not NaN, so a missing param has to be rejected before
  // the numeric check or the range silently collapses to its minimum.
  if (raw === null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(DIFF_MAX, Math.max(DIFF_MIN, n));
}

export function filtersFromQuery(search: string): Filters {
  const p = new URLSearchParams(search);
  const f = freshFilters();
  f.q = p.get("q") ?? "";
  f.year = p.get("year") ?? "";
  f.type = p.get("type");
  const tier = p.get("tier");
  if (tier) f.tiers = new Set(tier.split(",").filter(Boolean));
  const topic = p.get("topic");
  if (topic) f.topics = new Set(topic.split(",").filter(Boolean));
  const hints = p.get("hints");
  if (hints === "with" || hints === "without") f.hints = hints;
  const medal = p.get("medal");
  if (medal) {
    // Only known medal names survive, so a hand-edited URL cannot put a value
    // in the set that no button can ever clear.
    const names = medal.split(",");
    f.medals = new Set(MEDAL_ORDER.filter((m) => names.includes(m)));
  }
  f.dlo = clampDifficulty(p.get("dlo"), DIFF_MIN);
  f.dhi = clampDifficulty(p.get("dhi"), DIFF_MAX);
  if (f.dlo > f.dhi) {
    const lo = f.dhi;
    f.dhi = f.dlo;
    f.dlo = lo;
  }
  return f;
}

const KEY = "cruxmath-browse-filters";

/**
 * Backup for the one case the URL cannot cover: the LIBRARY nav link goes to a
 * bare /browse, and losing the filters there would be just as annoying.
 * Session-scoped, so a new tab starts clean.
 */
export function saveFilters(f: Filters): void {
  if (typeof window === "undefined") return;
  try {
    const q = filtersToQuery(f);
    if (q) window.sessionStorage.setItem(KEY, q);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Private mode or a full quota. Filters are a convenience, not worth throwing.
  }
}

export function loadFilters(search: string): Filters {
  if (search && search !== "?") return filtersFromQuery(search);
  if (typeof window === "undefined") return freshFilters();
  try {
    const saved = window.sessionStorage.getItem(KEY);
    if (saved) return filtersFromQuery(saved);
  } catch {
    // ignore
  }
  return freshFilters();
}
