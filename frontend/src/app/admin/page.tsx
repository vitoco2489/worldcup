"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  AllowedEmailRow,
  Pool,
  ResetAllDataResponse,
  ResetBetsResponse,
  ResetMatchesResponse,
  ResetSimulationResponse,
  ScheduleLoadResponse,
  ServerTimeResponse,
  UserMe,
} from "@/lib/api";
import { apiFetch, apiPostMultipart, fetchMe, getToken } from "@/lib/api";

type ActionKey =
  | "save_pool"
  | "load_json"
  | "load_csv"
  | "simulate_time"
  | "reset_time"
  | "reset_sim"
  | "reset_all_data"
  | "reset_bets"
  | "reset_matches"
  | "load_schedule"
  | "add_allowed"
  | "remove_allowed";

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<UserMe | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [poolInput, setPoolInput] = useState("");
  const [jsonMatches, setJsonMatches] = useState(
    '[{"team_home":"Chile","team_away":"Argentina","team_home_code":"cl","team_away_code":"ar","start_time":"2026-06-10T20:00:00Z"}]',
  );
  const [scheduleJson, setScheduleJson] = useState("");
  const [scheduleReplace, setScheduleReplace] = useState(true);
  const [simTimeIso, setSimTimeIso] = useState("2026-06-10T19:57:00Z");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [deleteBetsConfirmText, setDeleteBetsConfirmText] = useState("");
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmailRow[]>([]);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteNote, setNewInviteNote] = useState("");
  const [loadingAction, setLoadingAction] = useState<ActionKey | null>(null);

  const isLoading = (k: ActionKey) => loadingAction === k;

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) {
      router.replace("/");
      return;
    }
    const [u, p, allowed] = await Promise.all([
      fetchMe(),
      apiFetch<Pool>("/pool"),
      apiFetch<AllowedEmailRow[]>("/admin/allowed-emails"),
    ]);
    if (!u.is_admin) {
      router.replace("/");
      return;
    }
    setMe(u);
    setPool(p);
    setAllowedEmails(allowed);
    setPoolInput(String(p.pool_total_usd ?? 0));
  }, [router]);

  useEffect(() => {
    void load().catch((e) => {
      toast.error(e instanceof Error ? e.message : "Error al cargar el panel de admin");
      router.replace("/");
    });
  }, [load, router]);

  async function addAllowedEmail() {
    const email = newInviteEmail.trim();
    if (!email) {
      toast.error("Ingresa un correo.");
      return;
    }
    setLoadingAction("add_allowed");
    try {
      const row = await apiFetch<AllowedEmailRow>("/admin/allowed-emails", {
        method: "POST",
        body: JSON.stringify({ email, note: newInviteNote.trim() || null }),
      });
      setAllowedEmails((prev) => {
        const next = prev.filter((r) => r.email !== row.email);
        return [...next, row].sort((a, b) => a.email.localeCompare(b.email));
      });
      setNewInviteEmail("");
      setNewInviteNote("");
      toast.success("Invitado agregado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo agregar");
    } finally {
      setLoadingAction(null);
    }
  }

  async function removeAllowedEmail(email: string) {
    if (!window.confirm(`¿Quitar acceso a ${email}?`)) return;
    setLoadingAction("remove_allowed");
    try {
      await apiFetch(`/admin/allowed-emails/${encodeURIComponent(email)}`, { method: "DELETE" });
      setAllowedEmails((prev) => prev.filter((r) => r.email !== email));
      toast.success("Acceso revocado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo quitar");
    } finally {
      setLoadingAction(null);
    }
  }

  async function savePool() {
    const n = parseInt(poolInput, 10);
    if (Number.isNaN(n) || n < 0) {
      toast.error("El total del pozo debe ser un entero no negativo.");
      return;
    }
    setLoadingAction("save_pool");
    try {
      const p = await apiFetch<Pool>("/admin/pool", { method: "PUT", body: JSON.stringify({ pool_total: n }) });
      setPool(p);
      toast.success("Pozo actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el pozo");
    } finally {
      setLoadingAction(null);
    }
  }

  async function loadSchedule() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(scheduleJson);
    } catch {
      toast.error("JSON del calendario inválido.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || !("matches" in parsed)) {
      toast.error('El JSON debe ser { "name": "...", "matches": [ ... ] }');
      return;
    }
    if (!window.confirm(scheduleReplace ? "¿Reemplazar TODOS los partidos y apuestas con este calendario?" : "¿Importar solo partidos nuevos?")) {
      return;
    }
    setLoadingAction("load_schedule");
    try {
      const body = parsed as { name?: string; matches: unknown[] };
      const r = await apiFetch<ScheduleLoadResponse>("/admin/load-schedule", {
        method: "POST",
        body: JSON.stringify({
          name: body.name ?? "World Cup 2026",
          matches: body.matches,
          replace_existing: scheduleReplace,
        }),
      });
      const errNote = r.error_count ? ` (${r.error_count} filas con error)` : "";
      toast.success(`Calendario: ${r.created} creados, ${r.skipped} omitidos, ${r.bracket_slots_updated} cupos actualizados.${errNote}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar el calendario");
    } finally {
      setLoadingAction(null);
    }
  }

  async function loadJsonMatches() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatches);
    } catch {
      toast.error("JSON inválido.");
      return;
    }
    if (!Array.isArray(parsed)) {
      toast.error("El cuerpo debe ser un arreglo JSON de partidos.");
      return;
    }
    setLoadingAction("load_json");
    try {
      const res = await apiFetch<{ created: number; skipped: number }>("/admin/load-matches", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      toast.success(`Partidos cargados: ${res.created} creados, ${res.skipped} omitidos.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar los partidos");
    } finally {
      setLoadingAction(null);
    }
  }

  async function loadCsv(file: File | null) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setLoadingAction("load_csv");
    try {
      const res = await apiPostMultipart<{ created: number; skipped: number; errors: { row: number; message: string }[] }>(
        "/admin/load-matches-csv",
        form,
      );
      const emsg = res.errors.length ? ` Errores: ${res.errors.map((e) => `fila ${e.row}: ${e.message}`).join("; ")}` : "";
      toast.success(`CSV cargado: ${res.created} creados, ${res.skipped} omitidos.${emsg}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar el CSV");
    } finally {
      setLoadingAction(null);
    }
  }

  async function setSimulatedClock() {
    const raw = simTimeIso.trim();
    if (!raw) {
      toast.error("Ingresa una hora ISO primero.");
      return;
    }
    setLoadingAction("simulate_time");
    try {
      const r = await apiFetch<ServerTimeResponse>("/admin/simulate-time", {
        method: "POST",
        body: JSON.stringify({ current_time: raw }),
      });
      toast.success(`Reloj simulado: ${r.now}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo configurar el reloj simulado");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetSimulatedClock() {
    setLoadingAction("reset_time");
    try {
      const r = await apiFetch<ServerTimeResponse>("/admin/reset-time", { method: "POST", body: JSON.stringify({}) });
      toast.success(`Reloj restablecido: ${r.now}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restablecer el reloj");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetSimulation() {
    setLoadingAction("reset_sim");
    try {
      const r = await apiFetch<ResetSimulationResponse>("/admin/reset-simulation", { method: "POST", body: JSON.stringify({}) });
      toast.success(`Simulación reiniciada: ${r.bets_deleted_new} eliminadas, ${r.bets_restored} restauradas.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reiniciar la simulación");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetAllData() {
    if (resetConfirmText.trim() !== "CONFIRM RESET") {
      toast.error("Escribe CONFIRM RESET para continuar");
      return;
    }
    if (!window.confirm("¿Eliminar todas las apuestas y resetear todos los partidos?")) return;
    setLoadingAction("reset_all_data");
    try {
      const r = await apiFetch<ResetAllDataResponse>("/admin/reset-all-data", {
        method: "POST",
        body: JSON.stringify({ confirm: "CONFIRM RESET" }),
      });
      toast.success(`Datos reseteados: ${r.bets_deleted} apuestas eliminadas, ${r.matches_reset} partidos reseteados.`);
      setResetConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron resetear los datos");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetBetsOnly() {
    if (deleteBetsConfirmText.trim() !== "DELETE BETS") {
      toast.error("Escribe DELETE BETS para continuar");
      return;
    }
    if (!window.confirm("¿Eliminar todas las apuestas?")) return;
    setLoadingAction("reset_bets");
    try {
      const r = await apiFetch<ResetBetsResponse>("/admin/reset-bets", {
        method: "POST",
        body: JSON.stringify({ confirm: "DELETE BETS" }),
      });
      toast.success(`Apuestas eliminadas: ${r.bets_deleted}`);
      setDeleteBetsConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron eliminar las apuestas");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetMatchesAndBets() {
    if (deleteAllConfirmText.trim() !== "DELETE ALL") {
      toast.error("Escribe DELETE ALL para continuar");
      return;
    }
    if (!window.confirm("¿Eliminar TODOS los partidos y apuestas? Esto no se puede deshacer.")) return;
    setLoadingAction("reset_matches");
    try {
      const r = await apiFetch<ResetMatchesResponse>("/admin/reset-matches", {
        method: "POST",
        body: JSON.stringify({ confirm: "DELETE ALL" }),
      });
      toast.success(`Eliminados: ${r.matches_deleted} partidos, ${r.bets_deleted} apuestas`);
      setDeleteAllConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron eliminar los partidos");
    } finally {
      setLoadingAction(null);
    }
  }

  if (!me) {
    return <div className="min-h-screen bg-pitch px-4 py-8 text-slate-300">Cargando…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-pitch px-4 py-8 text-white">
      <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200">
          Inicio
        </Link>
        <span>›</span>
        <span className="text-slate-200">Admin</span>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="text-sm text-slate-400">Herramientas centralizadas de admin.</p>
      </header>

      <div className="space-y-6">
        <section className="rounded-xl border border-sky-500/35 bg-card p-4 space-y-3">
          <p className="font-semibold text-sky-200">Invitados (control de acceso)</p>
          <p className="text-xs text-slate-400">
            Solo los correos de esta lista pueden iniciar sesión. Agrega el Gmail de cada amigo antes de compartir el link.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
              Correo Gmail
              <input
                type="email"
                value={newInviteEmail}
                onChange={(e) => setNewInviteEmail(e.target.value)}
                placeholder="amigo@gmail.com"
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
              Nota (opcional)
              <input
                type="text"
                value={newInviteNote}
                onChange={(e) => setNewInviteNote(e.target.value)}
                placeholder="Marco"
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={isLoading("add_allowed")}
              onClick={() => void addAllowedEmail()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isLoading("add_allowed") ? "Agregando…" : "Agregar invitado"}
            </button>
          </div>
          <ul className="divide-y divide-slate-800 rounded-lg border border-slate-700">
            {allowedEmails.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">Sin invitados cargados.</li>
            ) : (
              allowedEmails.map((row) => (
                <li key={row.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">{row.email}</p>
                    {row.note ? <p className="text-xs text-slate-500">{row.note}</p> : null}
                  </div>
                  {row.is_admin ? (
                    <span className="shrink-0 text-xs text-slate-500">Admin</span>
                  ) : (
                    <button
                      type="button"
                      disabled={isLoading("remove_allowed")}
                      onClick={() => void removeAllowedEmail(row.email)}
                      className="shrink-0 rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                    >
                      Quitar
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-primary/30 bg-card/50 p-4">
          <p className="text-base font-semibold text-primary">Gestor de partidos</p>
          <p className="mt-1 text-sm text-slate-400">Administra marcadores y estados en la página dedicada.</p>
          <Link href="/admin/matches" className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-pitch">
            Abrir gestor de partidos
          </Link>
        </section>

        <section className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <p className="font-semibold text-primary">Importar calendario del Mundial</p>
          <p className="text-xs text-slate-400">
            Pega el JSON completo ({`{ "name", "matches": [ team1, team2, date, time, group?, num? ] }`}). Los
            placeholders de eliminatoria (1A, W73…) se completan solos cuando terminen los grupos y partidos previos.
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={scheduleReplace}
              onChange={(e) => setScheduleReplace(e.target.checked)}
            />
            Reemplazar partidos y apuestas existentes primero
          </label>
          <textarea
            className="h-40 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 font-mono text-xs"
            placeholder='{"name":"World Cup 2026","matches":[...]}'
            value={scheduleJson}
            onChange={(e) => setScheduleJson(e.target.value)}
          />
          <button
            disabled={isLoading("load_schedule") || !scheduleJson.trim()}
            onClick={() => void loadSchedule()}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-pitch disabled:opacity-60"
          >
            {isLoading("load_schedule") ? "Importando…" : "Importar calendario"}
          </button>
        </section>

        <section className="rounded-xl border border-slate-700 bg-card p-4 space-y-3">
          <p className="font-semibold">Cargar partidos (simple)</p>
          <textarea
            className="h-28 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 font-mono text-xs"
            value={jsonMatches}
            onChange={(e) => setJsonMatches(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button disabled={isLoading("load_json")} onClick={() => void loadJsonMatches()} className="rounded-lg bg-slate-700 px-3 py-2 text-sm">
              {isLoading("load_json") ? "Cargando..." : "Cargar JSON"}
            </button>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={isLoading("load_csv")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                void loadCsv(f ?? null);
                e.target.value = "";
              }}
              className="text-sm text-slate-300"
            />
          </div>
        </section>

        <section className="rounded-xl border border-amber-500/25 bg-card p-4 space-y-3">
          <p className="font-semibold text-amber-200">Hora simulada</p>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm"
            value={simTimeIso}
            onChange={(e) => setSimTimeIso(e.target.value)}
            placeholder="2026-06-10T19:57:00Z"
          />
          <div className="flex flex-wrap gap-2">
            <button disabled={isLoading("simulate_time")} onClick={() => void setSimulatedClock()} className="rounded-lg bg-amber-600/80 px-3 py-2 text-sm">
              {isLoading("simulate_time") ? "Guardando..." : "Fijar hora simulada"}
            </button>
            <button disabled={isLoading("reset_time")} onClick={() => void resetSimulatedClock()} className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm">
              {isLoading("reset_time") ? "Guardando..." : "Restablecer hora"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-card p-4 space-y-3">
          <p className="font-semibold">Gestión del pozo</p>
          {pool ? <p className="text-sm text-slate-400">Pozo actual: {pool.pool_total_usd} USD</p> : null}
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={poolInput}
              onChange={(e) => setPoolInput(e.target.value)}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            />
            <button disabled={isLoading("save_pool")} onClick={() => void savePool()} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-pitch">
              {isLoading("save_pool") ? "Guardando..." : "Actualizar pozo"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-card p-4 space-y-3">
          <p className="font-semibold">Herramientas de reinicio</p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={isLoading("reset_sim")}
              onClick={() => void resetSimulation()}
              className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm"
            >
              {isLoading("reset_sim") ? "Guardando..." : "Reiniciar simulación"}
            </button>
          </div>
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-3">
            <p className="text-sm font-semibold text-danger">Zona peligrosa</p>
            <p className="mt-1 text-xs text-slate-300">
              Estas acciones eliminan datos permanentemente. Usa las cadenas de confirmación exactas.
            </p>

            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-200">Opción A — resetear partidos a programados (conservar partidos)</p>
                <input
                  className="w-full rounded-lg border border-danger/40 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="CONFIRM RESET"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                />
                <button
                  disabled={isLoading("reset_all_data")}
                  onClick={() => void resetAllData()}
                  className="w-full rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isLoading("reset_all_data") ? "Reseteando..." : "Resetear todos los datos"}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-200">Opción B — eliminar solo apuestas</p>
                <input
                  className="w-full rounded-lg border border-danger/40 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="DELETE BETS"
                  value={deleteBetsConfirmText}
                  onChange={(e) => setDeleteBetsConfirmText(e.target.value)}
                />
                <button
                  disabled={isLoading("reset_bets")}
                  onClick={() => void resetBetsOnly()}
                  className="w-full rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                >
                  {isLoading("reset_bets") ? "Eliminando..." : "Eliminar solo apuestas"}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-200">Opción C — eliminar partidos + apuestas (borrado de prueba)</p>
                <input
                  className="w-full rounded-lg border border-danger/40 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="DELETE ALL"
                  value={deleteAllConfirmText}
                  onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                />
                <button
                  disabled={isLoading("reset_matches")}
                  onClick={() => void resetMatchesAndBets()}
                  className="w-full rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isLoading("reset_matches") ? "Eliminando..." : "Eliminar partidos + apuestas"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

