"use client";

import { useEffect, useState } from "react";
import type { BracketView } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import { formatLocal } from "@/lib/time";
import { formatPrediction } from "@/lib/i18n";

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

function isTbdCode(code: string): boolean {
  return code.length > 3 || /^[wl]?\d/i.test(code) || code === "tbd";
}

export function BracketPanel() {
  const [data, setData] = useState<BracketView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<BracketView>("/bracket")
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Error al cargar"));
  }, []);

  if (err) {
    return <p className="text-sm text-danger">{err}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-400">Cargando cuadro…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        {data.active_round ? (
          <>
            Ronda actual: <span className="text-slate-200">{data.active_round}</span>. Al guardar todos
            los resultados de esta ronda, aparecerá la siguiente llave con los ganadores.
          </>
        ) : (
          <>Picks del grupo en cada cruce — ideal para compartir en WhatsApp.</>
        )}
      </p>

      {data.rounds.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay partidos de eliminatoria cargados.</p>
      ) : (
        <div className="space-y-8">
          {data.rounds.map((round) => (
            <section key={round.round}>
              <h2 className="mb-3 text-lg font-semibold text-primary">{round.round}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {round.matches.map((row) => {
                  const m = row.match;
                  const finished = m.score_home != null && m.score_away != null;
                  const popLabel = row.popular_prediction
                    ? formatPrediction(row.popular_prediction)
                    : null;
                  return (
                    <div key={m.id} className="rounded-xl border border-slate-700 bg-card p-4">
                      {m.round ? (
                        <p className="mb-2 text-xs text-slate-500">#{m.match_number ?? "—"}</p>
                      ) : null}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {!isTbdCode(m.team_home_code) ? (
                            <img
                              src={flagUrl(m.team_home_code)}
                              alt=""
                              className="h-5 w-7 rounded-sm object-cover"
                            />
                          ) : (
                            <span className="flex h-5 w-7 items-center justify-center rounded bg-slate-700 text-[10px]">
                              ?
                            </span>
                          )}
                          <span className="truncate font-semibold">{m.team_home}</span>
                        </div>
                        {finished ? (
                          <span className="font-bold tabular-nums">
                            {m.score_home}–{m.score_away}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">vs</span>
                        )}
                        <div className="flex min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right font-semibold">{m.team_away}</span>
                          {!isTbdCode(m.team_away_code) ? (
                            <img
                              src={flagUrl(m.team_away_code)}
                              alt=""
                              className="h-5 w-7 rounded-sm object-cover"
                            />
                          ) : (
                            <span className="flex h-5 w-7 items-center justify-center rounded bg-slate-700 text-[10px]">
                              ?
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{formatLocal(m.start_time)}</p>
                      {row.bet_count > 0 && popLabel ? (
                        <p className="mt-2 rounded-lg bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200">
                          Grupo: <span className="font-semibold text-primary">{popLabel}</span> (
                          {row.popular_pct}% · {row.bet_count} apuestas)
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">Sin apuestas del grupo aún</p>
                      )}
                      {!m.teams_resolved ? (
                        <p className="mt-1 text-xs text-amber-300/90">Equipos por definir</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
