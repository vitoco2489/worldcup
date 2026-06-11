"use client";

import { useEffect, useMemo, useState } from "react";
import type { WallEntry, WallHighlights } from "@/lib/api";
import { apiFetch } from "@/lib/api";

function fameLine(entry: WallEntry): string {
  const { user_name, match_label, predicted_score, final_score, points_earned, detail } = entry;
  if (detail === "Marcador exacto" && predicted_score && final_score) {
    return `¡${user_name} clavó el ${predicted_score} en ${match_label}! Igual que el final (${final_score}) — ${points_earned} puntos.`;
  }
  if (predicted_score) {
    return `${user_name} acertó el resultado en ${match_label} (predijo ${predicted_score}, final ${final_score}) — ${points_earned} pts.`;
  }
  return `${user_name} le pegó al 1×2 en ${match_label} (final ${final_score}) — ${points_earned} pts.`;
}

function shameLine(entry: WallEntry): string {
  const { user_name, match_label, predicted_score, final_score, detail } = entry;
  if (predicted_score && final_score) {
    return `${user_name} en ${match_label}: imaginó ${predicted_score}, pero fue ${final_score}. ${detail}.`;
  }
  return `${user_name} se equivocó en ${match_label} (final ${final_score}).`;
}

function highlightName(text: string, name: string) {
  const idx = text.indexOf(name);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold text-amber-200">{name}</span>
      {text.slice(idx + name.length)}
    </>
  );
}

export function WallPanel() {
  const [data, setData] = useState<WallHighlights | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<WallHighlights>("/wall/highlights")
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Error al cargar"));
  }, []);

  const exactHits = useMemo(
    () => data?.fame.filter((e) => e.detail === "Marcador exacto") ?? [],
    [data],
  );
  const otherFame = useMemo(
    () => data?.fame.filter((e) => e.detail !== "Marcador exacto") ?? [],
    [data],
  );

  if (err) {
    return <p className="text-sm text-danger">{err}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-400">Cargando muro…</p>;
  }

  const hasFame = data.fame.length > 0;
  const hasShame = data.shame.length > 0;

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-slate-400">
        Crónicas de la polla — quién la está rompiendo y quién se fue al VAR del ridículo.
      </p>

      {hasFame ? (
        <section className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-emerald-500/5 p-4 sm:p-5">
          <h2 className="text-base font-bold text-amber-200">🏆 Los que la están clavando</h2>
          <p className="mt-1 text-xs text-amber-200/70">Aciertos y marcadores exactos del torneo</p>

          {exactHits.length > 0 ? (
            <div className="mt-4 space-y-3">
              {exactHits.map((e, i) => (
                <p
                  key={`exact-${e.user_name}-${e.match_label}-${i}`}
                  className="text-base leading-relaxed text-slate-100 sm:text-lg"
                >
                  <span className="mr-1.5" aria-hidden>
                    ⭐
                  </span>
                  {highlightName(fameLine(e), e.user_name)}
                </p>
              ))}
            </div>
          ) : null}

          {otherFame.length > 0 ? (
            <div className={`space-y-2.5 ${exactHits.length > 0 ? "mt-4 border-t border-amber-500/20 pt-4" : "mt-4"}`}>
              {otherFame.map((e, i) => (
                <p
                  key={`fame-${e.user_name}-${e.match_label}-${i}`}
                  className="text-sm leading-relaxed text-slate-200 sm:text-base"
                >
                  {highlightName(fameLine(e), e.user_name)}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-xl border border-slate-700 bg-card p-4">
          <p className="text-sm text-slate-400">
            Todavía no hay héroes en el muro — cuando caigan resultados, aquí aparecen los que acertaron.
          </p>
        </section>
      )}

      {hasShame ? (
        <section className="rounded-xl border border-slate-700/80 bg-card/60 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-400">😅 Por el otro lado…</h2>
          <div className="mt-3 space-y-2">
            {data.shame.map((e, i) => (
              <p
                key={`shame-${e.user_name}-${e.match_label}-${i}`}
                className="text-sm leading-relaxed text-slate-500"
              >
                {shameLine(e)}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
