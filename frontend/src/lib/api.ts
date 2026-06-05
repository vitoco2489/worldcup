const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "wc_pool_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type Match = {
  id: string;
  team_home: string;
  team_away: string;
  team_home_code: string;
  team_away_code: string;
  start_time: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
  round?: string | null;
  group_name?: string | null;
  ground?: string | null;
  match_number?: number | null;
  teams_resolved?: boolean;
};

export type ScheduleLoadResponse = {
  tournament: string;
  created: number;
  skipped: number;
  bracket_slots_updated: number;
  error_count: number;
  errors: string[];
};

export type Bet = {
  id: string;
  user_id: string;
  match_id: string;
  prediction: string;
  created_at: string;
  updated_at: string;
  locked: boolean;
  resolved: boolean;
  points_awarded: number | null;
  predicted_score_home: number | null;
  predicted_score_away: number | null;
  editable: boolean;
  correct: boolean | null;
  exact_score_hit: boolean | null;
};

export type PredictionCounts = {
  home: number;
  draw: number;
  away: number;
};

export type CommunityMatchRow = {
  match: Match;
  counts: PredictionCounts;
  reveal_individuals: boolean;
  individuals: Record<string, string[]> | null;
};

export type LeaderboardRow = {
  user_id: string;
  name: string;
  email: string;
  total_points: number;
  correct_bets: number;
  incorrect_bets: number;
};

export type Pool = {
  label: string;
  prize_display_usd: string;
  pool_total_usd: number;
  total_users: number;
  total_bets_placed: number;
  total_points_awarded: number;
};

export type UserMe = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  is_admin: boolean;
};

export type UserStats = {
  total_points: number;
  correct_predictions: number;
  exact_score_hits: number;
};

export type DailyDigest = {
  date: string;
  messages: string[];
};

export type BracketMatchRow = {
  match: Match;
  counts: PredictionCounts;
  popular_prediction: string | null;
  popular_pct: number;
  bet_count: number;
};

export type BracketRound = {
  round: string;
  matches: BracketMatchRow[];
};

export type BracketView = {
  rounds: BracketRound[];
};

export type WallEntry = {
  user_name: string;
  match_label: string;
  team_home_code: string;
  team_away_code: string;
  predicted_score: string | null;
  final_score: string | null;
  points_earned: number;
  detail: string;
};

export type WallHighlights = {
  fame: WallEntry[];
  shame: WallEntry[];
};

export type AllowedEmailRow = {
  email: string;
  note: string | null;
  created_at: string;
  is_admin: boolean;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
};

export type ResetSimulationResponse = {
  bets_deleted_new: number;
  bets_restored: number;
  matches_restored: number;
};

export type ResetAllDataResponse = {
  bets_deleted: number;
  matches_reset: number;
  simulation_snapshots_deleted: number;
};

export type ResetBetsResponse = {
  bets_deleted: number;
};

export type ResetMatchesResponse = {
  bets_deleted: number;
  matches_deleted: number;
  simulation_snapshots_deleted: number;
};

export type ServerTimeResponse = {
  now: string;
  is_simulated: boolean;
};

export type FinishedMatchBetRow = {
  user_name: string;
  predicted_outcome: string | null;
  predicted_score: string | null;
  result_indicator: "correct" | "incorrect" | "no_bet";
  points_earned: number;
};

export type FinishedMatchTable = {
  match_id: string;
  team_home: string;
  team_away: string;
  team_home_code: string;
  team_away_code: string;
  start_time: string;
  score_home: number;
  score_away: number;
  rows: FinishedMatchBetRow[];
};

async function handleJsonError(res: Response): Promise<never> {
  const text = await res.text();
  let msg = text || res.statusText;
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") msg = j.detail;
    else if (Array.isArray(j.detail)) msg = j.detail.map((x) => JSON.stringify(x)).join(", ");
  } catch {
    /* not JSON */
  }
  throw new Error(msg);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token && !path.startsWith("/auth/login")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) await handleJsonError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiPostMultipart<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) await handleJsonError(res);
  return res.json() as Promise<T>;
}

export async function loginWithGoogle(idToken: string) {
  const data = await apiFetch<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
  setToken(data.access_token);
  return data.access_token;
}

export async function fetchMe(): Promise<UserMe> {
  return apiFetch<UserMe>("/auth/me");
}

/** Public; no auth. Used to align countdowns with server / simulated clock. */
export async function fetchServerTime(): Promise<ServerTimeResponse> {
  const res = await fetch(`${API_BASE}/time`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<ServerTimeResponse>;
}
