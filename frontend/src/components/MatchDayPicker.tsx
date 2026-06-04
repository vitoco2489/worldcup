"use client";

import { formatDayLabel } from "@/lib/time";

type Props = {
  dates: string[];
  selected: string;
  onChange: (dateKey: string) => void;
  matchCount: number;
};

export function MatchDayPicker({ dates, selected, onChange, matchCount }: Props) {
  const idx = dates.indexOf(selected);
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < dates.length - 1;

  if (dates.length === 0) return null;

  const matchLabel =
    matchCount === 0
      ? "Sin partidos"
      : matchCount === 1
        ? "1 partido"
        : `${matchCount} partidos`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={() => hasPrev && onChange(dates[idx - 1])}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Día anterior"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-center sm:flex-initial sm:text-left">
          <p className="truncate text-sm font-medium text-white">{formatDayLabel(selected)}</p>
          <p className="text-xs text-slate-400">
            {matchLabel}
            {dates.length > 1 ? (
              <span className="text-slate-500">
                {" "}
                · día {idx + 1} de {dates.length}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => hasNext && onChange(dates[idx + 1])}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Día siguiente"
        >
          →
        </button>
      </div>
      {dates.length > 1 ? (
        <label className="flex items-center gap-2 text-xs text-slate-400 sm:shrink-0">
          Ir a
          <select
            value={selected}
            onChange={(e) => onChange(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatDayLabel(d)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
