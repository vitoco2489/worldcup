"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { LeaderboardRow } from "@/lib/api";
import { apiFetch, fetchMe, getToken } from "@/lib/api";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/auth";

const TOURNAMENT_OWNER_EMAIL = "vitoco2489@gmail.com";

type AccessState =
  | { status: "checking" }
  | { status: "open" }
  | { status: "owner"; winners: LeaderboardRow[] }
  | { status: "locked"; winners: LeaderboardRow[] };

export function TournamentFinishedGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessState>({ status: "checking" });

  const checkAccess = useCallback(async () => {
    if (!getToken()) {
      setAccess({ status: "open" });
      return;
    }

    setAccess({ status: "checking" });
    try {
      const me = await fetchMe();
      const leaderboard = await apiFetch<LeaderboardRow[]>("/leaderboard");
      const winners = leaderboard.slice(0, 3);
      setAccess(
        me.email.trim().toLowerCase() === TOURNAMENT_OWNER_EMAIL
          ? { status: "owner", winners }
          : { status: "locked", winners },
      );
    } catch {
      // Dashboard/pages handle an invalid or expired session by returning to sign-in.
      setAccess({ status: "open" });
    }
  }, []);

  useEffect(() => {
    void checkAccess();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, checkAccess);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, checkAccess);
  }, [checkAccess]);

  if (access.status === "checking") {
    return <div className="min-h-screen bg-pitch" aria-busy="true" />;
  }

  if (access.status === "open") {
    return <>{children}</>;
  }

  return (
    <main
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-pitch px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-finished-title"
    >
      <section className="w-full max-w-lg rounded-3xl border border-amber-300/40 bg-slate-900 p-6 text-center shadow-[0_0_80px_rgba(251,191,36,0.18)] sm:p-8">
        <p className="text-5xl" aria-hidden="true">
          🏆
        </p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-amber-300">VitoBet · Mundial 2026</p>
        <h1 id="tournament-finished-title" className="mt-2 text-3xl font-extrabold tracking-tight text-white">
          ¡El torneo finalizó!
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Gracias por jugar. Este es el podio final de la polla.
        </p>

        {access.winners.length > 0 ? (
          <ol className="mt-6 space-y-3 text-left">
            {access.winners.map((winner, index) => {
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <li
                  key={winner.user_id}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    index === 0
                      ? "border-amber-300/50 bg-amber-300/10"
                      : "border-slate-700 bg-slate-800/70"
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {medals[index]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">{winner.name}</span>
                  <span className="text-sm font-bold tabular-nums text-amber-200">{winner.total_points} pts</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-slate-300">
            El ranking final estará disponible pronto.
          </p>
        )}

        {access.status === "owner" ? (
          <button
            type="button"
            onClick={() => setAccess({ status: "open" })}
            className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-pitch transition-colors hover:bg-primary/90"
          >
            Continuar al panel
          </button>
        ) : (
          <p className="mt-6 text-xs text-slate-500">La navegación de la aplicación está cerrada.</p>
        )}
      </section>
    </main>
  );
}
