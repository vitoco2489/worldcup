"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Bet, Match } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import {
  formatCountdown,
  formatLocal,
  matchLifecycleStatus,
  matchBettingPhase,
  secondsUntilKickoff,
  secondsUntilLock,
  type MatchLifecycleStatus,
  type MatchBettingPhase,
} from "@/lib/time";
import { FootballKick } from "./FootballKick";
import { BetChoiceBurst } from "./BetChoiceBurst";
import { MatchMetaBadges } from "./MatchMetaBadges";

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

function TeamFlag({ code, name }: { code: string; name: string }) {
  const tbd = code.length > 3 || /^[wl]?\d/i.test(code) || code === "tbd";
  if (tbd) {
    return (
      <span
        className="flex h-6 w-8 shrink-0 items-center justify-center rounded-sm bg-slate-700 text-[10px] font-bold text-slate-300"
        title={name}
      >
        ?
      </span>
    );
  }
  return <img src={flagUrl(code)} alt="" className="h-6 w-8 shrink-0 rounded-sm object-cover" />;
}

type Props = {
  match: Match;
  existingBet?: Bet | null;
  onBetSaved?: () => void;
  /** Server-aligned instant (includes simulated clock). */
  effectiveNowMs: number;
};

export function MatchCard({ match, existingBet, onBetSaved, effectiveNowMs }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kick, setKick] = useState(0);
  const [choiceBurst, setChoiceBurst] = useState(0);
  const [burstChoice, setBurstChoice] = useState<"home" | "away" | "draw">("home");
  const [localPrediction, setLocalPrediction] = useState<string | null>(existingBet?.prediction ?? null);
  const [scoreHome, setScoreHome] = useState("");
  const [scoreAway, setScoreAway] = useState("");

  useEffect(() => {
    setLocalPrediction(existingBet?.prediction ?? null);
    setScoreHome(
      existingBet?.predicted_score_home != null ? String(existingBet.predicted_score_home) : "",
    );
    setScoreAway(
      existingBet?.predicted_score_away != null ? String(existingBet.predicted_score_away) : "",
    );
  }, [
    existingBet?.id,
    existingBet?.prediction,
    existingBet?.predicted_score_home,
    existingBet?.predicted_score_away,
  ]);

  const lockSec = useMemo(
    () => secondsUntilLock(match.start_time, effectiveNowMs),
    [match.start_time, effectiveNowMs],
  );
  const kickSec = useMemo(
    () => secondsUntilKickoff(match.start_time, effectiveNowMs),
    [match.start_time, effectiveNowMs],
  );
  const lifecycle: MatchLifecycleStatus = useMemo(
    () => matchLifecycleStatus(match.start_time, effectiveNowMs, match.score_home, match.score_away),
    [match.start_time, effectiveNowMs, match.score_home, match.score_away],
  );
  const phase: MatchBettingPhase = useMemo(() => {
    if (lifecycle === "finished" || lifecycle === "in_progress") return "locked";
    if (lifecycle === "locked") return "closing_soon";
    if (lifecycle === "scheduled") return "editable";
    return matchBettingPhase(match.start_time, effectiveNowMs);
  }, [lifecycle, match.start_time, effectiveNowMs]);

  const resolved = existingBet?.resolved === true;
  const correct = existingBet?.correct;

  const teamsPending = match.teams_resolved === false;

  const canBet = useMemo(() => {
    if (teamsPending) return false;
    if (lifecycle !== "scheduled") return false;
    if (existingBet) return existingBet.editable === true;
    return lockSec > 0;
  }, [existingBet, lifecycle, lockSec, teamsPending]);

  let border = "border-slate-600";
  if (resolved && correct === true) border = "border-primary ring-1 ring-primary/40";
  else if (resolved && correct === false) border = "border-danger ring-1 ring-danger/30";
  else if (phase === "editable" && canBet) border = "border-emerald-500/55 ring-1 ring-emerald-500/30";
  else if (phase === "closing_soon") border = "border-amber-500/55 ring-1 ring-amber-500/35 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]";
  else border = "border-slate-600 ring-1 ring-slate-700/40";

  const lifecycleBadge =
    lifecycle === "scheduled" ? (
      <span className="rounded-full bg-slate-600/40 px-2 py-0.5 text-slate-300">Programado</span>
    ) : lifecycle === "locked" ? (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-400">Cierra pronto</span>
    ) : lifecycle === "in_progress" ? (
      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-400">En juego</span>
    ) : (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">Finalizado</span>
    );

  const impliedOutcome = useMemo(() => {
    const hs = scoreHome.trim();
    const as = scoreAway.trim();
    if (hs === "" || as === "") return null;
    const h = parseInt(hs, 10);
    const a = parseInt(as, 10);
    if (Number.isNaN(h) || Number.isNaN(a)) return null;
    if (h > a) return "home" as const;
    if (a > h) return "away" as const;
    return "draw" as const;
  }, [scoreHome, scoreAway]);

  useEffect(() => {
    if (impliedOutcome) setLocalPrediction(impliedOutcome);
  }, [impliedOutcome]);

  function parseOptionalScores(): { ok: true; home: number | null; away: number | null } | { ok: false; message: string } {
    const hs = scoreHome.trim();
    const as = scoreAway.trim();
    if (hs === "" && as === "") return { ok: true, home: null, away: null };
    if (hs === "" || as === "") return { ok: false, message: "Ingresa ambos marcadores o déjalos vacíos." };
    const ph = parseInt(hs, 10);
    const pa = parseInt(as, 10);
    if (Number.isNaN(ph) || Number.isNaN(pa) || ph < 0 || pa < 0) {
      return { ok: false, message: "Los goles deben ser números enteros no negativos." };
    }
    return { ok: true, home: ph, away: pa };
  }

  function outcomeScoresError(pred: string, home: number | null, away: number | null): string | null {
    if (home === null || away === null) return null;
    if (pred === "home" && !(home > away)) return "Si eliges local, el marcador local debe ser mayor.";
    if (pred === "away" && !(away > home)) return "Si eliges visitante, el marcador visitante debe ser mayor.";
    if (pred === "draw" && home !== away) return "Si eliges empate, ambos marcadores deben ser iguales.";
    return null;
  }

  async function save(prediction: "home" | "away" | "draw") {
    if (!canBet) return;
    setError(null);
    const scores = parseOptionalScores();
    if (!scores.ok) {
      setError(scores.message);
      toast.error(scores.message);
      return;
    }
    let effective: "home" | "away" | "draw" = prediction;
    if (scores.home !== null && scores.away !== null) {
      if (!impliedOutcome) {
        const msg = "Marcador inválido";
        setError(msg);
        toast.error(msg);
        return;
      }
      effective = impliedOutcome;
    } else {
      const consistency = outcomeScoresError(prediction, scores.home, scores.away);
      if (consistency) {
        setError(consistency);
        toast.error(consistency);
        return;
      }
    }
    setSaving(true);
    setBurstChoice(effective);
    setChoiceBurst((k) => k + 1);
    try {
      await apiFetch("/bets", {
        method: "POST",
        body: JSON.stringify({
          match_id: match.id,
          prediction: effective,
          predicted_score_home: scores.home,
          predicted_score_away: scores.away,
        }),
      });
      setLocalPrediction(effective);
      setKick((k) => k + 1);
      if (existingBet) {
        onBetSaved?.();
      } else {
        window.setTimeout(() => onBetSaved?.(), 1300);
      }
      toast.success("Apuesta guardada ⚽");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar la apuesta";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const showScores = match.score_home != null && match.score_away != null;
  const showPredicted =
    existingBet?.predicted_score_home != null && existingBet?.predicted_score_away != null;

  return (
    <motion.div
      layout="position"
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`relative overflow-hidden rounded-xl border bg-card p-4 transition-colors duration-300 ${border}`}
    >
      <FootballKick pulse={kick} />
      <BetChoiceBurst
        pulse={choiceBurst}
        choice={burstChoice}
        homeCode={match.team_home_code}
        awayCode={match.team_away_code}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-3">
          <MatchMetaBadges groupName={match.group_name} round={match.round} />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamFlag code={match.team_home_code} name={match.team_home} />
              <span className="truncate font-semibold">{match.team_home}</span>
            </div>
            {showScores ? (
              <span className="text-lg font-bold tabular-nums">
                {match.score_home} – {match.score_away}
              </span>
            ) : (
              <span className="text-slate-400 text-sm">vs</span>
            )}
            <div className="flex min-w-0 items-center justify-end gap-2">
              <span className="truncate text-right font-semibold">{match.team_away}</span>
              <TeamFlag code={match.team_away_code} name={match.team_away} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span>{formatLocal(match.start_time)}</span>
            <span className="text-slate-500">·</span>
            {lifecycleBadge}
          </div>
          {teamsPending ? (
            <p className="text-xs text-amber-300/90">
              Equipos por definir — las apuestas abren cuando se confirmen los cupos de grupo o eliminatoria.
            </p>
          ) : null}
          <div className="text-sm">
            {!resolved && phase === "editable" && lockSec > 0 ? (
              <span className="text-slate-300">
                Cierra en <span className="font-mono text-white">{formatCountdown(lockSec)}</span>
              </span>
            ) : !resolved && phase === "closing_soon" ? (
              <span className="text-amber-200/90">
                Apuestas cerradas · inicio en <span className="font-mono text-white">{formatCountdown(kickSec)}</span>
              </span>
            ) : !resolved && lifecycle === "in_progress" ? (
              <span className="text-sky-300">Partido en juego</span>
            ) : !resolved && phase === "locked" ? (
              <span className="text-slate-500">Ya empezó — apuestas cerradas</span>
            ) : !resolved ? (
              <span className="text-slate-400">—</span>
            ) : (
              <span className="text-slate-300">
                {existingBet?.points_awarded != null ? `${existingBet.points_awarded} pts` : "Resuelto"}
                {existingBet?.correct === true ? " · resultado +3" : existingBet?.correct === false ? " · resultado 0" : ""}
                {existingBet?.exact_score_hit ? " · marcador exacto +2" : ""}
              </span>
            )}
          </div>
          {showPredicted ? (
            <p className="text-xs text-slate-400">
              Tu marcador:{" "}
              <span className="font-mono text-slate-200">
                {existingBet?.predicted_score_home}–{existingBet?.predicted_score_away}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2">
        {canBet && impliedOutcome ? (
          <motion.button
            type="button"
            layout
            disabled={saving}
            whileTap={saving ? undefined : { scale: 0.96 }}
            whileHover={saving ? undefined : { scale: 1.02, y: -1 }}
            onClick={() => void save(impliedOutcome)}
            className={`col-span-3 rounded-lg border px-4 py-2.5 text-sm font-semibold transition sm:col-auto ${
              localPrediction === impliedOutcome
                ? "cursor-pointer border-primary bg-primary/25 text-primary ring-2 ring-primary/45"
                : "cursor-pointer border-slate-500 bg-slate-800 text-white ring-1 ring-slate-600/60 hover:border-primary/40 hover:bg-slate-700"
            } ${saving ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Guardando...
              </span>
            ) : (
              <>
                Guardar{" "}
            {impliedOutcome === "home"
              ? match.team_home.slice(0, 18)
              : impliedOutcome === "away"
                ? match.team_away.slice(0, 18)
                : "empate"}{" "}
                (según marcador)
              </>
            )}
          </motion.button>
        ) : canBet ? (
          (["home", "draw", "away"] as const).map((p) => {
            const isSel = localPrediction === p;
            const disabled = saving;
            const label =
              p === "home" ? match.team_home.slice(0, 14) : p === "away" ? match.team_away.slice(0, 14) : "Empate";
            return (
              <motion.button
                key={p}
                type="button"
                layout
                disabled={disabled}
                whileTap={disabled ? undefined : { scale: 0.92 }}
                whileHover={disabled ? undefined : { scale: 1.04, y: -2 }}
                onClick={() => void save(p)}
                className={`relative min-h-[44px] overflow-hidden rounded-lg border px-2 py-2.5 text-sm font-semibold transition sm:px-4 ${
                  isSel
                    ? "cursor-pointer border-primary bg-primary/20 text-primary ring-2 ring-primary/50 shadow-[0_0_16px_rgba(34,197,94,0.2)]"
                    : "cursor-pointer border-slate-500 bg-slate-800/90 text-white ring-1 ring-slate-600/60 shadow-sm hover:border-primary/45 hover:bg-slate-700 hover:text-white"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {burstChoice === p && choiceBurst > 0 ? (
                  <motion.span
                    key={choiceBurst}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-primary/15"
                    initial={{ opacity: 0.7, scale: 0.85 }}
                    animate={{ opacity: 0, scale: 1.35 }}
                    transition={{ duration: 0.85 }}
                  />
                ) : null}
                <span className="relative z-[1]">
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Guardando...
                  </span>
                ) : (
                  label
                )}
                </span>
              </motion.button>
            );
          })
        ) : null}
      </div>

      {canBet && !impliedOutcome ? (
        <p className="mt-2 text-center text-xs text-slate-500 sm:text-left">Toca una opción para guardar tu apuesta</p>
      ) : null}

      {canBet && impliedOutcome ? (
        <p className="mt-2 text-xs text-slate-500">
          El 1×2 sigue tu marcador — usa el botón de arriba para guardar.
        </p>
      ) : null}

      {canBet ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Goles local
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={scoreHome}
              onChange={(e) => setScoreHome(e.target.value)}
              className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white"
              placeholder="opc."
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Goles visitante
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={scoreAway}
              onChange={(e) => setScoreAway(e.target.value)}
              className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white"
              placeholder="opc."
            />
          </label>
          <span className="pb-1 text-xs text-slate-500">Opcional · los dos o ninguno</span>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </motion.div>
  );
}
