import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import SolveClient from "@/components/SolveClient";
import { supabaseServer } from "@/lib/supabase/server";
import type { Problem, Ladder } from "@/lib/types";

// Content changes only when the seed script runs, so cache pages and refresh
// them in the background rather than hitting Postgres on every request.
export const revalidate = 3600;

// generateMetadata and the page body both need this. Without cache() that is two
// identical round trips per request; React dedupes them within one render pass.
const load = cache(async (id: string) => {
  const sb = supabaseServer();
  const [{ data: problem }, { data: ladder }] = await Promise.all([
    sb.from("problems").select("*").eq("id", id).maybeSingle(),
    sb.from("ladders").select("*").eq("problem_id", id).maybeSingle(),
  ]);
  return { problem: problem as Problem | null, ladder: ladder as Ladder | null };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { problem } = await load(id);
  if (!problem) return { title: "Problem not found" };
  return {
    title: `${problem.contest} Problem ${problem.num}`,
    description: problem.statement.slice(0, 155),
  };
}

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { problem, ladder } = await load(id);
  if (!problem) notFound();

  return (
    <>
      <Header />
      <SolveClient problem={problem} ladder={ladder} />
    </>
  );
}
