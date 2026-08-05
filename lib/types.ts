import type { Medal } from "./medal";

export type Problem = {
  id: string;
  contest: string;
  num: number;
  statement: string;
  answer: string | null;
  difficulty: number | null;
  tier: string | null;
  topics: string[];
  figure_img: string | null;
  has_ladder: boolean;
};

export type Rung = { title: string; bodyHtml: string };

export type Ladder = {
  problem_id: string;
  title: string | null;
  approach: string | null;
  rungs: Rung[];
  review_html: string | null;
};

export type Progress = {
  problem_id: string;
  solved: boolean;
  hints_revealed: number;
  attempts: number;
  aops_viewed: boolean;
  solved_at: string | null;
  /** Best medal earned so far. Survives a reset; lapses on its own timer. */
  medal: Medal | null;
  medal_at: string | null;
};

export type SearchRow = Problem & { total_count: number };
