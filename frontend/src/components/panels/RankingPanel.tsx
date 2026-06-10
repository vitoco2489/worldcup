"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { LeaderboardRow, Pool } from "@/lib/api";
import { buildLeaderboardView, rankMarker, rowHighlightClass } from "@/lib/leaderboard";

type Props = {
  pool: Pool | null;
  leaderboard: LeaderboardRow[];
  onPlayerClick: (player: { id: string; name: string }) => void;
};

export function RankingPanel({ pool, leaderboard, onPlayerClick }: Props) {
  const leaderboardView = buildLeaderboardView(leaderboard);
  const showHitColumns = leaderboardView.rows.length > 0;
  const leaderId = leaderboardView.hasLeader
    ? (leaderboardView.rows.find((r) => r.displayRank === 1)?.user_id ?? "none")
    : "no-leader";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-card p-3">
        <h2 className="text-sm font-semibold text-slate-400">Premio</h2>
        {pool ? (
          <>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-2xl font-extrabold text-white">{pool.prize_display_usd}</p>
              <p className="text-sm font-medium text-primary">{pool.label}</p>
            </div>
            {pool.pool_total_usd > 0 ? (
              <p className="mt-0.5 text-xs text-slate-500">
                Pozo total: {pool.pool_total_usd.toLocaleString("es")} USD
              </p>
            ) : null}
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <div className="flex items-baseline gap-1.5">
                <dt className="text-slate-500">Jugadores</dt>
                <dd className="font-semibold text-slate-200">{pool.total_users}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-slate-500">Apuestas</dt>
                <dd className="font-semibold text-slate-200">{pool.total_bets_placed}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-slate-500">Puntos</dt>
                <dd className="font-semibold text-slate-200">{pool.total_points_awarded}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Cargando…</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-card p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Ranking</h2>
          {leaderboardView.rows.length > 0 ? (
            <span className="text-[11px] text-slate-500">{leaderboardView.rows.length} jugadores</span>
          ) : null}
        </div>
        {!leaderboardView.hasLeader && leaderboardView.rows.length > 0 ? (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Sin puntos aún — podio cuando se resuelvan partidos.
          </p>
        ) : null}
        <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-slate-800 sm:max-h-[32rem]">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900/95 text-[11px] text-slate-400 backdrop-blur-sm">
              <tr>
                <th className="whitespace-nowrap px-2 py-1.5">#</th>
                <th className="whitespace-nowrap px-2 py-1.5">Nombre</th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right">Puntos</th>
                <th className="whitespace-nowrap px-2 py-1.5 text-right">Apuestas</th>
                {showHitColumns ? (
                  <>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right">Aciertos</th>
                    <th className="whitespace-nowrap px-2 py-1.5 text-right">Errores</th>
                  </>
                ) : null}
                <th className="whitespace-nowrap px-2 py-1.5 text-center">Cuota</th>
              </tr>
            </thead>
            <AnimatePresence mode="wait">
              <motion.tbody
                key={leaderId}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                {leaderboardView.rows.map((row) => (
                  <motion.tr
                    layout
                    key={row.user_id}
                    className={`border-t border-slate-800/80 transition-colors ${rowHighlightClass(row.displayRank, leaderboardView.hasLeader)}`}
                    animate={
                      leaderboardView.hasLeader && row.displayRank === 1
                        ? { scale: [1, 1.005, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.35 }}
                  >
                    <td
                      className={`whitespace-nowrap px-1.5 py-1 ${leaderboardView.hasLeader && row.displayRank <= 3 ? "text-white" : "text-slate-500"}`}
                    >
                      {rankMarker(row.displayRank, leaderboardView.hasLeader)}
                    </td>
                    <td className="max-w-[8rem] truncate px-1.5 py-1 font-medium sm:max-w-none">
                      <button
                        type="button"
                        onClick={() => onPlayerClick({ id: row.user_id, name: row.name })}
                        className="truncate text-left text-primary hover:underline"
                        title={`Ver historial de ${row.name}`}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td
                      className={`whitespace-nowrap px-1.5 py-1 text-right tabular-nums ${
                        leaderboardView.hasLeader && row.displayRank === 1 ? "font-bold text-amber-200" : ""
                      }`}
                    >
                      {row.total_points}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums text-slate-300">
                      {row.total_bets}
                    </td>
                    {showHitColumns ? (
                      <>
                        <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums text-emerald-400/90">
                          {row.correct_bets}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums text-red-400/90">
                          {row.incorrect_bets}
                        </td>
                      </>
                    ) : null}
                    <td className="whitespace-nowrap px-1.5 py-1 text-center">
                      {row.entry_paid ? (
                        <span className="text-emerald-400" title="Cuota pagada" aria-label="Cuota pagada">
                          ✓
                        </span>
                      ) : (
                        <span className="text-red-400" title="Cuota pendiente" aria-label="Cuota pendiente">
                          ✗
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </AnimatePresence>
          </table>
        </div>
      </div>
    </div>
  );
}
