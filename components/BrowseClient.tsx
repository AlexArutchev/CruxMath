"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { latexToHtml } from "@/lib/latex";
import { supabaseBrowser, ensureDeviceUser } from "@/lib/supabase/client";
import { activeMedal, type Medal } from "@/lib/medal";
import { useDragToDismiss } from "@/lib/swipe";
import { MEDAL_ORDER } from "@/lib/progress";
import {
  freshFilters,
  filtersToQuery,
  loadFilters,
  saveFilters,
  type Filters,
} from "@/lib/browse-filters";
import type { Problem } from "@/lib/types";

const PAGE_SIZE = 30;
const TYPES = ["AMC 10", "AMC 12", "AIME"];
const HINTS = [
  { key: "all", label: "ANY" },
  { key: "with", label: "WITH LADDER" },
  { key: "without", label: "NO LADDER" },
] as const;

const pct = (v: number) => ((v - 1) / 9) * 100;

/** Statement bars vary in length so the placeholder reads as text, not a block. */
const SK_STATEMENT_WIDTHS = ["72%", "58%", "80%", "64%", "76%", "68%"];
const SK_CELL_WIDTHS = ["76%", "", "60%", "40%", "54%"];

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {SK_STATEMENT_WIDTHS.map((stmtWidth, r) => (
        <div className="row sk-row" key={r}>
          {SK_CELL_WIDTHS.map((w, c) => (
            <span key={c}>
              <span
                className="sk-bar"
                style={{
                  width: c === 1 ? stmtWidth : w,
                  // Cascade so the load reads as one sweep across the grid.
                  animationDelay: (r * 0.1 + c * 0.05).toFixed(2) + "s",
                }}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function BrowseClient({
  contests,
  topics: allTopics,
  tiers: allTiers,
  archiveTotal,
}: {
  contests: string[];
  topics: string[];
  tiers: string[];
  archiveTotal: number;
}) {
  // Start from defaults so server and client agree on the first paint, then
  // restore from the URL (or the session backup) once mounted. The query is held
  // back until then so a restored view never flashes an unfiltered list first.
  const [f, setF] = useState<Filters>(freshFilters);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setF(loadFilters(window.location.search));
    setRestored(true);
  }, []);

  // Keep the address bar in step without pushing a history entry per keystroke.
  useEffect(() => {
    if (!restored) return;
    const q = filtersToQuery(f);
    window.history.replaceState(null, "", q || window.location.pathname);
    saveFilters(f);
  }, [f, restored]);
  const [rows, setRows] = useState<Problem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Two views of the same rows, and they are not interchangeable.
  // `medals` is what the library PAINTS: silver and bronze lapse after
  // MEDAL_TTL_DAYS so those problems resurface, which is the spaced repetition.
  // `earned` is the permanent record of what was won. Filtering has to use the
  // record: "show me my bronzes" means every bronze, not the ones from this
  // week, and gold never lapsing is why only gold appeared to work.
  const [medals, setMedals] = useState<Map<string, Medal>>(new Map());
  const [earned, setEarned] = useState<Map<string, Medal>>(new Map());
  // The medal filter cannot run until this device's progress has arrived, so the
  // query waits on it rather than briefly reporting zero matches.
  const [medalsLoaded, setMedalsLoaded] = useState(false);

  // Debounce typing so each keystroke does not fire a query.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(f.q), 220);
    return () => clearTimeout(t);
  }, [f.q]);

  const patch = (p: Partial<Filters>) => setF((prev) => ({ ...prev, ...p }));

  const toggle = <T,>(set: Set<T>, v: T): Set<T> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  /**
   * Problem ids carrying one of the selected medals, or null when no medal
   * filter is on.
   *
   * The medal a row should honour is not a column: silver and bronze lapse after
   * MEDAL_TTL_DAYS, and that decision lives in activeMedal, in TypeScript. So the
   * filter resolves to an explicit id list here and the database narrows to it,
   * which keeps the exact count and the paging correct. An empty list is a real
   * answer (nothing earned yet) and is handled without a query.
   */
  const medalIds = useMemo(() => {
    if (!f.medals.size) return null;
    const ids: string[] = [];
    for (const [id, m] of earned) if (f.medals.has(m)) ids.push(id);
    return ids;
  }, [f.medals, earned]);

  const build = useCallback(() => {
    const sb = supabaseBrowser();
    // Explicit projection: select("*") would ship the answer column for every
    // row straight to the browser, visible in the network tab.
    let query = sb
      .from("problems")
      .select("id, contest, num, statement, difficulty, tier, topics, figure_img, has_ladder", {
        count: "exact",
      });

    if (debouncedQ.trim()) {
      query = query.textSearch("statement_fts", debouncedQ.trim(), { type: "websearch" });
    }
    if (f.year.trim()) query = query.like("contest", f.year.trim() + "%");
    if (f.type) query = query.like("contest", "%" + f.type + "%");
    if (f.tiers.size) query = query.in("tier", Array.from(f.tiers));
    if (f.topics.size) query = query.overlaps("topics", Array.from(f.topics));
    if (f.hints === "with") query = query.eq("has_ladder", true);
    if (f.hints === "without") query = query.eq("has_ladder", false);
    if (medalIds) query = query.in("id", medalIds);
    if (f.dlo > 1) query = query.gte("difficulty", f.dlo);
    if (f.dhi < 10) query = query.lte("difficulty", f.dhi);

    return query.order("difficulty", { ascending: true }).order("id", { ascending: true });
  }, [debouncedQ, f.year, f.type, f.tiers, f.topics, f.hints, medalIds, f.dlo, f.dhi]);

  useEffect(() => {
    if (!restored) return;
    let cancelled = false;
    setLoading(true);
    setRows([]); // hand the space to the skeletons rather than stale results

    // A medal filter cannot be resolved until this device's progress arrives.
    // The loading state is entered FIRST and held: bailing out before it would
    // leave the previous, unfiltered rows on screen under an active filter,
    // which reads as a wrong answer rather than as a pending one. The effect
    // re-runs when medalsLoaded flips.
    if (f.medals.size && !medalsLoaded) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      // Nothing earned in the selected medals: an empty answer, not a query.
      // PostgREST would also have to be handed an empty in() list.
      if (medalIds && medalIds.length === 0) {
        setRows([]);
        setTotal(0);
        setOffset(0);
        setLoading(false);
        return;
      }
      const { data, count, error } = await build().range(0, PAGE_SIZE - 1);
      if (cancelled) return;
      if (error) console.warn("[cruxmath] browse query failed:", error.message);
      setRows((data as Problem[]) ?? []);
      setTotal(count ?? 0);
      setOffset(PAGE_SIZE);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [build, restored, medalIds, f.medals, medalsLoaded]);

  async function loadMore() {
    setLoadingMore(true);
    const { data } = await build().range(offset, offset + PAGE_SIZE - 1);
    setRows((prev) => [...prev, ...((data as Problem[]) ?? [])]);
    setOffset((o) => o + PAGE_SIZE);
    setLoadingMore(false);
  }

  // Solved markers come from this device's own progress rows.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await ensureDeviceUser();
        if (cancelled || !id) return;
        const { data } = await supabaseBrowser()
          .from("user_progress")
          .select("problem_id, medal, medal_at")
          .eq("user_id", id)
          .not("medal", "is", null);
        if (cancelled || !data) return;
        const now = Date.now();
        const painted = new Map<string, Medal>();
        const won = new Map<string, Medal>();
        for (const r of data as { problem_id: string; medal: Medal; medal_at: string }[]) {
          won.set(r.problem_id, r.medal);
          const m = activeMedal(r.medal, r.medal_at, now);
          if (m) painted.set(r.problem_id, m);
        }
        setMedals(painted);
        setEarned(won);
      } catch (e) {
        // Sign-in or the progress read can fail (anonymous auth disabled, offline).
        // Markers are cosmetic, so the library still works without them.
        console.warn("[cruxmath] progress load failed:", (e as Error).message);
      } finally {
        // Settled on EVERY path, including the failures above. A medal filter
        // waits on this flag, so leaving it false would hang the list forever.
        if (!cancelled) setMedalsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = rows.length;
  const years = useMemo(
    () => Array.from(new Set(contests.map((c) => c.slice(0, 4)))),
    [contests]
  );

  // The rail does not fit beside a 390px list, so on mobile it moves into a
  // bottom drawer and what stays on the page is this: one chip per live filter,
  // each removable where it sits. Without them a phone shows a filtered list
  // with no visible reason for the rows it is missing.
  const [drawer, setDrawer] = useState(false);
  const chips = useMemo(() => {
    const out: { key: string; label: string; clear: () => void }[] = [];
    const drop = <T,>(set: Set<T>, v: T): Set<T> => {
      const next = new Set(set);
      next.delete(v);
      return next;
    };
    if (f.year.trim())
      out.push({ key: "year", label: f.year.trim(), clear: () => patch({ year: "" }) });
    if (f.type) out.push({ key: "type", label: f.type, clear: () => patch({ type: null }) });
    for (const t of f.tiers)
      out.push({
        key: "tier:" + t,
        label: t.toUpperCase(),
        clear: () => patch({ tiers: drop(f.tiers, t) }),
      });
    if (f.hints !== "all")
      out.push({
        key: "hints",
        label: HINTS.find((h) => h.key === f.hints)?.label ?? f.hints,
        clear: () => patch({ hints: "all" }),
      });
    for (const m of f.medals)
      out.push({
        key: "medal:" + m,
        label: m.toUpperCase(),
        clear: () => patch({ medals: drop(f.medals, m) }),
      });
    for (const t of f.topics)
      out.push({
        key: "topic:" + t,
        label: t.toUpperCase(),
        clear: () => patch({ topics: drop(f.topics, t) }),
      });
    if (f.dlo > 1 || f.dhi < 10)
      out.push({
        key: "diff",
        label: f.dlo + "–" + f.dhi,
        clear: () => patch({ dlo: 1, dhi: 10 }),
      });
    return out;
    // patch only wraps setF, which React keeps stable; f is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  // Bound to the drawer panel itself, so the drag is available anywhere on it
  // rather than only on the handle. There is nothing above the drawer to
  // expand into, so it only listens downward.
  const drag = useDragToDismiss({ enabled: true, onDismiss: () => setDrawer(false) });

  // A drawer that leaves the list scrolling underneath it reads as a broken page.
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  return (
    <div className="wrap" data-drawer={drawer ? "open" : "closed"}>
      {/* Mobile only. Search stays on the page, per the handoff; everything else
          goes behind FILTERS. */}
      <div className="mbar">
        <input
          className="rsearch"
          placeholder="Search statements…"
          autoComplete="off"
          value={f.q}
          onChange={(e) => patch({ q: e.target.value })}
        />
        <div className="mchips">
          <button className="mfbtn mono" onClick={() => setDrawer(true)}>
            FILTERS{chips.length ? " · " + chips.length : ""}
          </button>
          {chips.map((c) => (
            <button
              key={c.key}
              className="mfchip mono"
              onClick={c.clear}
              aria-label={"Remove filter " + c.label}
            >
              {c.label} &#10005;
            </button>
          ))}
        </div>
      </div>

      <div className="railwrap">
        {/* Scrim, mobile only. Tapping outside the drawer closes it. */}
        <button
          className="drawer-scrim"
          aria-label="Close filters"
          onClick={() => setDrawer(false)}
        />
      <div className="rail" ref={drag}>
        <div className="drawer-head">
          <span className="sheet-grab" aria-hidden="true" />
          <div className="drawer-headrow">
            <span className="mono ltitle">FILTERS</span>
            <button className="clear mono" onClick={() => setF(freshFilters())}>
              CLEAR ALL
            </button>
          </div>
        </div>

        <input
          className="rsearch rsearch-rail"
          placeholder="Search statements…"
          autoComplete="off"
          value={f.q}
          onChange={(e) => patch({ q: e.target.value })}
        />

        <div>
          <div className="flabel">YEAR</div>
          <input
            className="cyear"
            // Derived, not hardcoded: reads "2016+" today and stays right when
            // the corpus grows backwards.
            placeholder={years.length ? years.reduce((a, b) => (a < b ? a : b)) + "+" : "Year"}
            autoComplete="off"
            inputMode="numeric"
            value={f.year}
            onChange={(e) => patch({ year: e.target.value })}
          />
          <div className="flabel" style={{ marginTop: 14 }}>
            TYPE
          </div>
          <div className="chips">
            {TYPES.map((t) => (
              <span
                key={t}
                className={"chip" + (f.type === t ? " on" : "")}
                onClick={() => patch({ type: f.type === t ? null : t })}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="flabel">
            DIFFICULTY {f.dlo > 1 || f.dhi < 10 ? "· " + f.dlo + " TO " + f.dhi : ""}
          </div>
          <div className="drange">
            <div className="track" />
            <div
              className="fill"
              style={{ left: pct(f.dlo) + "%", width: pct(f.dhi) - pct(f.dlo) + "%" }}
            />
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={f.dlo}
              onChange={(e) => patch({ dlo: Math.min(+e.target.value, f.dhi) })}
            />
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={f.dhi}
              onChange={(e) => patch({ dhi: Math.max(+e.target.value, f.dlo) })}
            />
          </div>
        </div>

        <div>
          <div className="flabel">TIER</div>
          <div className="seg">
            {allTiers.map((t) => (
              <span
                key={t}
                className={"segbtn" + (f.tiers.has(t) ? " on" : "")}
                onClick={() => patch({ tiers: toggle(f.tiers, t) })}
              >
                {t.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="flabel">HINTS</div>
          <div className="seg">
            {HINTS.map((h) => (
              <span
                key={h.key}
                className={"segbtn" + (f.hints === h.key ? " on" : "")}
                onClick={() => patch({ hints: h.key })}
              >
                {h.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="flabel">MEDAL</div>
          <div className="seg">
            {MEDAL_ORDER.map((m) => (
              <span
                key={m}
                className={"segbtn medal-btn " + m + (f.medals.has(m) ? " on" : "")}
                onClick={() => patch({ medals: toggle(f.medals, m) })}
              >
                {m.toUpperCase()}
              </span>
            ))}
          </div>
          {/* Only shown once we know it is true, so it never contradicts a list
              that is still loading. */}
          {/* Keyed to the record, not the painted map: once every medal has
              lapsed the painted map empties, and this would have claimed
              nothing was ever solved. */}
          {medalsLoaded && earned.size === 0 && (
            <div className="fnote">Nothing solved yet</div>
          )}
        </div>

        <div>
          <div className="flabel">TOPIC</div>
          <div className="chips">
            {allTopics.map((t) => (
              <span
                key={t}
                className={"chip" + (f.topics.has(t) ? " on" : "")}
                onClick={() => patch({ topics: toggle(f.topics, t) })}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <span className="clear clear-rail" onClick={() => setF(freshFilters())}>
          CLEAR ALL
        </span>
      </div>

        {/* Sticky in the drawer. The filters already applied live as they were
            tapped, so this only reports the result and dismisses. */}
        <div className="drawer-foot">
          <button className="drawer-apply mono" onClick={() => setDrawer(false)}>
            {loading
              ? "SEARCHING…"
              : "SHOW " + total + " PROBLEM" + (total === 1 ? "" : "S")}
          </button>
        </div>
      </div>

      <div className="listcol">
        <div className="listhd">
          <span className="l">
            {loading ? (
              <>
                SEARCHING {archiveTotal} STATEMENTS…
                <span className="spinner" />
              </>
            ) : (
              total + " PROBLEM" + (total === 1 ? "" : "S") + " MATCH"
            )}
          </span>
          <span className="r">
            {!loading && shown ? "SHOWING 1–" + shown + " OF " + total : ""}
          </span>
        </div>

        {loading && <SkeletonRows />}

        <div>
          {rows.map((p) => (
            <Link
              className={"row" + (medals.get(p.id) ? " medal-" + medals.get(p.id) : "")}
              key={p.id}
              href={"/problem/" + p.id}
            >
              <span className="r-c">
                {p.has_ladder && <span className="r-ladder" title="Hint ladder available" />}
                {p.contest.toUpperCase()} · {p.num}
                {medals.get(p.id) && (
                  <span
                    className={"r-medal " + medals.get(p.id)}
                    title={"Solved: " + medals.get(p.id)}
                  />
                )}
              </span>
              <span
                className="r-tex"
                dangerouslySetInnerHTML={{ __html: latexToHtml(p.statement) }}
              />
              <span className="r-top">{(p.topics ?? []).join(" · ").toUpperCase()}</span>
              <span className="r-diff">
                <span className="n">{p.difficulty ?? "?"}</span>
                <span className="bar">
                  <span style={{ width: Math.round(((p.difficulty ?? 0) / 10) * 40) + "px" }} />
                </span>
              </span>
              <span className="r-tier">{p.tier ? p.tier.toUpperCase() : ""}</span>
            </Link>
          ))}
        </div>

        {/* total still holds the previous result count while a new query runs,
            so this has to wait for loading to clear or it paints over the skeletons. */}
        {!loading && shown < total && (
          <div style={{ textAlign: "center", padding: "18px 32px" }}>
            <button className="loadmore" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}

        {!loading && (
          <div className="foot">
            {shown} of {total} shown · click any row to attempt the problem
          </div>
        )}
      </div>
    </div>
  );
}
