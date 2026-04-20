"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { CommunityMatchRow, PredictionCounts } from "@/lib/api";
import { formatLocal } from "@/lib/time";

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

type Props = {
  rows: CommunityMatchRow[];
};

function percentages(counts: PredictionCounts): { home: number; draw: number; away: number } {
  const t = counts.home + counts.draw + counts.away;
  if (t === 0) return { home: 0, draw: 0, away: 0 };
  return {
    home: Math.round((counts.home / t) * 100),
    draw: Math.round((counts.draw / t) * 100),
    away: Math.round((counts.away / t) * 100),
  };
}

/** Single winner only; ties are not highlighted. */
function popularKey(counts: PredictionCounts): "home" | "draw" | "away" | null {
  const t = counts.home + counts.draw + counts.away;
  if (t === 0) return null;
  const max = Math.max(counts.home, counts.draw, counts.away);
  const keys = (["home", "draw", "away"] as const).filter((k) => counts[k] === max);
  return keys.length === 1 ? keys[0]! : null;
}

type RowProps = { row: CommunityMatchRow };

function CommunityBetRow({ row }: RowProps) {
  const pct = percentages(row.counts);
  const pop = popularKey(row.counts);
  const animKey = `${row.match.id}-${row.counts.home}-${row.counts.draw}-${row.counts.away}`;

  const line = (key: "home" | "draw" | "away", label: ReactNode, pctVal: number) => {
    const isPop = pop === key;
    return (
      <motion.li
        key={key}
        layout
        initial={{ opacity: 0.85 }}
        animate={{ opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className={`rounded-lg px-2 py-1.5 transition-colors ${
          isPop ? "bg-primary/15 ring-1 ring-primary/50 text-white" : "text-slate-300"
        }`}
      >
        {label}: <span className="font-mono tabular-nums font-semibold">{pctVal}%</span>
        {isPop ? <span className="ml-2 text-xs text-primary">most picked</span> : null}
      </motion.li>
    );
  };

  return (
    <motion.div
      key={animKey}
      layout
      className="rounded-xl border border-slate-700 bg-card p-4 transition-shadow duration-300 hover:border-slate-600"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <img src={flagUrl(row.match.team_home_code)} alt="" className="h-5 w-7 rounded-sm object-cover" />
        <span className="font-semibold">{row.match.team_home}</span>
        <span className="text-slate-500">vs</span>
        <span className="font-semibold">{row.match.team_away}</span>
        <img src={flagUrl(row.match.team_away_code)} alt="" className="h-5 w-7 rounded-sm object-cover" />
        <span className="text-xs text-slate-500">· {formatLocal(row.match.start_time)}</span>
      </div>
      <ul className="space-y-1 text-sm">
        {line(
          "home",
          <span className="inline-flex items-center gap-1">
            <img src={flagUrl(row.match.team_home_code)} alt="" className="h-4 w-5 rounded-sm object-cover" />
            Home
          </span>,
          pct.home,
        )}
        {line("draw", <>Draw</>, pct.draw)}
        {line(
          "away",
          <span className="inline-flex items-center gap-1">
            <img src={flagUrl(row.match.team_away_code)} alt="" className="h-4 w-5 rounded-sm object-cover" />
            Away
          </span>,
          pct.away,
        )}
      </ul>
      {row.reveal_individuals && row.individuals ? (
        <div className="mt-3 border-t border-slate-700 pt-3 text-xs text-slate-400">
          <p className="mb-1 font-medium text-slate-300">After kickoff — who picked what</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-slate-500">Home</p>
              <p className="text-slate-300">{row.individuals.home?.join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Draw</p>
              <p className="text-slate-300">{row.individuals.draw?.join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Away</p>
              <p className="text-slate-300">{row.individuals.away?.join(", ") || "—"}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Names stay private until kickoff.</p>
      )}
    </motion.div>
  );
}

export function CommunityBets({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No picks yet — counts appear once someone bets.</p>;
  }

  return (
    <motion.div layout className="flex flex-col gap-4">
      {rows.map((row) => (
        <CommunityBetRow key={row.match.id} row={row} />
      ))}
    </motion.div>
  );
}
