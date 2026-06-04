import type { LeaderboardRow } from "@/lib/api";

export type RankedLeaderboardRow = LeaderboardRow & {
  displayRank: number;
};

export type LeaderboardView = {
  rows: RankedLeaderboardRow[];
  /** True when someone has scored at least 1 point. */
  hasLeader: boolean;
};

export function buildLeaderboardView(rows: LeaderboardRow[]): LeaderboardView {
  const maxPoints = rows.reduce((m, r) => Math.max(m, r.total_points), 0);
  const hasLeader = maxPoints > 0;

  let displayRank = 0;
  let prevPoints: number | null = null;

  const ranked: RankedLeaderboardRow[] = rows.map((row, i) => {
    if (prevPoints === null || row.total_points !== prevPoints) {
      displayRank = i + 1;
    }
    prevPoints = row.total_points;
    return { ...row, displayRank };
  });

  return { rows: ranked, hasLeader };
}

export function rankMarker(displayRank: number, hasLeader: boolean): string {
  if (!hasLeader) return "—";
  if (displayRank === 1) return "⭐🥇";
  if (displayRank === 2) return "🥈";
  if (displayRank === 3) return "🥉";
  return String(displayRank);
}

export function rowHighlightClass(displayRank: number, hasLeader: boolean): string {
  if (!hasLeader) return "";
  if (displayRank === 1) return "bg-amber-400/10 ring-1 ring-inset ring-amber-300/35";
  if (displayRank === 2) return "bg-slate-100/5";
  if (displayRank === 3) return "bg-amber-900/10";
  return "";
}
