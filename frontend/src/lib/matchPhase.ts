/** Round of 32 starts at #73; Round of 16 (octavos) at #89. */
export const ROUND_OF_32_FIRST_MATCH = 73;
export const ROUND_OF_16_FIRST_MATCH = 89;

export type ResultsPhaseFilter = "all" | "16avos" | "octavos" | "grupos";

export type MatchPhaseInfo = {
  match_number?: number | null;
  group_name?: string | null;
  round?: string | null;
};

export function isGroupStageMatch(match: MatchPhaseInfo): boolean {
  return match.group_name != null;
}

function roundImpliesOctavosOrLater(round: string | null | undefined): boolean {
  if (!round) return false;
  const r = round.toLowerCase();
  return (
    r.includes("round of 16")
    || r.includes("quarter")
    || r.includes("semi")
    || r.includes("final")
  );
}

function roundImpliesKnockout(round: string | null | undefined): boolean {
  if (!round) return false;
  const r = round.toLowerCase();
  return r.includes("round of 32") || roundImpliesOctavosOrLater(round);
}

export function isRoundOf16OrLater(match: MatchPhaseInfo): boolean {
  if (isGroupStageMatch(match)) return false;
  const n = match.match_number;
  if (n != null) return n >= ROUND_OF_16_FIRST_MATCH;
  return roundImpliesOctavosOrLater(match.round);
}

export function isRoundOf32OrLater(match: MatchPhaseInfo): boolean {
  if (isGroupStageMatch(match)) return false;
  const n = match.match_number;
  if (n != null) return n >= ROUND_OF_32_FIRST_MATCH;
  return roundImpliesKnockout(match.round);
}

export function matchPassesPhaseFilter(match: MatchPhaseInfo, phase: ResultsPhaseFilter): boolean {
  switch (phase) {
    case "all":
      return true;
    case "grupos":
      return isGroupStageMatch(match);
    case "16avos":
      return isRoundOf32OrLater(match);
    case "octavos":
      return isRoundOf16OrLater(match);
    default:
      return true;
  }
}

export const RESULTS_PHASE_OPTIONS: { value: ResultsPhaseFilter; label: string }[] = [
  { value: "octavos", label: "Octavos en adelante" },
  { value: "16avos", label: "16avos en adelante" },
  { value: "grupos", label: "Fase de grupos" },
  { value: "all", label: "Todos los partidos" },
];
