"use client";

import { useEffect, useState } from "react";
import type { DailyDigest } from "@/lib/api";
import { apiFetch } from "@/lib/api";

type Props = {
  dateKey: string | null;
  /** Inside ranking card — no outer box */
  embedded?: boolean;
};

export function DailyMessage({ dateKey, embedded = false }: Props) {
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

  const body = (
    <>
      <h3 className="text-sm font-bold tracking-wide text-amber-200">📣 Chisme del día</h3>
      <p className="mt-0.5 text-xs text-amber-200/60">Sin spoilers — solo vibes de la polla</p>
      <ul className={`space-y-1.5 text-sm text-slate-100 ${embedded ? "mt-2" : "mt-3"}`}>
        {digest.messages.map((msg, i) => (
          <li
            key={`${i}-${msg.slice(0, 24)}`}
            className={`leading-snug ${embedded ? "rounded-md bg-amber-500/5 px-2 py-1.5" : "rounded-lg bg-black/15 px-2.5 py-1.5"}`}
          >
            {msg}
          </li>
        ))}
      </ul>
    </>
  );

  if (embedded) {
    return (
      <div className="mt-4 border-t border-slate-800 pt-4">
        {body}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 p-4 shadow-sm">
      {body}
    </section>
  );
}
