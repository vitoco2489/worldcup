"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { CommunityMatchRow, PredictionCounts } from "@/lib/api";
import { formatLocal } from "@/lib/time";
import { MatchMetaBadges } from "./MatchMetaBadges";

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

type Props = {
  rows: CommunityMatchRow[];
  variant?: "default" | "live";
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

function popularKey(counts: PredictionCounts): "home" | "draw" | "away" | null {
  const t = counts.home + counts.draw + counts.away;
  if (t === 0) return null;
  const max = Math.max(counts.home, counts.draw, counts.away);
  const keys = (["home", "draw", "away"] as const).filter((k) => counts[k] === max);
  return keys.length === 1 ? keys[0]! : null;
}

type RowProps = { row: CommunityMatchRow; variant?: "default" | "live" };

function PeopleChips({ names }: { names: string[] | undefined }) {
  if (!names || names.length === 0) {
    return <p className="text-sm text-slate-500">—</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {names.map((name) => (
        <span key={name} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-700">
          {name}
        </span>
      ))}
    </div>
  );
}

function CommunityBetRow({ row, variant = "default" }: RowProps) {
  const pct = percentages(row.counts);
  const pop = popularKey(row.counts);
  const animKey = `${row.match.id}-${row.counts.home}-${row.counts.draw}-${row.counts.away}`;
  const live = variant === "live";

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
        <span className="inline-flex max-w-full flex-wrap items-center gap-1">
          {label}
          <span className="font-mono tabular-nums font-semibold">{pctVal}%</span>
          <span className="text-xs text-slate-500">({row.counts[key]})</span>
        </span>
        {isPop ? <span className="ml-2 text-xs text-primary">más elegido</span> : null}
      </motion.li>
    );
  };

  return (
    <motion.div
      key={animKey}
      layout
      className={`rounded-xl border bg-card p-4 transition-shadow duration-300 ${
        live ? "border-sky-500/35 ring-1 ring-sky-500/15" : "border-slate-700 hover:border-slate-600"
      }`}
    >
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MatchMetaBadges groupName={row.match.group_name} round={row.match.round} />
          {live ? (
            <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-500/30">
              En curso
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <img src={flagUrl(row.match.team_home_code)} alt="" className="h-5 w-7 shrink-0 rounded-sm object-cover" />
              <span className="truncate font-semibold">{row.match.team_home}</span>
            </div>
          </div>
          <span className="text-sm text-slate-500">vs</span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-end gap-2">
              <span className="truncate text-right font-semibold">{row.match.team_away}</span>
              <img src={flagUrl(row.match.team_away_code)} alt="" className="h-5 w-7 shrink-0 rounded-sm object-cover" />
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">{formatLocal(row.match.start_time)}</p>
      </div>
      <ul className="space-y-1 text-sm">
        {line(
          "home",
          <span className="inline-flex items-center gap-1">
            <img src={flagUrl(row.match.team_home_code)} alt="" className="h-4 w-5 rounded-sm object-cover" />
            {row.match.team_home}
          </span>,
          pct.home,
        )}
        {line("draw", <>Empate</>, pct.draw)}
        {line(
          "away",
          <span className="inline-flex items-center gap-1">
            <img src={flagUrl(row.match.team_away_code)} alt="" className="h-4 w-5 rounded-sm object-cover" />
            {row.match.team_away}
          </span>,
          pct.away,
        )}
      </ul>
      {row.reveal_individuals && row.individuals ? (
        <div className="mt-4 border-t border-slate-700 pt-3 text-xs text-slate-400">
          <p className="mb-2 font-medium text-slate-300">{live ? "Quién apostó qué" : "Después del pitido — quién eligió qué"}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-950/45 p-3">
              <p className="flex items-center gap-1.5 font-semibold text-slate-300">
                <img src={flagUrl(row.match.team_home_code)} alt="" className="h-4 w-5 rounded-sm object-cover" />
                {row.match.team_home}
              </p>
              <PeopleChips names={row.individuals.home} />
            </div>
            <div className="rounded-lg bg-slate-950/45 p-3">
              <p className="font-semibold text-slate-300">Empate</p>
              <PeopleChips names={row.individuals.draw} />
            </div>
            <div className="rounded-lg bg-slate-950/45 p-3">
              <p className="flex items-center gap-1.5 font-semibold text-slate-300">
                <img src={flagUrl(row.match.team_away_code)} alt="" className="h-4 w-5 rounded-sm object-cover" />
                {row.match.team_away}
              </p>
              <PeopleChips names={row.individuals.away} />
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Los nombres se revelan al iniciar el partido.</p>
      )}
    </motion.div>
  );
}

export function CommunityBets({ rows, variant = "default" }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Aún no hay apuestas — los porcentajes aparecen cuando alguien juegue.</p>;
  }

  return (
    <motion.div layout className={variant === "live" ? "grid gap-4 xl:grid-cols-2" : "flex flex-col gap-4"}>
      {rows.map((row) => (
        <CommunityBetRow key={row.match.id} row={row} variant={variant} />
      ))}
    </motion.div>
  );
}
