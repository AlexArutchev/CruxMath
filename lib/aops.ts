const BASE = "https://artofproblemsolving.com/wiki/index.php?title=";

/**
 * Every contest in the corpus is named "<year> <contest>" (e.g. "2022 AMC 10A",
 * "2024 AIME I"), which maps directly onto the AoPS wiki page title.
 *   2022 AMC 10A, 21 -> .../index.php?title=2022_AMC_10A_Problems/Problem_21
 */
export function aopsUrl(contest: string | null, num: number | null): string | null {
  if (!contest || num == null) return null;
  const title = `${contest.trim().replace(/\s+/g, "_")}_Problems/Problem_${num}`;
  // Encode, then put the path separator back: AoPS expects a literal slash.
  return BASE + encodeURIComponent(title).replace(/%2F/g, "/");
}
