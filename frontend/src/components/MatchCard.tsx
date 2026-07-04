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
import { betPickLabel, betResultBadge } from "@/lib/betLabels";
import { formatMatchScore } from "@/lib/matchScore";
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
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

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

  const savedPrediction = existingBet?.prediction ?? null;
  const savedScoreHome =
    existingBet?.predicted_score_home != null ? String(existingBet.predicted_score_home) : "";
  const savedScoreAway =
    existingBet?.predicted_score_away != null ? String(existingBet.predicted_score_away) : "";

  const effectivePrediction = impliedOutcome ?? localPrediction;

  const hasUnsavedChanges = useMemo(() => {
    if (!canBet) return false;
    if (!effectivePrediction) return false;
    if (!existingBet) return true;
    const predChanged = effectivePrediction !== savedPrediction;
    const scoresChanged = scoreHome !== savedScoreHome || scoreAway !== savedScoreAway;
    return predChanged || scoresChanged;
  }, [
    canBet,
    effectivePrediction,
    existingBet,
    savedPrediction,
    scoreHome,
    savedScoreHome,
    scoreAway,
    savedScoreAway,
  ]);

  function syncPredictionFromScores(home: string, away: string) {
    const hs = home.trim();
    const as = away.trim();
    if (hs === "" || as === "") return;
    const h = parseInt(hs, 10);
    const a = parseInt(as, 10);
    if (Number.isNaN(h) || Number.isNaN(a)) return;
    if (h > a) setLocalPrediction("home");
    else if (a > h) setLocalPrediction("away");
    else setLocalPrediction("draw");
  }

  function pick(prediction: "home" | "away" | "draw") {
    if (!canBet || saving) return;
    setLocalPrediction(prediction);
    // Marcador guardado fijaba el 1×2 — al elegir con botón, suelta el marcador.
    if (scoreHome !== "" || scoreAway !== "") {
      setScoreHome("");
      setScoreAway("");
    }
    setError(null);
    setResetConfirmOpen(false);
  }

  useEffect(() => {
    if (!hasUnsavedChanges) setResetConfirmOpen(false);
  }, [hasUnsavedChanges]);

  function resetDraft() {
    if (existingBet) {
      setLocalPrediction(savedPrediction);
      setScoreHome(savedScoreHome);
      setScoreAway(savedScoreAway);
      toast.message(`Apuesta restaurada (${matchShortLabel})`);
    } else {
      setLocalPrediction(null);
      setScoreHome("");
      setScoreAway("");
      toast.message(`Selección borrada (${matchShortLabel})`);
    }
    setError(null);
    setResetConfirmOpen(false);
  }

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
  const resultBadge = existingBet ? betResultBadge(existingBet) : null;
  const matchShortLabel = `${match.team_home} vs ${match.team_away}`;

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
              <span className="text-lg font-bold tabular-nums">{formatMatchScore(match)}</span>
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
          {existingBet ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Tu apuesta: {betPickLabel(existingBet, match.team_home, match.team_away)}
              </span>
              {resultBadge ? (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${resultBadge.className}`}>
                  {resultBadge.text}
                </span>
              ) : (
                <span className="rounded-full bg-slate-700/60 px-2.5 py-0.5 text-xs text-slate-300">
                  Pendiente de resultado
                </span>
              )}
            </div>
          ) : null}
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

      {canBet ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2">
          {(["home", "draw", "away"] as const).map((p) => {
            const isSel = effectivePrediction === p;
            const label =
              p === "home" ? match.team_home.slice(0, 14) : p === "away" ? match.team_away.slice(0, 14) : "Empate";
            return (
              <motion.button
                key={p}
                type="button"
                layout
                disabled={saving}
                whileTap={saving ? undefined : { scale: 0.92 }}
                whileHover={saving ? undefined : { scale: 1.04, y: -2 }}
                onClick={() => pick(p)}
                className={`relative min-h-[44px] overflow-hidden rounded-lg border px-2 py-2.5 text-sm font-semibold transition sm:px-4 ${
                  isSel
                    ? "cursor-pointer border-primary bg-primary/20 text-primary ring-2 ring-primary/50 shadow-[0_0_16px_rgba(34,197,94,0.2)]"
                    : "cursor-pointer border-slate-500 bg-slate-800/90 text-white ring-1 ring-slate-600/60 shadow-sm hover:border-primary/45 hover:bg-slate-700 hover:text-white"
                } ${saving ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span className="relative z-[1]">{label}</span>
              </motion.button>
            );
          })}
        </div>
      ) : null}

      {canBet && !effectivePrediction ? (
        <p className="mt-2 text-center text-xs text-slate-500 sm:text-left">
          Paso 1: elige local, empate o visitante.
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
              onChange={(e) => {
                const v = e.target.value;
                setScoreHome(v);
                syncPredictionFromScores(v, scoreAway);
              }}
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
              onChange={(e) => {
                const v = e.target.value;
                setScoreAway(v);
                syncPredictionFromScores(scoreHome, v);
              }}
              className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white"
              placeholder="opc."
            />
          </label>
          <span className="pb-1 text-xs text-slate-500">Opcional · los dos o ninguno</span>
        </div>
      ) : null}

      {canBet && impliedOutcome ? (
        <p className="mt-2 text-xs text-slate-500">
          El 1×2 sigue tu marcador ({impliedOutcome === "home" ? match.team_home : impliedOutcome === "away" ? match.team_away : "empate"}).
        </p>
      ) : null}

      {canBet && hasUnsavedChanges ? (
        <div className="mt-4 space-y-2">
          <p className="text-center text-xs font-medium text-amber-200/90 sm:text-left">
            {existingBet
              ? `Cambios sin guardar en ${matchShortLabel} — pulsa el botón amarillo.`
              : `Tu elección en ${matchShortLabel} aún no está guardada.`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <motion.button
              type="button"
              disabled={saving || !effectivePrediction}
              whileTap={saving ? undefined : { scale: 0.98 }}
              whileHover={saving ? undefined : { scale: 1.01 }}
              onClick={() => {
                if (!effectivePrediction) return;
                void save(effectivePrediction as "home" | "away" | "draw");
              }}
              className="w-full flex-1 rounded-xl border-2 border-amber-400 bg-amber-500/20 px-4 py-3.5 text-sm font-bold text-amber-50 shadow-[0_0_20px_rgba(251,191,36,0.25)] ring-2 ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Guardando…
                </span>
              ) : (
                <>👆 Guardar apuesta de este partido</>
              )}
            </motion.button>
            {!resetConfirmOpen ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setResetConfirmOpen(true)}
                className="w-full shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Deshacer en este partido
              </button>
            ) : null}
          </div>
          {resetConfirmOpen ? (
            <div className="rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-3">
              <p className="text-sm font-medium text-slate-100">{matchShortLabel}</p>
              <p className="mt-1 text-sm text-slate-300">
                {existingBet
                  ? "¿Descartar los cambios y volver a lo que tenías guardado en este partido?"
                  : "¿Borrar tu elección en este partido y empezar de nuevo?"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Tus apuestas en otros partidos no se modifican.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetDraft}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-600"
                >
                  Sí, deshacer
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(false)}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                >
                  No, seguir editando
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : canBet && existingBet && effectivePrediction ? (
        <p className="mt-3 text-center text-xs text-emerald-400/90 sm:text-left">✓ Apuesta guardada en el servidor</p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </motion.div>
  );
}
