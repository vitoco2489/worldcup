"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { WallHighlights } from "@/lib/api";
import { apiFetch, getToken } from "@/lib/api";

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

function WallList({
  title,
  emoji,
  entries,
  tone,
}: {
  title: string;
  emoji: string;
  entries: WallHighlights["fame"];
  tone: "fame" | "shame";
}) {
  if (entries.length === 0) {
    return (
      <section className="rounded-xl border border-slate-700 bg-card p-4">
        <h2 className="text-lg font-semibold">
          {emoji} {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">Nada todavía — aparece cuando haya partidos resueltos.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-card p-4">
      <h2 className="text-lg font-semibold">
        {emoji} {title}
      </h2>
      <ul className="mt-3 space-y-3">
        {entries.map((e, i) => (
          <li
            key={`${e.user_name}-${e.match_label}-${i}`}
            className={`rounded-lg border px-3 py-2.5 text-sm ${
              tone === "fame"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-danger/30 bg-danger/5"
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-white">
              <img src={flagUrl(e.team_home_code)} alt="" className="h-4 w-6 rounded-sm object-cover" />
              <span className="truncate">{e.match_label}</span>
              <img src={flagUrl(e.team_away_code)} alt="" className="h-4 w-6 rounded-sm object-cover" />
            </div>
            <p className="mt-1 text-slate-200">
              <span className="font-semibold">{e.user_name}</span>
              {e.predicted_score ? (
                <>
                  {" "}
                  predijo <span className="font-mono">{e.predicted_score}</span>
                </>
              ) : null}
              {e.final_score ? (
                <>
                  {" "}
                  · final <span className="font-mono">{e.final_score}</span>
                </>
              ) : null}
            </p>
            <p className={`mt-0.5 text-xs ${tone === "fame" ? "text-emerald-300" : "text-danger/90"}`}>
              {e.detail}
              {e.points_earned > 0 ? ` · ${e.points_earned} pts` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function WallPage() {
  const router = useRouter();
  const [data, setData] = useState<WallHighlights | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void apiFetch<WallHighlights>("/wall/highlights")
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Error al cargar"));
  }, [router]);

  if (err) {
    return <div className="min-h-screen bg-pitch px-4 py-8 text-danger">{err}</div>;
  }

  if (!data) {
    return <div className="min-h-screen bg-pitch px-4 py-8 text-slate-300">Cargando muro…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-pitch px-4 py-8 text-white">
      <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200">
          Inicio
        </Link>
        <span>›</span>
        <span className="text-slate-200">Muro fama / vergüenza</span>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Muro de fama y vergüenza</h1>
        <p className="mt-1 text-sm text-slate-400">Los mejores aciertos y las predicciones más lejanas del torneo.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <WallList title="Fama" emoji="🏆" entries={data.fame} tone="fame" />
        <WallList title="Vergüenza" emoji="😅" entries={data.shame} tone="shame" />
      </div>
    </div>
  );
}
