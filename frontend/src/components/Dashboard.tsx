"use client";

import { GoogleLogin } from "@react-oauth/google";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bet, CommunityMatchRow, LeaderboardRow, Match, Pool, UserMe } from "@/lib/api";
import { apiFetch, fetchMe, getToken, loginWithGoogle, setToken } from "@/lib/api";
import { useEffectiveNow } from "@/hooks/useEffectiveNow";
import { defaultUpcomingDayKey, localDateKey } from "@/lib/time";
import { buildLeaderboardView, rankMarker, rowHighlightClass } from "@/lib/leaderboard";
import { CommunityBets } from "./CommunityBets";
import { MatchCard } from "./MatchCard";
import { MatchDayPicker } from "./MatchDayPicker";
import { DailyMessage } from "./DailyMessage";

export function Dashboard() {
  const { effectiveNowMs, isSimulated, resync } = useEffectiveNow();
  const [token, setTok] = useState<string | null>(null);
  const [me, setMe] = useState<UserMe | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [matchById, setMatchById] = useState<Record<string, Match>>({});
  const [recent, setRecent] = useState<Match[]>([]);
  const [upcomingNoBet, setUpcomingNoBet] = useState<Match[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [pool, setPool] = useState<Pool | null>(null);
  const [community, setCommunity] = useState<CommunityMatchRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const refreshPublic = useCallback(async () => {
    const [upcomingList, lb, p, comm] = await Promise.all([
      apiFetch<Match[]>("/matches/upcoming"),
      apiFetch<LeaderboardRow[]>("/leaderboard"),
      apiFetch<Pool>("/pool"),
      apiFetch<CommunityMatchRow[]>("/community"),
    ]);
    const map: Record<string, Match> = {};
    for (const m of upcomingList) map[m.id] = m;
    setMatchById(map);
    setRecent(upcomingList);
    setLeaderboard(lb);
    setPool(p);
    setCommunity(comm);
  }, []);

  const refreshPrivate = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUpcomingNoBet([]);
      setMyBets([]);
      return;
    }
    const [ub, bets] = await Promise.all([
      apiFetch<Match[]>("/matches/upcoming-without-bet"),
      apiFetch<Bet[]>("/bets"),
    ]);
    setUpcomingNoBet(ub);
    setMyBets(bets);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoadError(null);
    try {
      await refreshPublic();
      await refreshPrivate();
      void resync();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error al cargar");
    }
  }, [refreshPrivate, refreshPublic, resync]);

  useEffect(() => {
    setTok(getToken());
  }, []);

  useEffect(() => {
    if (!token) return;
    void refreshAll();
  }, [refreshAll, token]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setMe(null);
      return;
    }
    void fetchMe().then(setMe).catch(() => setMe(null));
  }, [token]);

  const isAdmin = me?.is_admin === true;

  const myBetCards = useMemo(() => {
    return myBets
      .map((b) => {
        const m = matchById[b.match_id];
        if (!m) return null;
        return { bet: b, match: m };
      })
      .filter(Boolean) as { bet: Bet; match: Match }[];
  }, [myBets, matchById]);

  const communityDashboard = useMemo(
    () =>
      community.filter((row) => {
        const m = row.match;
        return (
          m.score_home == null &&
          m.score_away == null &&
          new Date(m.start_time).getTime() > effectiveNowMs
        );
      }),
    [community, effectiveNowMs],
  );

  const matchDays = useMemo(() => {
    const keys = new Set<string>();
    for (const m of recent) keys.add(localDateKey(m.start_time));
    return Array.from(keys).sort();
  }, [recent]);

  useEffect(() => {
    if (matchDays.length === 0) {
      setSelectedDay(null);
      return;
    }
    if (selectedDay && matchDays.includes(selectedDay)) return;
    setSelectedDay(defaultUpcomingDayKey(matchDays, effectiveNowMs));
  }, [matchDays, selectedDay, effectiveNowMs]);

  const upcomingNoBetDay = useMemo(() => {
    if (!selectedDay) return upcomingNoBet;
    return upcomingNoBet.filter((m) => localDateKey(m.start_time) === selectedDay);
  }, [upcomingNoBet, selectedDay]);

  const myBetCardsDay = useMemo(() => {
    if (!selectedDay) return myBetCards;
    return myBetCards.filter(({ match }) => localDateKey(match.start_time) === selectedDay);
  }, [myBetCards, selectedDay]);

  const communityDay = useMemo(() => {
    if (!selectedDay) return communityDashboard;
    return communityDashboard.filter((row) => localDateKey(row.match.start_time) === selectedDay);
  }, [communityDashboard, selectedDay]);

  const dayMatchCount = useMemo(() => {
    if (!selectedDay) return recent.length;
    return recent.filter((m) => localDateKey(m.start_time) === selectedDay).length;
  }, [recent, selectedDay]);

  const leaderboardView = useMemo(() => buildLeaderboardView(leaderboard), [leaderboard]);
  const leaderId = leaderboardView.hasLeader
    ? (leaderboardView.rows.find((r) => r.displayRank === 1)?.user_id ?? "none")
    : "no-leader";

  if (!token) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">VitoBet — Mundial 2026</h1>
        <p className="mt-2 text-sm text-slate-400">Polla privada entre amigos. Solo invitados con Google pueden entrar.</p>
        <div className="mt-6">
          <GoogleLogin
            onSuccess={async (cred) => {
              if (!cred.credential) return;
              try {
                await loginWithGoogle(cred.credential);
                setTok(getToken());
              } catch (e) {
                setLoadError(e instanceof Error ? e.message : "Error al iniciar sesión con Google");
              }
            }}
            onError={() => setLoadError("Error al iniciar sesión con Google")}
            useOneTap={false}
          />
        </div>
        {loadError ? (
          <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">VitoBet — Mundial 2026</h1>
          <p className="text-sm text-slate-400">Polla privada entre amigos · horarios en hora de Chile (Santiago)</p>
          {isSimulated ? (
            <p className="mt-1 text-xs font-medium text-amber-400">Reloj simulado activo — los horarios reflejan la hora de prueba del servidor.</p>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {me ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                {me.name} ▾
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                  <div className="border-b border-slate-700 px-3 py-2">
                    <p className="truncate text-sm font-medium text-slate-100">{me.name}</p>
                    <p className="truncate text-xs text-slate-400">{me.email}</p>
                  </div>
                  <div className="flex flex-col p-1 text-sm">
                    <Link onClick={() => setMenuOpen(false)} href="/" className="rounded px-2 py-1.5 hover:bg-slate-800">
                      Inicio
                    </Link>
                    <Link onClick={() => setMenuOpen(false)} href="/matches/results" className="rounded px-2 py-1.5 hover:bg-slate-800">
                      Resultados
                    </Link>
                    <Link onClick={() => setMenuOpen(false)} href="/bracket" className="rounded px-2 py-1.5 hover:bg-slate-800">
                      Cuadro
                    </Link>
                    <Link onClick={() => setMenuOpen(false)} href="/wall" className="rounded px-2 py-1.5 hover:bg-slate-800">
                      Muro
                    </Link>
                    <Link onClick={() => setMenuOpen(false)} href="/profile" className="rounded px-2 py-1.5 hover:bg-slate-800">
                      Perfil
                    </Link>
                    {isAdmin ? (
                      <Link onClick={() => setMenuOpen(false)} href="/admin" className="rounded px-2 py-1.5 hover:bg-slate-800">
                        Admin
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="rounded px-2 py-1.5 text-left text-danger hover:bg-slate-800"
                      onClick={() => {
                        setMenuOpen(false);
                        setToken(null);
                        setTok(null);
                      }}
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <GoogleLogin
              onSuccess={async (cred) => {
                if (!cred.credential) return;
                try {
                  await loginWithGoogle(cred.credential);
                  setTok(getToken());
                } catch (e) {
                  setLoadError(e instanceof Error ? e.message : "Error al iniciar sesión con Google");
                }
              }}
              onError={() => setLoadError("Error al iniciar sesión con Google")}
              useOneTap={false}
            />
          )}
        </div>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</div>
      ) : null}

      <div className="space-y-1 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-sm text-sky-100/90">
        <p>
          ⏱ Las apuestas de cada partido se cierran{" "}
          <span className="font-semibold text-sky-50">5 minutos antes</span> del pitido inicial.
        </p>
        <p>
          ⚽ El resultado válido es el marcador al minuto{" "}
          <span className="font-semibold text-sky-50">90</span> (tiempo reglamentario — sin prórroga ni penales).
        </p>
      </div>

      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
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

          {selectedDay ? <DailyMessage dateKey={selectedDay} /> : null}
        </div>

        <div className="rounded-xl border border-slate-700 bg-card p-4">
          <h2 className="text-lg font-semibold">Ranking</h2>
          {!leaderboardView.hasLeader && leaderboardView.rows.length > 0 ? (
            <p className="mt-1 text-xs text-slate-500">Aún no hay puntos — el podio aparece cuando se resuelvan partidos.</p>
          ) : null}
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-slate-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                  <th className="px-3 py-2 text-right">Apuestas</th>
                  <th className="px-3 py-2 text-right">Aciertos</th>
                  <th className="px-3 py-2 text-right">Errores</th>
                  <th className="px-3 py-2 text-center">Cuota</th>
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
                    className={`border-t border-slate-800 transition-colors ${rowHighlightClass(row.displayRank, leaderboardView.hasLeader)}`}
                    animate={
                      leaderboardView.hasLeader && row.displayRank === 1
                        ? { scale: [1, 1.01, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.35 }}
                  >
                    <td className={`px-3 py-2 ${leaderboardView.hasLeader && row.displayRank <= 3 ? "text-white" : "text-slate-500"}`}>
                      {rankMarker(row.displayRank, leaderboardView.hasLeader)}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        leaderboardView.hasLeader && row.displayRank === 1 ? "font-bold text-amber-200" : ""
                      }`}
                    >
                      {row.total_points}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">{row.total_bets}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.correct_bets}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">{row.incorrect_bets}</td>
                    <td className="px-2 py-2 text-center">
                      {row.entry_paid ? (
                        <span className="inline-flex items-center justify-center gap-1 text-xs font-medium text-emerald-400">
                          <span aria-hidden className="text-sm leading-none">✓</span>
                          Cuota pagada
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-1 text-xs font-medium text-red-400">
                          <span aria-hidden className="text-sm leading-none">✗</span>
                          Pendiente
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
      </section>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-0 flex-1 space-y-8">
          {recent.length > 0 && selectedDay ? (
            <MatchDayPicker
              dates={matchDays}
              selected={selectedDay}
              onChange={setSelectedDay}
              matchCount={dayMatchCount}
            />
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Sin apuesta <span className="text-primary">★</span>
            </h2>
            {!token ? (
              <p className="text-sm text-slate-400">Inicia sesión para ver partidos sin apostar.</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-slate-400">
                No hay partidos próximos.{" "}
                <Link href="/matches/results" className="text-primary underline hover:text-primary/90">
                  Ver resultados
                </Link>{" "}
                para ver los marcadores.
              </p>
            ) : dayMatchCount === 0 ? (
              <p className="text-sm text-slate-400">No hay partidos este día — prueba otra fecha.</p>
            ) : upcomingNoBetDay.length === 0 ? (
              <p className="text-sm text-slate-400">Ya apostaste a todos los partidos de este día.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {upcomingNoBetDay.map((m) => (
                  <MatchCard key={m.id} match={m} effectiveNowMs={effectiveNowMs} onBetSaved={refreshAll} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Mis apuestas</h2>
            {!token ? (
              <p className="text-sm text-slate-400">Inicia sesión para ver tus apuestas.</p>
            ) : myBetCards.length === 0 ? (
              <p className="text-sm text-slate-400">
                No tienes apuestas abiertas — agrega una en{" "}
                <span className="text-slate-300">Sin apuesta</span>. Las finalizadas están en{" "}
                <Link href="/matches/results" className="text-primary underline hover:text-primary/90">
                  Resultados
                </Link>
                .
              </p>
            ) : dayMatchCount === 0 ? (
              <p className="text-sm text-slate-400">No tienes apuestas este día.</p>
            ) : myBetCardsDay.length === 0 ? (
              <p className="text-sm text-slate-400">Aún no tienes apuestas este día.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {myBetCardsDay.map(({ bet, match }) => (
                  <MatchCard
                    key={bet.id}
                    match={match}
                    effectiveNowMs={effectiveNowMs}
                    existingBet={bet}
                    onBetSaved={refreshAll}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="w-full shrink-0 space-y-3 lg:sticky lg:top-6 lg:w-80 lg:self-start">
          <div className="rounded-xl border border-slate-700 bg-card p-4">
            <p className="text-sm font-semibold text-white">🏆 Sistema de puntos</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              <li>+3 → resultado correcto (1×2)</li>
              <li>+2 → marcador exacto</li>
              <li>Máximo: 5 puntos por partido</li>
              <li className="pt-1 text-sky-200/80">Cierre de apuestas: 5 min antes del pitido</li>
              <li className="text-sky-200/80">Resultado: marcador a los 90 min (sin alargue ni penales)</li>
            </ul>
          </div>
          <h2 className="text-lg font-semibold text-white">Apuestas del grupo</h2>
          <p className="text-xs text-slate-500">
            Porcentajes antes del pitido; después se muestran los nombres por lado.
            {selectedDay && matchDays.length > 1 ? " Filtrado al día seleccionado." : null}
          </p>
          <CommunityBets rows={communityDay} />
        </aside>
      </div>

      <div className="pb-8" />
    </div>
  );
}
