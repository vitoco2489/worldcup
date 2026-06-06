import { DISPLAY_TIMEZONE, LOCALE } from "./i18n";

export function parseUtc(iso: string): Date {
  return new Date(iso);
}

export function formatLocal(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIMEZONE,
  }).format(parseUtc(iso));
}

export const LOCK_BEFORE_START_MINUTES = 5;
export const URGENT_BET_WINDOW_HOURS = 2;

export function isWithinBetUrgentWindow(startIso: string, nowMs: number = Date.now()): boolean {
  const start = parseUtc(startIso).getTime();
  const msUntilStart = start - nowMs;
  const lockMs = LOCK_BEFORE_START_MINUTES * 60 * 1000;
  const windowMs = URGENT_BET_WINDOW_HOURS * 60 * 60 * 1000;
  return msUntilStart > lockMs && msUntilStart <= windowMs;
}

export function lockDeadlineMs(startIso: string): number {
  const start = parseUtc(startIso).getTime();
  return start - LOCK_BEFORE_START_MINUTES * 60 * 1000;
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
  const lockMs = start - LOCK_BEFORE_START_MINUTES * 60 * 1000;
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

/** Día calendario (YYYY-MM-DD) en hora de Chile, para agrupar partidos. */
export function localDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? parseUtc(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDayLabel(dateKey: string): string {
  const d = parseUtc(`${dateKey}T15:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: DISPLAY_TIMEZONE,
  }).format(d);
}

export function defaultUpcomingDayKey(dates: string[], nowMs: number = Date.now()): string | null {
  if (dates.length === 0) return null;
  const today = localDateKey(new Date(nowMs));
  return dates.find((k) => k >= today) ?? dates[0];
}
