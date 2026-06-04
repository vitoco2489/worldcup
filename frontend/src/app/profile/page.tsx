"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { UserMe, UserStats } from "@/lib/api";
import { apiFetch, fetchMe, getToken } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<UserMe | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const t = getToken();
    if (!t) {
      router.replace("/");
      return;
    }
    const [u, s] = await Promise.all([fetchMe(), apiFetch<UserStats>("/profile/stats")]);
    setMe(u);
    setStats(s);
  }, [router]);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Error al cargar"));
  }, [load]);

  if (!me || !stats) {
    return (
      <div className="min-h-screen bg-pitch px-4 py-8 text-slate-300">
        <p>{err ?? "Cargando…"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-pitch px-4 py-8 text-white">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Perfil</h1>
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Inicio
        </Link>
      </div>

      <p className="mb-6 text-sm text-slate-400">
        {me.name} · {me.email}
      </p>

      <section className="mb-8 space-y-2 rounded-xl border border-slate-700 bg-card p-4">
        <h2 className="font-semibold text-slate-200">Tus estadísticas</h2>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <dt className="text-slate-500">Puntos</dt>
            <dd className="text-lg font-bold text-primary">{stats.total_points}</dd>
          </div>
          <div>
            <dt className="text-slate-500">1×2 acertados</dt>
            <dd className="text-lg font-bold">{stats.correct_predictions}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Marcadores exactos</dt>
            <dd className="text-lg font-bold">{stats.exact_score_hits}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
