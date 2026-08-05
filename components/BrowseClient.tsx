"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { latexToHtml } from "@/lib/latex";
import { supabaseBrowser, ensureDeviceUser } from "@/lib/supabase/client";
import type { Problem } from "@/lib/types";

const PAGE_SIZE = 30;
const TYPES = ["AMC 10", "AMC 12", "AIME"];
const HINTS = [
  { key: "all", label: "ANY" },
  { key: "with", label: "WITH LADDER" },
  { key: "without", label: "NO LADDER" },
] as const;

type Hints = (typeof HINTS)[number]["key"];

type Filters = {
  q: string;
  year: string;
  type: string | null;
  tiers: Set<string>;
  topics: Set<string>;
  hints: Hints;
  dlo: number;
  dhi: number;
};

const fresh = (): Filters => ({
  q: "",
  year: "",
  type: null,
  tiers: new Set<string>(),
  topics: new Set<string>(),
  hints: "all",
  dlo: 1,
  dhi: 10,
});

const pct = (v: number) => ((v - 1) / 9) * 100;

export default function BrowseClient({
  contests,
  topics: allTopics,
  tiers: allTiers,
}: {
  contests: string[];
  topics: string[];
  tiers: string[];
}) {
  const [f, setF] = useState<Filters>(fresh);
  const [rows, setRows] = useState<Problem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

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
    let cancelled = false;
    setLoading(true);
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
  }, [build]);

  async function loadMore() {
    setLoading(true);
    const { data } = await build().range(offset, offset + PAGE_SIZE - 1);
    setRows((prev) => [...prev, ...((data as Problem[]) ?? [])]);
    setOffset((o) => o + PAGE_SIZE);
    setLoading(false);
  }

  // Solved markers come from this device's own progress rows.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await ensureDeviceUser();
      if (!id || cancelled) return;
      const { data } = await supabaseBrowser()
        .from("user_progress")
        .select("problem_id")
        .eq("user_id", id)
        .eq("solved", true);
      if (cancelled || !data) return;
      setSolvedIds(new Set(data.map((r: { problem_id: string }) => r.problem_id)));
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

        <span className="clear" onClick={() => setF(fresh())}>
          CLEAR ALL
        </span>
      </div>

      <div>
        <div className="listhd">
          <span className="l">
            {loading && !shown
              ? "SEARCHING…"
              : total + " PROBLEM" + (total === 1 ? "" : "S") + " MATCH"}
          </span>
          <span className="r">{shown ? "SHOWING 1–" + shown + " OF " + total : ""}</span>
        </div>

        <div>
          {rows.map((p) => (
            <Link className="row" key={p.id} href={"/problem/" + p.id}>
              <span className="r-c">
                {p.has_ladder && <span className="r-ladder" title="Hint ladder available" />}
                {p.contest.toUpperCase()} · {p.num}
                {solvedIds.has(p.id) && <span className="r-solved" title="Solved" />}
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

        {shown < total && (
          <div style={{ textAlign: "center", padding: "18px 32px" }}>
            <button className="loadmore" onClick={loadMore} disabled={loading}>
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}

        <div className="foot">
          {shown} of {total} shown · click any row to open it in Solve
        </div>
      </div>
    </div>
  );
}
