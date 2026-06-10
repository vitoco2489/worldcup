"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GroupStandingsView } from "@/lib/api";
import { apiFetch, getToken } from "@/lib/api";

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

function gdClass(gd: number): string {
  if (gd > 0) return "text-emerald-400";
  if (gd < 0) return "text-danger";
  return "text-slate-400";
}

function rowClass(qualification: string | null): string {
  if (qualification === "direct") return "bg-emerald-500/10";
  if (qualification === "best_third") return "bg-amber-500/10";
  return "";
}

export default function GroupsPage() {
  const router = useRouter();
  const [data, setData] = useState<GroupStandingsView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    void apiFetch<GroupStandingsView>("/groups/standings")
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Error al cargar"));
  }, [router]);

  if (err) {
    return <div className="min-h-screen bg-pitch px-4 py-8 text-danger">{err}</div>;
  }

  if (!data) {
    return <div className="min-h-screen bg-pitch px-4 py-8 text-slate-300">Cargando grupos…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-pitch px-4 py-8 text-white">
      <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200">
          Inicio
        </Link>
        <span>›</span>
        <span className="text-slate-200">Grupos</span>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Tablas de grupos</h1>
        <p className="mt-1 text-sm text-slate-400">
          Clasifican los 2 primeros de cada grupo y los {data.best_third_slots} mejores terceros (puntos, DG, GF).
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/30" />
            1° y 2° — clasificación directa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-amber-500/30" />
            3° — entre los mejores terceros
          </span>
        </div>
      </header>

      {data.groups.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay grupos cargados en el calendario.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.groups.map((group) => (
            <section
              key={group.group_name}
              className="overflow-hidden rounded-xl border border-slate-700 bg-card"
            >
              <h2 className="border-b border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-bold text-primary">
                Grupo {group.group_letter}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[18rem] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Equipo</th>
                      <th className="px-1 py-1.5 text-center">PJ</th>
                      <th className="px-1 py-1.5 text-center">G</th>
                      <th className="px-1 py-1.5 text-center">E</th>
                      <th className="px-1 py-1.5 text-center">P</th>
                      <th className="px-1 py-1.5 text-center">DG</th>
                      <th className="px-2 py-1.5 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, idx) => (
                        <tr
                          key={row.team}
                          className={`border-t border-slate-800 ${rowClass(row.qualification)}`}
                        >
                          <td className="px-2 py-1.5 tabular-nums text-slate-500">
                            {idx + 1}
                            {row.qualification === "best_third" ? (
                              <span className="ml-0.5 text-amber-400" title="Mejor tercero">
                                ★
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <img
                                src={flagUrl(row.team_code)}
                                alt=""
                                className="h-3.5 w-5 shrink-0 rounded-sm object-cover"
                              />
                              <span className="truncate font-medium">{row.team}</span>
                            </div>
                          </td>
                          <td className="px-1 py-1.5 text-center tabular-nums text-slate-300">{row.played}</td>
                          <td className="px-1 py-1.5 text-center tabular-nums">{row.wins}</td>
                          <td className="px-1 py-1.5 text-center tabular-nums">{row.draws}</td>
                          <td className="px-1 py-1.5 text-center tabular-nums">{row.losses}</td>
                          <td className={`px-1 py-1.5 text-center tabular-nums ${gdClass(row.gd)}`}>
                            {row.gd > 0 ? `+${row.gd}` : row.gd}
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums text-white">
                            {row.points}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
