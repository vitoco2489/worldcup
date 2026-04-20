export function parseUtc(iso: string): Date {
  return new Date(iso);
}

export function formatLocal(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parseUtc(iso));
}

export function lockDeadlineMs(startIso: string): number {
  const start = parseUtc(startIso).getTime();
  return start - 5 * 60 * 1000;
}

export function secondsUntilLock(startIso: string, nowMs: number = Date.now()): number {
  const d = lockDeadlineMs(startIso) - nowMs;
  return Math.max(0, Math.floor(d / 1000));
}

export type MatchBettingPhase = "editable" | "closing_soon" | "locked";
export type MatchLifecycleStatus = "scheduled" | "locked" | "in_progress" | "finished";

/** Editable: more than 5m before kickoff. Closing soon: lock window until kickoff. Locked: kickoff passed. */
export function matchBettingPhase(startIso: string, nowMs: number): MatchBettingPhase {
  const start = parseUtc(startIso).getTime();
  const lockMs = start - 5 * 60 * 1000;
  if (nowMs >= start) return "locked";
  if (nowMs >= lockMs) return "closing_soon";
  return "editable";
}

export function secondsUntilKickoff(startIso: string, nowMs: number): number {
  const start = parseUtc(startIso).getTime();
  return Math.max(0, Math.floor((start - nowMs) / 1000));
}

export function matchLifecycleStatus(
  startIso: string,
  nowMs: number,
  scoreHome: number | null,
  scoreAway: number | null,
): MatchLifecycleStatus {
  if (scoreHome != null && scoreAway != null) return "finished";
  const start = parseUtc(startIso).getTime();
  const lock = lockDeadlineMs(startIso);
  if (nowMs >= start) return "in_progress";
  if (nowMs >= lock) return "locked";
  return "scheduled";
}

export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function isUrgent(startIso: string, nowMs: number = Date.now()): boolean {
  const start = parseUtc(startIso).getTime();
  const ms = start - nowMs;
  return ms > 0 && ms < 60 * 60 * 1000;
}
