import type { Bet } from "@/lib/api";
import { formatBetPick } from "@/lib/i18n";

export function betPickLabel(
  bet: Pick<Bet, "prediction">,
  teamHome: string,
  teamAway: string,
): string {
  return formatBetPick(bet.prediction, teamHome, teamAway);
}

export function betResultBadge(
  bet: Pick<Bet, "resolved" | "correct" | "exact_score_hit" | "points_awarded">,
): { text: string; className: string } | null {
  if (!bet.resolved) return null;
  const pts = bet.points_awarded ?? 0;
  if (bet.correct && bet.exact_score_hit) {
    return {
      text: `✅ ${pts} pts · marcador exacto`,
      className: "bg-emerald-500/15 text-emerald-300",
    };
  }
  if (bet.correct) {
    return {
      text: `✅ ${pts} pts · acierto`,
      className: "bg-emerald-500/15 text-emerald-300",
    };
  }
  return {
    text: "❌ 0 pts · fallaste",
    className: "bg-red-500/10 text-red-300",
  };
}
