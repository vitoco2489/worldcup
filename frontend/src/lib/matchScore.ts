import type { Match } from "@/lib/api";

export function isKnockoutMatch(match: Pick<Match, "group_name">): boolean {
  return match.group_name == null;
}

export function needsPenaltyInput(
  match: Pick<Match, "group_name">,
  scoreHome: string,
  scoreAway: string,
): boolean {
  if (!isKnockoutMatch(match)) return false;
  if (scoreHome.trim() === "" || scoreAway.trim() === "") return false;
  const h = Number(scoreHome);
  const a = Number(scoreAway);
  return Number.isInteger(h) && Number.isInteger(a) && h === a;
}

export function knockoutMissingPenalties(match: Match): boolean {
  return (
    isKnockoutMatch(match) &&
    match.score_home != null &&
    match.score_away != null &&
    match.score_home === match.score_away &&
    (match.penalty_score_home == null || match.penalty_score_away == null)
  );
}

export function formatMatchScore(match: Pick<Match, "score_home" | "score_away" | "penalty_score_home" | "penalty_score_away">): string {
  if (match.score_home == null || match.score_away == null) return "—";
  const base = `${match.score_home}–${match.score_away}`;
  if (
    match.penalty_score_home != null &&
    match.penalty_score_away != null &&
    match.penalty_score_home !== match.penalty_score_away
  ) {
    return `${base} (${match.penalty_score_home}–${match.penalty_score_away} pen)`;
  }
  return base;
}
