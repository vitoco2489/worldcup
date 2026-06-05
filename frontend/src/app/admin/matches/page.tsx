"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { FinishedMatchTable, Match, UserMe } from "@/lib/api";
import { apiFetch, fetchMe, getToken } from "@/lib/api";
import { useEffectiveNow } from "@/hooks/useEffectiveNow";
import { formatLocal, matchLifecycleStatus, type MatchLifecycleStatus } from "@/lib/time";
import { formatPrediction } from "@/lib/i18n";

type RowState = "idle" | "edited" | "saved" | "error";
type MatchDraft = {
  scoreHome: string;
  scoreAway: string;
  rowState: RowState;
  message: string | null;
};

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

export default function AdminMatchesPage() {
  const router = useRouter();
  const [me, setMe] = useState<UserMe | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MatchDraft>>({});
  const [finishedTables, setFinishedTables] = useState<FinishedMatchTable[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "finished">("all");
  const [loading, setLoading] = useState(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const { effectiveNowMs } = useEffectiveNow();

  const hydrateDrafts = useCallback((rows: Match[]) => {
    const next: Record<string, MatchDraft> = {};
    for (const m of rows) {
      next[m.id] = {
        scoreHome: m.score_home != null ? String(m.score_home) : "",
        scoreAway: m.score_away != null ? String(m.score_away) : "",
        rowState: "idle",
        message: null,
      };
    }
    setDrafts(next);
  }, []);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/");
      return;
    }
    const [u, rows, finished] = await Promise.all([
      fetchMe(),
      apiFetch<Match[]>("/matches"),
      apiFetch<FinishedMatchTable[]>("/admin/finished-matches-table"),
    ]);
    if (!u.is_admin) {
      router.replace("/");
      return;
    }
    setMe(u);
    setMatches(rows);
    setFinishedTables(finished);
    hydrateDrafts(rows);
  }, [hydrateDrafts, router]);

  useEffect(() => {
    void load().catch((e) => {
      toast.error(e instanceof Error ? e.message : "Error al cargar el gestor de partidos");
      router.replace("/");
    });
  }, [load, router]);

  function isValid(home: string, away: string): boolean {
    if (home.trim() === "" || away.trim() === "") return false;
    const h = Number(home);
    const a = Number(away);
    return Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0;
  }

  function onDraftChange(matchId: string, field: "scoreHome" | "scoreAway", value: string) {
    setDrafts((prev) => {
      const draft = prev[matchId] ?? { scoreHome: "", scoreAway: "", rowState: "idle", message: null };
      return {
        ...prev,
        [matchId]: { ...draft, [field]: value, rowState: "edited", message: null },
      };
    });
  }

  async function saveRow(matchId: string) {
    const d = drafts[matchId];
    if (!d || !isValid(d.scoreHome, d.scoreAway)) {
      toast.error("Ambos marcadores son obligatorios (≥ 0).");
      return;
    }
    const scoreHome = Number(d.scoreHome);
    const scoreAway = Number(d.scoreAway);
    setRowSavingId(matchId);
    try {
      await apiFetch("/admin/update-match-result", {
        method: "POST",
        body: JSON.stringify({
          match_id: matchId,
          score_home: scoreHome,
          score_away: scoreAway,
          status: "finished",
        }),
      });
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? { ...m, score_home: scoreHome, score_away: scoreAway, status: "finished" }
            : m,
        ),
      );
      setDrafts((prev) => ({
        ...prev,
        [matchId]: {
          ...prev[matchId],
          scoreHome: String(scoreHome),
          scoreAway: String(scoreAway),
          rowState: "saved",
          message: "Guardado",
        },
      }));
      toast.success("Guardado");
      const fresh = await apiFetch<FinishedMatchTable[]>("/admin/finished-matches-table");
      setFinishedTables(fresh);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar la fila";
      setDrafts((prev) => ({ ...prev, [matchId]: { ...prev[matchId], rowState: "error", message: msg } }));
      toast.error(msg);
    } finally {
      setRowSavingId(null);
    }
  }

  async function saveAll() {
    const edited = matches.map((m) => ({ match: m, d: drafts[m.id] })).filter((x) => x.d?.rowState === "edited");
    if (edited.length === 0) {
      toast.error("No hay partidos editados.");
      return;
    }
    const invalid = edited.find((x) => !x.d || !isValid(x.d.scoreHome, x.d.scoreAway));
    if (invalid) {
      toast.error("Las filas editadas deben tener marcadores válidos.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/admin/update-match-results-bulk", {
        method: "POST",
        body: JSON.stringify({
          updates: edited.map((x) => ({
            match_id: x.match.id,
            score_home: Number(x.d!.scoreHome),
            score_away: Number(x.d!.scoreAway),
            status: "finished",
          })),
        }),
      });
      const idToScores = new Map(
        edited.map((x) => [
          x.match.id,
          { h: Number(x.d!.scoreHome), a: Number(x.d!.scoreAway) },
        ]),
      );
      setMatches((prev) =>
        prev.map((m) => {
          const s = idToScores.get(m.id);
          if (!s) return m;
          return { ...m, score_home: s.h, score_away: s.a, status: "finished" };
        }),
      );
      setDrafts((prev) => {
        const next = { ...prev };
        for (const x of edited) {
          const s = idToScores.get(x.match.id)!;
          next[x.match.id] = {
            ...next[x.match.id],
            scoreHome: String(s.h),
            scoreAway: String(s.a),
            rowState: "saved",
            message: "Guardado",
          };
        }
        return next;
      });
      toast.success("Guardado");
      const fresh = await apiFetch<FinishedMatchTable[]>("/admin/finished-matches-table");
      setFinishedTables(fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar en lote");
    } finally {
      setLoading(false);
    }
  }

  function resetChanges() {
    hydrateDrafts(matches);
    toast.success("Cambios locales descartados");
  }

  const filtered = useMemo(
    () =>
      matches.filter((m) =>
        filter === "all" ? true : filter === "finished" ? m.status === "finished" : m.status !== "finished",
      ),
    [filter, matches],
  );

  if (!me) {
    return <div className="min-h-screen bg-pitch px-4 py-8 text-slate-300">Cargando…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-pitch px-4 py-8 text-white">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200">
          Inicio
        </Link>
        <span>›</span>
        <Link href="/profile" className="hover:text-slate-200">
          Perfil
        </Link>
        <span>›</span>
        <span className="text-slate-200">Gestor de partidos</span>
      </div>

      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestor de partidos</h1>
          <p className="text-sm text-slate-400">Actualiza resultados en línea para edición rápida.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "pending" | "finished")}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="finished">Finalizados</option>
          </select>
          <button
            type="button"
            onClick={resetChanges}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold"
          >
            Descartar cambios
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void saveAll()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-pitch disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar todo"}
          </button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-3 py-2">Equipos</th>
              <th className="px-3 py-2">Hora</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Local</th>
              <th className="px-3 py-2">Visitante</th>
              <th className="px-3 py-2">Fila</th>
              <th className="px-3 py-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const d = drafts[m.id] ?? { scoreHome: "", scoreAway: "", rowState: "idle", message: null };
              const valid = isValid(d.scoreHome, d.scoreAway);
              const savingRow = rowSavingId === m.id;
              const rowStatusLabel = savingRow
                ? "Guardando…"
                : d.rowState === "saved"
                  ? "Guardado"
                  : d.rowState === "error"
                    ? d.message ?? "Error"
                    : d.rowState === "edited"
                      ? "Editado"
                      : "";
              const stateClass =
                d.rowState === "saved"
                  ? "text-emerald-400"
                  : d.rowState === "error"
                    ? "text-danger"
                    : d.rowState === "edited"
                      ? "text-amber-300"
                      : "text-slate-500";
              const lifecycle: MatchLifecycleStatus = matchLifecycleStatus(
                m.start_time,
                effectiveNowMs,
                m.score_home,
                m.score_away,
              );
              const statusBadge =
                lifecycle === "finished"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : lifecycle === "in_progress"
                    ? "bg-sky-500/15 text-sky-400"
                    : lifecycle === "locked"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-slate-600/30 text-slate-300";
              const finished = lifecycle === "finished";
              return (
                <tr key={m.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <img src={flagUrl(m.team_home_code)} alt="" className="h-4 w-6 rounded-sm object-cover" />
                      <span>{m.team_home}</span>
                      <span className="text-slate-500">vs</span>
                      <span>{m.team_away}</span>
                      <img src={flagUrl(m.team_away_code)} alt="" className="h-4 w-6 rounded-sm object-cover" />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{formatLocal(m.start_time)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge}`}>
                      {lifecycle === "finished"
                        ? "Finalizado"
                        : lifecycle === "in_progress"
                          ? "En juego"
                          : lifecycle === "locked"
                            ? "Cerrado"
                            : "Programado"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={d.scoreHome}
                      onChange={(e) => onDraftChange(m.id, "scoreHome", e.target.value)}
                      disabled={finished}
                      className="w-20 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs disabled:opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={d.scoreAway}
                      onChange={(e) => onDraftChange(m.id, "scoreAway", e.target.value)}
                      disabled={finished}
                      className="w-20 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs disabled:opacity-60"
                    />
                  </td>
                  <td className={`px-3 py-2 text-xs ${stateClass}`}>{rowStatusLabel}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={!valid || savingRow || finished || loading}
                      onClick={() => void saveRow(m.id)}
                      className="rounded bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {savingRow ? "Guardando…" : "Guardar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Partidos finalizados</h2>
        {finishedTables.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay partidos finalizados.</p>
        ) : (
          <div className="space-y-4">
            {finishedTables.map((fm) => (
              <div key={fm.match_id} className="rounded-lg border border-slate-700 bg-card">
                <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                  <p className="text-sm font-semibold">
                    {fm.team_home} vs {fm.team_away}
                  </p>
                  <p className="font-mono text-sm text-primary">
                    {fm.score_home} - {fm.score_away}
                  </p>
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-400">
                      <tr>
                        <th className="px-2 py-2">Usuario</th>
                        <th className="px-2 py-2">Resultado</th>
                        <th className="px-2 py-2">Marcador</th>
                        <th className="px-2 py-2">Acierto</th>
                        <th className="px-2 py-2 text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fm.rows.map((r, idx) => {
                        const icon = r.result_indicator === "correct" ? "✅" : r.result_indicator === "incorrect" ? "❌" : "⚪";
                        const indicatorClass =
                          r.result_indicator === "correct"
                            ? "text-emerald-400"
                            : r.result_indicator === "incorrect"
                              ? "text-danger"
                              : "text-slate-400";
                        return (
                          <tr key={`${fm.match_id}-${idx}`} className="border-t border-slate-800">
                            <td className="px-2 py-1.5">{r.user_name}</td>
                            <td className="px-2 py-1.5">{formatPrediction(r.predicted_outcome)}</td>
                            <td className="px-2 py-1.5 font-mono">{r.predicted_score ?? "—"}</td>
                            <td className={`px-2 py-1.5 ${indicatorClass}`}>{icon}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{r.points_earned}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

