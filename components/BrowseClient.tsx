"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { latexToHtml } from "@/lib/latex";
import { supabaseBrowser, ensureDeviceUser } from "@/lib/supabase/client";
import { activeMedal, type Medal } from "@/lib/medal";
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
  const [medals, setMedals] = useState<Map<string, Medal>>(new Map());

  // Debounce typing so each keystroke does not fire a query.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(f.q), 220);
    return () => clearTimeout(t);
  }, [f.q]);

  const patch = (p: Partial<Filters>) => setF((prev) => ({ ...prev, ...p }));

  const toggle = (set: Set<string>, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const build = useCallback(() => {
    const sb = supabaseBrowser();
    let query = sb.from("problems").select("*", { count: "exact" });

    if (debouncedQ.trim()) {
      query = query.textSearch("statement_fts", debouncedQ.trim(), { type: "websearch" });
    }
    if (f.year.trim()) query = query.like("contest", f.year.trim() + "%");
    if (f.type) query = query.like("contest", "%" + f.type + "%");
    if (f.tiers.size) query = query.in("tier", Array.from(f.tiers));
    if (f.topics.size) query = query.overlaps("topics", Array.from(f.topics));
    if (f.hints === "with") query = query.eq("has_ladder", true);
    if (f.hints === "without") query = query.eq("has_ladder", false);
    if (f.dlo > 1) query = query.gte("difficulty", f.dlo);
    if (f.dhi < 10) query = query.lte("difficulty", f.dhi);

    return query.order("difficulty", { ascending: true }).order("id", { ascending: true });
  }, [debouncedQ, f.year, f.type, f.tiers, f.topics, f.hints, f.dlo, f.dhi]);

  useEffect(() => {
    if (!restored) return;
    let cancelled = false;
    setLoading(true);
    setRows([]); // hand the space to the skeletons rather than stale results
    (async () => {
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
  }, [build, restored]);

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
      const id = await ensureDeviceUser();
      if (!id || cancelled) return;
      const { data } = await supabaseBrowser()
        .from("user_progress")
        .select("problem_id, medal, medal_at")
        .eq("user_id", id)
        .not("medal", "is", null);
      if (cancelled || !data) return;
      const now = Date.now();
      const next = new Map<string, Medal>();
      for (const r of data as { problem_id: string; medal: Medal; medal_at: string }[]) {
        const m = activeMedal(r.medal, r.medal_at, now);
        if (m) next.set(r.problem_id, m);
      }
      setMedals(next);
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

  return (
    <div className="wrap">
      <div className="rail">
        <input
          className="rsearch"
          placeholder="Search statements…"
          autoComplete="off"
          value={f.q}
          onChange={(e) => patch({ q: e.target.value })}
        />

        <div>
          <div className="flabel">CONTEST</div>
          <input
            className="cyear"
            placeholder={"Year (any of " + years.length + ")"}
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

        <span className="clear" onClick={() => setF(freshFilters())}>
          CLEAR ALL
        </span>
      </div>

      <div>
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
