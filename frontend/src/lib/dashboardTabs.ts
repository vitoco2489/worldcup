export const DASHBOARD_TABS = [
  { id: "apuestas", label: "Apuestas" },
  { id: "ranking", label: "Ranking" },
  { id: "resultados", label: "Resultados" },
  { id: "grupos", label: "Grupos" },
  { id: "cuadro", label: "Cuadro" },
  { id: "muro", label: "Muro" },
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number]["id"];

const TAB_IDS = new Set<string>(DASHBOARD_TABS.map((t) => t.id));

export function parseDashboardTab(raw: string | null): DashboardTab {
  if (raw && TAB_IDS.has(raw)) return raw as DashboardTab;
  return "apuestas";
}
