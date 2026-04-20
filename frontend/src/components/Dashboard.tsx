"use client";

import { GoogleLogin } from "@react-oauth/google";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bet, CommunityMatchRow, LeaderboardRow, Match, Pool, UserMe } from "@/lib/api";
import { apiFetch, fetchMe, getToken, loginWithGoogle, setToken } from "@/lib/api";
import { useEffectiveNow } from "@/hooks/useEffectiveNow";
import { CommunityBets } from "./CommunityBets";
import { MatchCard } from "./MatchCard";

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
      setLoadError(e instanceof Error ? e.message : "Failed to load");
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

  const isHardAdmin = (me?.email || "").toLowerCase() === "vitoco2489@gmail.com";

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

  const leaderId = leaderboard[0]?.user_id ?? "none";

  function rankMarker(rank: number): string {
    if (rank === 1) return "⭐🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return String(rank);
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">World Cup Pool</h1>
        <p className="mt-2 text-sm text-slate-400">Private picks among friends. Sign in to view matches, results, and rankings.</p>
        <div className="mt-6">
          <GoogleLogin
            onSuccess={async (cred) => {
              if (!cred.credential) return;
              await loginWithGoogle(cred.credential);
              setTok(getToken());
            }}
            onError={() => setLoadError("Google sign-in failed")}
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
          <h1 className="text-2xl font-bold tracking-tight">World Cup Pool</h1>
          <p className="text-sm text-slate-400">Private picks among friends · UTC kickoffs, local times shown</p>
          {isSimulated ? (
            <p className="mt-1 text-xs font-medium text-amber-400">Admin simulated clock is active — times reflect server test time.</p>
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
                      Dashboard
                    </Link>
                    <Link onClick={() => setMenuOpen(false)} href="/matches/results" className="rounded px-2 py-1.5 hover:bg-slate-800">
                      Results
                    </Link>
                    <Link onClick={() => setMenuOpen(false)} href="/profile" className="rounded px-2 py-1.5 hover:bg-slate-800">
                      Profile
                    </Link>
                    {isHardAdmin ? (
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
                      Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <GoogleLogin
              onSuccess={async (cred) => {
                if (!cred.credential) return;
                await loginWithGoogle(cred.credential);
                setTok(getToken());
              }}
              onError={() => setLoadError("Google sign-in failed")}
              useOneTap={false}
            />
          )}
        </div>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-full rounded-xl border border-slate-700 bg-card p-4">
          <h2 className="text-lg font-semibold text-white">Prize pool</h2>
          {pool ? (
            <>
              <p className="mt-2 text-xl font-bold text-primary">{pool.label}</p>
              <p className="mt-1 text-3xl font-extrabold">{pool.prize_display_usd}</p>
              {pool.pool_total_usd > 0 ? (
                <p className="mt-1 text-xs text-slate-500">Pool total: {pool.pool_total_usd.toLocaleString()} USD</p>
              ) : null}
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <dt className="text-slate-400">Players</dt>
                  <dd className="font-semibold">{pool.total_users}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Bets</dt>
                  <dd className="font-semibold">{pool.total_bets_placed}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Points out</dt>
                  <dd className="font-semibold">{pool.total_points_awarded}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-slate-500">Top player wins the pool.</p>
            </>
          ) : (
            <p className="mt-2 text-slate-500">Loading…</p>
          )}
        </div>

        <div className="h-full rounded-xl border border-slate-700 bg-card p-4">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-slate-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                  <th className="px-3 py-2 text-right">Correct</th>
                  <th className="px-3 py-2 text-right">Incorrect</th>
                </tr>
              </thead>
              <AnimatePresence mode="wait">
              <motion.tbody
                key={leaderId}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                {leaderboard.map((row, i) => (
                  <motion.tr
                    layout
                    key={row.user_id}
                    className={`border-t border-slate-800 transition-colors ${
                      i === 0
                        ? "bg-amber-400/10 ring-1 ring-inset ring-amber-300/35"
                        : i === 1
                          ? "bg-slate-100/5"
                          : i === 2
                            ? "bg-amber-900/10"
                            : ""
                    }`}
                    animate={i === 0 ? { scale: [1, 1.01, 1] } : { scale: 1 }}
                    transition={{ duration: 0.35 }}
                  >
                    <td className={`px-3 py-2 ${i <= 2 ? "text-white" : "text-slate-500"}`}>{rankMarker(i + 1)}</td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${i === 0 ? "font-bold text-amber-200" : ""}`}>
                      {row.total_points}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.correct_bets}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">{row.incorrect_bets}</td>
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
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Upcoming without bet <span className="text-primary">★</span>
            </h2>
            {!token ? (
              <p className="text-sm text-slate-400">Sign in to see matches you have not picked yet.</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-slate-400">
                No upcoming matches.{" "}
                <Link href="/matches/results" className="text-primary underline hover:text-primary/90">
                  Check Results
                </Link>{" "}
                to see outcomes.
              </p>
            ) : upcomingNoBet.length === 0 ? (
              <p className="text-sm text-slate-400">You are caught up — nice work.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {upcomingNoBet.map((m) => (
                  <MatchCard key={m.id} match={m} effectiveNowMs={effectiveNowMs} onBetSaved={refreshAll} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">My bets</h2>
            {!token ? (
              <p className="text-sm text-slate-400">Sign in to track your picks.</p>
            ) : myBetCards.length === 0 ? (
              <p className="text-sm text-slate-400">
                No open picks — add one under{" "}
                <span className="text-slate-300">Upcoming without bet</span>. Finished picks live in{" "}
                <Link href="/matches/results" className="text-primary underline hover:text-primary/90">
                  Results
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {myBetCards.map(({ bet, match }) => (
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
            <p className="text-sm font-semibold text-white">🏆 Points system</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              <li>+3 → correct match outcome</li>
              <li>+2 → exact score</li>
              <li>Max: 5 points per match</li>
            </ul>
          </div>
          <h2 className="text-lg font-semibold text-white">Community bets</h2>
          <p className="text-xs text-slate-500">
            Percentages before kickoff; after kickoff, names are shown per side.
          </p>
          <CommunityBets rows={communityDashboard} />
        </aside>
      </div>

      <div className="pb-8" />
    </div>
  );
}
