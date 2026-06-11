export const LOCALE = "es";

/** Zona horaria de visualización para todos los usuarios (polla en Chile). */
export const DISPLAY_TIMEZONE = "America/Santiago";

export function formatPrediction(outcome: string | null | undefined): string {
  if (!outcome) return "—";
  switch (outcome) {
    case "home":
      return "Local";
    case "away":
      return "Visitante";
    case "draw":
      return "Empate";
    default:
      return outcome;
  }
}

export function formatBetPick(
  prediction: string | null | undefined,
  teamHome: string,
  teamAway: string,
): string {
  if (!prediction) return "—";
  if (prediction === "home") return teamHome;
  if (prediction === "away") return teamAway;
  if (prediction === "draw") return "Empate";
  return prediction;
}
