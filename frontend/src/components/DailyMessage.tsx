"use client";

import { useEffect, useState } from "react";
import type { DailyDigest } from "@/lib/api";
import { apiFetch } from "@/lib/api";

type Props = {
  dateKey: string | null;
};

export function DailyMessage({ dateKey }: Props) {
  const [digest, setDigest] = useState<DailyDigest | null>(null);

  useEffect(() => {
    if (!dateKey) {
      setDigest(null);
      return;
    }
    void apiFetch<DailyDigest>(`/digest/daily?date=${encodeURIComponent(dateKey)}`)
      .then(setDigest)
      .catch(() => setDigest(null));
  }, [dateKey]);

  if (!digest || digest.messages.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 p-4 shadow-sm">
      <h2 className="text-sm font-bold tracking-wide text-amber-200">📣 Chisme del día</h2>
      <p className="mt-0.5 text-xs text-amber-200/60">Sin spoilers — solo vibes de la polla</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-100">
        {digest.messages.map((msg, i) => (
          <li key={`${i}-${msg.slice(0, 24)}`} className="leading-snug rounded-lg bg-black/15 px-2.5 py-1.5">
            {msg}
          </li>
        ))}
      </ul>
    </section>
  );
}
