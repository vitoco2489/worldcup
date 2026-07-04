"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Bet, CommunityMatchRow, LeaderboardRow, Match, Pool, UserMe } from "@/lib/api";
import { AUTH_LOGOUT_EVENT, clearAuthSession } from "@/lib/auth";
import { apiFetch, fetchMe, getToken, loginWithGoogle } from "@/lib/api";
import { GoogleSignIn } from "./GoogleSignIn";
import { useEffectiveNow } from "@/hooks/useEffectiveNow";
import { DASHBOARD_TABS, type DashboardTab, parseDashboardTab } from "@/lib/dashboardTabs";
import { defaultUpcomingDayKey, isWithinBetUrgentWindow, localDateKey, matchLifecycleStatus } from "@/lib/time";
import { BracketPanel } from "./panels/BracketPanel";
import { GroupsPanel } from "./panels/GroupsPanel";
import { RankingPanel } from "./panels/RankingPanel";
import { ResultsPanel } from "./panels/ResultsPanel";
import { WallPanel } from "./panels/WallPanel";
import { CommunityBets } from "./CommunityBets";
import { MatchCard } from "./MatchCard";
import { MatchDayPicker } from "./MatchDayPicker";
import { DailyMessage } from "./DailyMessage";
import { PlayerHistoryModal } from "./PlayerHistoryModal";
import { UrgentBetAlert } from "./UrgentBetAlert";

export function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseDashboardTab(searchParams.get("tab"));
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
  const [historyPlayer, setHistoryPlayer] = useState<{ id: string; name: string } | null>(null);
  const [urgentBannerDismissed, setUrgentBannerDismissed] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const urgentToastShown = useRef(false);

  const logout = useCallback(() => {
    clearAuthSession();
    setTok(null);
    setMe(null);
    setMenuOpen(false);
    setSessionReady(true);
  }, []);

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
    setMatchById((prev) => {
      const next = { ...prev };
      for (const b of bets) {
        if (b.match) next[b.match.id] = b.match;
      }
      return next;
    });
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
    const onLogout = () => {
      setTok(null);
      setMe(null);
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  useEffect(() => {
    if (!token) urgentToastShown.current = false;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void refreshAll();
  }, [refreshAll, token]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setMe(null);
      setSessionReady(true);
      return;
    }
    setSessionReady(false);
    void fetchMe()
      .then((user) => {
        setMe(user);
        setLoadError(null);
      })
      .catch((e) => {
        clearAuthSession();
        setTok(null);
        setMe(null);
        setLoadError(
          e instanceof Error
            ? e.message
            : "Sesión inválida. Inicia sesión con tu correo autorizado.",
        );
      })
      .finally(() => setSessionReady(true));
  }, [token]);

  const isAdmin = me?.is_admin === true;

  const myBetCards = useMemo(() => {
    return myBets
      .map((b) => {
        const m = b.match ?? matchById[b.match_id];
        if (!m) return null;
        return { bet: b, match: m };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a!.match.start_time).getTime() - new Date(b!.match.start_time).getTime()) as {
      bet: Bet;
      match: Match;
    }[];
  }, [myBets, matchById]);

  const communityDashboard = useMemo(
    () =>
      community.filter((row) => {
        const m = row.match;
        return m.score_home == null && m.score_away == null;
      }),
    [community],
  );

  const matchDays = useMemo(() => {
    const keys = new Set<string>();
    for (const m of recent) keys.add(localDateKey(m.start_time));
    for (const b of myBets) {
      const m = b.match ?? matchById[b.match_id];
      if (m) keys.add(localDateKey(m.start_time));
    }
    return Array.from(keys).sort();
  }, [recent, myBets, matchById]);

  useEffect(() => {
    if (matchDays.length === 0) {
      setSelectedDay(null);
      return;
    }
    if (selectedDay && matchDays.includes(selectedDay)) return;
    setSelectedDay(defaultUpcomingDayKey(matchDays, effectiveNowMs));
  }, [matchDays, selectedDay, effectiveNowMs]);

  const upcomingNoBetDay = useMemo(() => {
    const list = !selectedDay
      ? upcomingNoBet
      : upcomingNoBet.filter((m) => localDateKey(m.start_time) === selectedDay);
    return [...list].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
  }, [upcomingNoBet, selectedDay]);

  const urgentUnbet = useMemo(
    () =>
      [...upcomingNoBet]
        .filter((m) => isWithinBetUrgentWindow(m.start_time, effectiveNowMs))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [upcomingNoBet, effectiveNowMs],
  );

  const urgentKey = urgentUnbet.map((m) => m.id).join(",");

  useEffect(() => {
    setUrgentBannerDismissed(false);
  }, [urgentKey]);

  useEffect(() => {
    if (!token || urgentUnbet.length === 0 || urgentToastShown.current) return;
    urgentToastShown.current = true;
    toast.warning(
      urgentUnbet.length === 1
        ? "Tienes 1 partido sin apostar que empieza en menos de 2 horas"
        : `Tienes ${urgentUnbet.length} partidos sin apostar que empiezan en menos de 2 horas`,
      { duration: 9000 },
    );
  }, [token, urgentUnbet.length, urgentKey]);

  const myBetCardsDay = useMemo(() => {
    if (!selectedDay) return myBetCards;
    return myBetCards.filter(({ match }) => localDateKey(match.start_time) === selectedDay);
  }, [myBetCards, selectedDay]);

  const communityDay = useMemo(() => {
    if (!selectedDay) return communityDashboard;
    return communityDashboard.filter((row) => localDateKey(row.match.start_time) === selectedDay);
  }, [communityDashboard, selectedDay]);

  const communityInProgress = useMemo(
    () =>
      communityDashboard.filter((row) => {
        const m = row.match;
        return matchLifecycleStatus(m.start_time, effectiveNowMs, m.score_home, m.score_away) === "in_progress";
      }),
    [communityDashboard, effectiveNowMs],
  );

  const dayMatchCount = useMemo(() => {
    if (!selectedDay) return recent.length + myBetCards.filter(({ match }) => !recent.some((m) => m.id === match.id)).length;
    const ids = new Set<string>();
    for (const m of recent) {
      if (localDateKey(m.start_time) === selectedDay) ids.add(m.id);
    }
    for (const { match } of myBetCards) {
      if (localDateKey(match.start_time) === selectedDay) ids.add(match.id);
    }
    return ids.size;
  }, [recent, myBetCards, selectedDay]);

  const setActiveTab = useCallback(
    (tab: DashboardTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "apuestas") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (!sessionReady) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-8 text-sm text-slate-400">
        Verificando sesión…
      </div>
    );
  }

  if (!token || !me) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">VitoBet — Mundial 2026</h1>
        <p className="mt-2 text-sm text-slate-400">Polla privada entre amigos. Solo invitados con Google pueden entrar.</p>
        <div className="mt-6">
          <GoogleSignIn
            onSuccess={async (idToken) => {
              try {
                setLoadError(null);
                await loginWithGoogle(idToken);
                setTok(getToken());
              } catch (e) {
                clearAuthSession();
                setTok(null);
                setLoadError(e instanceof Error ? e.message : "Error al iniciar sesión con Google");
              }
            }}
            onError={() => setLoadError("Error al iniciar sesión con Google")}
          />
        </div>
        {loadError ? (
          <div className="mt-4 max-w-md rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {loadError}
          </div>
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
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setActiveTab("apuestas");
                      }}
                      className="rounded px-2 py-1.5 text-left hover:bg-slate-800"
                    >
                      Inicio
                    </button>
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
                      className="rounded px-2 py-1.5 text-left hover:bg-slate-800"
                      onClick={() => {
                        logout();
                      }}
                    >
                      Cambiar cuenta
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1.5 text-left text-danger hover:bg-slate-800"
                      onClick={() => {
                        logout();
                      }}
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</div>
      ) : null}

      {token && urgentUnbet.length > 0 && !urgentBannerDismissed ? (
        <UrgentBetAlert
          matches={urgentUnbet}
          nowMs={effectiveNowMs}
          onDismiss={() => setUrgentBannerDismissed(true)}
        />
      ) : null}

      <div className="space-y-1 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-sm text-sky-100/90">
        <p>
          ⏱ Las apuestas de cada partido se cierran{" "}
          <span className="font-semibold text-sky-50">5 minutos antes</span> del pitido inicial.
        </p>
        <p>
          ⚽ <span className="font-semibold text-sky-50">Fase de grupos:</span> resultado válido al minuto{" "}
          <span className="font-semibold text-sky-50">90</span> (tiempo reglamentario — sin prórroga ni penales).
        </p>
        <p>
          ⚽ <span className="font-semibold text-sky-50">Desde 16avos en adelante:</span> se considera el marcador a los{" "}
          <span className="font-semibold text-sky-50">120 minutos</span> (incluye alargue si hay empate en el 90).
          Los penales no cuentan para puntos.
        </p>
      </div>

      <nav
        className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-slate-700 bg-card p-1"
        aria-label="Secciones"
      >
        {DASHBOARD_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary/20 text-primary"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "apuestas" ? (
        <>
          {pool ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-700/80 bg-card px-3 py-2 text-xs text-slate-400">
              <span className="font-semibold text-white">{pool.prize_display_usd}</span>
              <span className="text-primary">{pool.label}</span>
              <span>·</span>
              <span>{pool.total_users} jugadores</span>
              <span>·</span>
              <span>{pool.total_bets_placed} apuestas</span>
            </div>
          ) : null}

          {selectedDay ? <DailyMessage dateKey={selectedDay} /> : null}

          {communityInProgress.length > 0 ? (
            <section className="space-y-3 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 shadow-[0_0_30px_rgba(14,165,233,0.08)]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">En vivo</p>
                  <h2 className="text-xl font-bold text-white">Apuestas en curso</h2>
                </div>
                <p className="max-w-xl text-sm text-slate-300">
                  Solo partidos que ya empezaron y aún no tienen resultado cargado. Los nombres se revelan por lado.
                </p>
              </div>
              <CommunityBets rows={communityInProgress} variant="live" />
            </section>
          ) : null}

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

              <section id="sin-apuesta" className="space-y-3 scroll-mt-24">
                <h2 className="text-lg font-semibold text-white">
                  Sin apuesta <span className="text-primary">★</span>
                </h2>
                {!token ? (
                  <p className="text-sm text-slate-400">Inicia sesión para ver partidos sin apostar.</p>
                ) : recent.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No hay partidos próximos.{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("resultados")}
                      className="text-primary underline hover:text-primary/90"
                    >
                      Ver resultados
                    </button>{" "}
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
                    No tienes apuestas — agrega una en{" "}
                    <span className="text-slate-300">Sin apuesta</span>.
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
                  <li className="text-sky-200/80">Grupos: marcador al 90&apos; (sin alargue ni penales)</li>
                  <li className="text-sky-200/80">16avos en adelante: marcador a los 120&apos;; penales no cuentan</li>
                </ul>
              </div>
              {communityInProgress.length === 0 ? (
                <>
                  <h2 className="text-lg font-semibold text-white">Apuestas del grupo</h2>
                  <p className="text-xs text-slate-500">
                    Porcentajes antes del pitido; después se muestran los nombres por lado.
                    {selectedDay && matchDays.length > 1 ? " Filtrado al día seleccionado." : null}
                  </p>
                  <CommunityBets rows={communityDay} />
                </>
              ) : null}
            </aside>
          </div>
        </>
      ) : null}

      {activeTab === "ranking" ? (
        <RankingPanel
          pool={pool}
          leaderboard={leaderboard}
          onPlayerClick={setHistoryPlayer}
        />
      ) : null}

      {activeTab === "resultados" ? <ResultsPanel /> : null}
      {activeTab === "grupos" ? <GroupsPanel /> : null}
      {activeTab === "cuadro" ? <BracketPanel /> : null}
      {activeTab === "muro" ? <WallPanel /> : null}

      <div className="pb-8" />

      {historyPlayer ? (
        <PlayerHistoryModal
          userId={historyPlayer.id}
          userName={historyPlayer.name}
          onClose={() => setHistoryPlayer(null)}
        />
      ) : null}
    </div>
  );
}
