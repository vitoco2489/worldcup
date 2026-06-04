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
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h2 className="text-sm font-semibold text-amber-200">📣 Mensaje del día</h2>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
        {digest.messages.map((msg) => (
          <li key={msg} className="leading-snug">
            {msg}
          </li>
        ))}
      </ul>
    </section>
  );
}
