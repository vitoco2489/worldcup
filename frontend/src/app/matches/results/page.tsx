"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { FinishedMatchTable } from "@/lib/api";
import { apiFetch, getToken } from "@/lib/api";
import { formatLocal, localDateKey } from "@/lib/time";
import { formatPrediction } from "@/lib/i18n";

type FlatRow = {
  match_id: string;
  match_label: string;
  match_key: string;
  team_home_code: string;
  team_away_code: string;
  start_time: string;
  /** "h - a" or em dash when scores missing */
  final_score: string;
  user_name: string;
  predicted_outcome: string | null;
  predicted_score: string | null;
  result_indicator: "correct" | "incorrect" | "no_bet";
  points_earned: number;
};

export default function MatchResultsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FinishedMatchTable[]>([]);
  const [userFilter, setUserFilter] = useState("all");
  const [matchFilter, setMatchFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void apiFetch<FinishedMatchTable[]>("/matches/results-table")
      .then((data) => {
        setRows(data);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar resultados"))
      .finally(() => setLoading(false));
  }, [router]);

  const hasRows = useMemo(() => rows.length > 0, [rows]);
  const flatRows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    for (const m of rows) {
      for (const r of m.rows) {
        const finalScore =
          m.score_home != null && m.score_away != null ? `${m.score_home} - ${m.score_away}` : "—";
        out.push({
          match_id: m.match_id,
          match_label: `${m.team_home} vs ${m.team_away}`,
          match_key: `${m.team_home} vs ${m.team_away} · ${m.score_home}-${m.score_away}`,
          team_home_code: m.team_home_code,
          team_away_code: m.team_away_code,
          start_time: m.start_time,
          final_score: finalScore,
          user_name: r.user_name,
          predicted_outcome: r.predicted_outcome,
          predicted_score: r.predicted_score,
          result_indicator: r.result_indicator,
          points_earned: r.points_earned,
        });
      }
    }
    return out;
  }, [rows]);

  const uniqueUsers = useMemo(
    () => Array.from(new Set(flatRows.map((r) => r.user_name))).sort((a, b) => a.localeCompare(b)),
    [flatRows],
  );
  const uniqueMatches = useMemo(
    () => Array.from(new Set(flatRows.map((r) => `${r.match_id}::${r.match_key}`))),
    [flatRows],
  );
  const filteredRows = useMemo(() => {
    return flatRows.filter((r) => {
      if (userFilter !== "all" && r.user_name !== userFilter) return false;
      if (matchFilter !== "all" && r.match_id !== matchFilter) return false;
      if (dateFilter) {
        if (localDateKey(r.start_time) !== dateFilter) return false;
      }
      return true;
    });
  }, [flatRows, userFilter, matchFilter, dateFilter]);

  if (loading) {
    return <div className="min-h-screen bg-pitch px-4 py-8 text-slate-300">Cargando resultados…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-pitch px-4 py-8 text-white">
      <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200">
          Inicio
        </Link>
        <span>›</span>
        <span className="text-slate-200">Resultados</span>
      </div>

      <header className="mb-5">
        <h1 className="text-2xl font-bold">Resultados</h1>
        <p className="text-sm text-slate-400">Tabla de resultados por partido y jugador.</p>
      </header>

      {!hasRows ? (
        <p className="text-sm text-slate-400">Aún no hay partidos finalizados.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-card p-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Usuario
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="all">Todos</option>
                {uniqueUsers.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Partido
              <select
                value={matchFilter}
                onChange={(e) => setMatchFilter(e.target.value)}
                className="max-w-xs rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="all">Todos</option>
                {uniqueMatches.map((m) => {
                  const [id, label] = m.split("::");
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Fecha
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setUserFilter("all");
                setMatchFilter("all");
                setDateFilter("");
              }}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
            >
              Limpiar
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-700 bg-card">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-2 py-2">Partido</th>
                  <th className="px-2 py-2">Usuario</th>
                  <th className="px-2 py-2">Predicción</th>
                  <th className="px-2 py-2">Marcador predicho</th>
                  <th className="px-2 py-2">Marcador final</th>
                  <th className="px-2 py-2">Resultado</th>
                  <th className="px-2 py-2 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, idx) => {
                  const icon = r.result_indicator === "correct" ? "✅" : r.result_indicator === "incorrect" ? "❌" : "⚪";
                  const indicatorClass =
                    r.result_indicator === "correct"
                      ? "text-emerald-400"
                      : r.result_indicator === "incorrect"
                        ? "text-danger"
                        : "text-slate-400";
                  return (
                    <tr key={`${r.match_id}-${r.user_name}-${idx}`} className="border-t border-slate-800">
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <img src={flagUrl(r.team_home_code)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                          <span className="whitespace-nowrap">{r.match_label}</span>
                          <img src={flagUrl(r.team_away_code)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                          <span className="font-mono text-primary">· {formatLocal(r.start_time)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">{r.user_name}</td>
                      <td className="px-2 py-1.5">{formatPrediction(r.predicted_outcome)}</td>
                      <td className="px-2 py-1.5 font-mono">{r.predicted_score ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono tabular-nums text-slate-200">{r.final_score}</td>
                      <td className={`px-2 py-1.5 ${indicatorClass}`}>{icon}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.points_earned}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

