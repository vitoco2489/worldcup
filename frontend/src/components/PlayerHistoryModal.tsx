"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserBetHistory, UserBetHistoryItem } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import { formatLocal } from "@/lib/time";

type Props = {
  userId: string;
  userName: string;
  onClose: () => void;
};

function predictionLabel(item: UserBetHistoryItem): string {
  if (item.prediction === "home") return item.team_home;
  if (item.prediction === "away") return item.team_away;
  return "Empate";
}

function BetHistoryRow({ item, pending }: { item: UserBetHistoryItem; pending?: boolean }) {
  const scoreLine =
    item.score_home != null && item.score_away != null
      ? `${item.score_home}–${item.score_away}`
      : null;
  const predictedScore =
    item.predicted_score_home != null && item.predicted_score_away != null
      ? `${item.predicted_score_home}–${item.predicted_score_away}`
      : null;

  return (
    <li className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-100">
            {item.team_home} <span className="text-slate-500">vs</span> {item.team_away}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{formatLocal(item.start_time)}</p>
        </div>
        {!pending && item.correct != null ? (
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span
              className={
                item.correct ? "font-semibold text-emerald-400" : "font-semibold text-red-400"
              }
            >
              {item.correct ? "✓ Acierto" : "✗ Error"}
            </span>
            <span className="tabular-nums text-amber-200/90">
              +{item.points_awarded ?? 0} pts
            </span>
          </div>
        ) : (
          <span className="shrink-0 rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
            Pendiente
          </span>
        )}
      </div>
      <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Apuesta 1×2</dt>
          <dd className="text-slate-200">{predictionLabel(item)}</dd>
        </div>
        {predictedScore ? (
          <div>
            <dt className="text-slate-500">Marcador predicho</dt>
            <dd className="font-mono text-slate-200">{predictedScore}</dd>
          </div>
        ) : null}
        {scoreLine ? (
          <div>
            <dt className="text-slate-500">Resultado final</dt>
            <dd className="font-mono text-slate-200">{scoreLine}</dd>
          </div>
        ) : null}
        {!pending && item.exact_score_hit ? (
          <div>
            <dt className="text-slate-500">Bonus</dt>
            <dd className="text-sky-300">Marcador exacto +2</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

export function PlayerHistoryModal({ userId, userName, onClose }: Props) {
  const [data, setData] = useState<UserBetHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await apiFetch<UserBetHistory>(`/users/${userId}/bet-history`);
      setData(history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-history-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-600 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div>
            <h2 id="player-history-title" className="text-lg font-semibold text-white">
              {userName}
            </h2>
            <p className="text-xs text-slate-400">Historial de apuestas</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-slate-400">Cargando…</p>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : data ? (
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-slate-900/60 px-2 py-2">
                  <dt className="text-slate-500">Puntos</dt>
                  <dd className="text-lg font-bold text-primary">{data.total_points}</dd>
                </div>
                <div className="rounded-lg bg-slate-900/60 px-2 py-2">
                  <dt className="text-slate-500">Aciertos</dt>
                  <dd className="text-lg font-bold text-emerald-400">{data.correct_predictions}</dd>
                </div>
                <div className="rounded-lg bg-slate-900/60 px-2 py-2">
                  <dt className="text-slate-500">Errores</dt>
                  <dd className="text-lg font-bold text-red-400">{data.incorrect_predictions}</dd>
                </div>
                <div className="rounded-lg bg-slate-900/60 px-2 py-2">
                  <dt className="text-slate-500">Exactos</dt>
                  <dd className="text-lg font-bold text-sky-300">{data.exact_score_hits}</dd>
                </div>
              </dl>

              {data.resolved.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-300">
                    Partidos resueltos ({data.resolved.length})
                  </h3>
                  <ul className="space-y-2">
                    {data.resolved.map((item) => (
                      <BetHistoryRow key={item.bet_id} item={item} />
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="text-sm text-slate-500">Aún no hay partidos resueltos con apuesta.</p>
              )}

              {data.pending.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-300">
                    Pendientes ({data.pending.length})
                  </h3>
                  <ul className="space-y-2">
                    {data.pending.map((item) => (
                      <BetHistoryRow key={item.bet_id} item={item} pending />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
