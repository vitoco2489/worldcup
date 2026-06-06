"use client";

import type { Match } from "@/lib/api";
import { formatCountdown, formatLocal, secondsUntilKickoff } from "@/lib/time";

type Props = {
  matches: Match[];
  nowMs: number;
  onDismiss: () => void;
};

export function UrgentBetAlert({ matches, nowMs, onDismiss }: Props) {
  if (matches.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-500/45 bg-amber-500/10 px-4 py-3 text-sm text-amber-50"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-amber-100">
            ⚠️{" "}
            {matches.length === 1
              ? "Tienes 1 partido sin apostar que empieza en menos de 2 horas"
              : `Tienes ${matches.length} partidos sin apostar que empiezan en menos de 2 horas`}
          </p>
          <ul className="space-y-1 text-xs text-amber-100/90">
            {matches.map((m) => (
              <li key={m.id}>
                <span className="font-medium text-amber-50">
                  {m.team_home} vs {m.team_away}
                </span>
                <span className="text-amber-200/80">
                  {" "}
                  · {formatLocal(m.start_time)} · pitido en{" "}
                  <span className="font-mono">{formatCountdown(secondsUntilKickoff(m.start_time, nowMs))}</span>
                </span>
              </li>
            ))}
          </ul>
          <a
            href="#sin-apuesta"
            className="inline-block text-xs font-semibold text-amber-200 underline hover:text-amber-50"
          >
            Ir a Sin apuesta ↓
          </a>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg border border-amber-500/30 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-500/15"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
