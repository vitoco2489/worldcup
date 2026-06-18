"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  AdminManualBetResponse,
  AdminUserRow,
  AllowedEmailRow,
  Match,
  Pool,
  ResetAllDataResponse,
  ResetBetsResponse,
  ResetMatchesResponse,
  ResetSimulationResponse,
  ScheduleLoadResponse,
  ServerTimeResponse,
  UserMe,
  WhatsAppReminder,
} from "@/lib/api";
import { apiFetch, apiPostMultipart, fetchMe, getToken } from "@/lib/api";

const WHATSAPP_WINDOW_OPTIONS = [
  { hours: 2, label: "2 horas" },
  { hours: 6, label: "6 horas" },
  { hours: 12, label: "12 horas" },
  { hours: 24, label: "1 día" },
  { hours: 48, label: "2 días" },
  { hours: 72, label: "3 días" },
  { hours: 168, label: "7 días" },
] as const;

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
  | "remove_allowed"
  | "manual_bet";

function formatAdminMatchOption(match: Match): string {
  const when = new Date(match.start_time).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
  return `${when} · ${match.team_home} vs ${match.team_away}`;
}

function predictionFromScores(home: number, away: number): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

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
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [togglingEntryUserId, setTogglingEntryUserId] = useState<string | null>(null);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteNote, setNewInviteNote] = useState("");
  const [manualBetUserId, setManualBetUserId] = useState("");
  const [manualBetMatchId, setManualBetMatchId] = useState("");
  const [manualBetPrediction, setManualBetPrediction] = useState<"home" | "away" | "draw">("home");
  const [manualBetScoreHome, setManualBetScoreHome] = useState("");
  const [manualBetScoreAway, setManualBetScoreAway] = useState("");
  const [loadingAction, setLoadingAction] = useState<ActionKey | null>(null);
  const [whatsappReminder, setWhatsappReminder] = useState<WhatsAppReminder | null>(null);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
  const [whatsappWindowHours, setWhatsappWindowHours] = useState(2);

  const isLoading = (k: ActionKey) => loadingAction === k;

  const loadWhatsappReminder = useCallback(async (hours: number = whatsappWindowHours) => {
    setLoadingWhatsapp(true);
    try {
      const r = await apiFetch<WhatsAppReminder>(`/admin/whatsapp-reminder?hours=${hours}`);
      setWhatsappReminder(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el mensaje");
    } finally {
      setLoadingWhatsapp(false);
    }
  }, [whatsappWindowHours]);

  async function copyWhatsappMessage() {
    if (!whatsappReminder?.message) return;
    try {
      await navigator.clipboard.writeText(whatsappReminder.message);
      toast.success("Mensaje copiado — pégalo en WhatsApp");
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto manualmente.");
    }
  }

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) {
      router.replace("/");
      return;
    }
    const [u, p, allowed, users, allMatches] = await Promise.all([
      fetchMe(),
      apiFetch<Pool>("/pool"),
      apiFetch<AllowedEmailRow[]>("/admin/allowed-emails"),
      apiFetch<AdminUserRow[]>("/admin/users"),
      apiFetch<Match[]>("/matches"),
    ]);
    if (!u.is_admin) {
      router.replace("/");
      return;
    }
    setMe(u);
    setPool(p);
    setAllowedEmails(allowed);
    setAdminUsers(users);
    setMatches(allMatches);
    const firstManualBetMatch = allMatches.find(
      (m) => m.status !== "finished" && m.score_home == null && m.score_away == null && m.teams_resolved !== false,
    );
    setManualBetUserId((current) => current || users[0]?.id || "");
    setManualBetMatchId((current) => current || firstManualBetMatch?.id || "");
    setPoolInput(String(p.pool_total_usd ?? 0));
    await loadWhatsappReminder();
  }, [loadWhatsappReminder, router]);

  useEffect(() => {
    void load().catch((e) => {
      toast.error(e instanceof Error ? e.message : "Error al cargar el panel de admin");
      router.replace("/");
    });
  }, [load, router]);

  async function toggleEntryPaid(user: AdminUserRow) {
    setTogglingEntryUserId(user.id);
    try {
      const updated = await apiFetch<AdminUserRow>(`/admin/users/${user.id}/entry-paid`, {
        method: "PATCH",
        body: JSON.stringify({ entry_paid: !user.entry_paid }),
      });
      setAdminUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(updated.entry_paid ? `${updated.name} marcado como pagado` : `${updated.name} marcado como pendiente`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar la cuota");
    } finally {
      setTogglingEntryUserId(null);
    }
  }

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

  async function saveManualBet() {
    if (!manualBetUserId || !manualBetMatchId) {
      toast.error("Elige usuario y partido.");
      return;
    }
    const homeRaw = manualBetScoreHome.trim();
    const awayRaw = manualBetScoreAway.trim();
    let scoreHome: number | null = null;
    let scoreAway: number | null = null;
    let prediction = manualBetPrediction;
    if (homeRaw !== "" || awayRaw !== "") {
      if (homeRaw === "" || awayRaw === "") {
        toast.error("Ingresa ambos marcadores o déjalos vacíos.");
        return;
      }
      const h = Number.parseInt(homeRaw, 10);
      const a = Number.parseInt(awayRaw, 10);
      if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
        toast.error("Los goles deben ser enteros no negativos.");
        return;
      }
      scoreHome = h;
      scoreAway = a;
      prediction = predictionFromScores(h, a);
    }

    setLoadingAction("manual_bet");
    try {
      await apiFetch<AdminManualBetResponse>("/admin/manual-bet", {
        method: "POST",
        body: JSON.stringify({
          user_id: manualBetUserId,
          match_id: manualBetMatchId,
          prediction,
          predicted_score_home: scoreHome,
          predicted_score_away: scoreAway,
        }),
      });
      const userName = adminUsers.find((u) => u.id === manualBetUserId)?.name ?? "Usuario";
      toast.success(`Apuesta guardada para ${userName}`);
      setManualBetScoreHome("");
      setManualBetScoreAway("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la apuesta manual");
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

  const manualBetMatches = matches.filter(
    (m) => m.status !== "finished" && m.score_home == null && m.score_away == null && m.teams_resolved !== false,
  );
  const selectedManualMatch = manualBetMatches.find((m) => m.id === manualBetMatchId) ?? null;

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
        <section className="rounded-xl border border-amber-500/40 bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-200">Mensaje WhatsApp — apuestas pendientes</p>
              <p className="mt-1 text-xs text-slate-400">
                Genera un texto para copiar y enviar por WhatsApp a quienes no han apostado en partidos
                próximos (elige la ventana de tiempo).
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Ventana
                <select
                  value={whatsappWindowHours}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setWhatsappWindowHours(h);
                    void loadWhatsappReminder(h);
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                >
                  {WHATSAPP_WINDOW_OPTIONS.map((o) => (
                    <option key={o.hours} value={o.hours}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={loadingWhatsapp}
                onClick={() => void loadWhatsappReminder(whatsappWindowHours)}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                {loadingWhatsapp ? "Actualizando…" : "Actualizar"}
              </button>
              <button
                type="button"
                disabled={!whatsappReminder?.message}
                onClick={() => void copyWhatsappMessage()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                Copiar mensaje
              </button>
            </div>
          </div>

          {whatsappReminder ? (
            <>
              <ul className="text-xs text-slate-400">
                <li>
                  Ventana: {whatsappReminder.window_label}
                  {whatsappReminder.urgent_matches.length > 0 ? (
                    <>
                      {" · "}
                      {whatsappReminder.urgent_matches.length} partido
                      {whatsappReminder.urgent_matches.length === 1 ? "" : "s"}
                      {" · "}
                      {whatsappReminder.users_missing.length} sin apostar
                    </>
                  ) : null}
                </li>
              </ul>
              <textarea
                readOnly
                value={whatsappReminder.message}
                rows={Math.min(16, Math.max(6, whatsappReminder.message.split("\n").length + 1))}
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 font-mono text-xs leading-relaxed text-slate-200"
                onFocus={(e) => e.target.select()}
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">{loadingWhatsapp ? "Generando mensaje…" : "Sin datos."}</p>
          )}
        </section>

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

        <section className="rounded-xl border border-violet-500/35 bg-card p-4 space-y-3">
          <div>
            <p className="font-semibold text-violet-200">Apuesta manual para olvidadizos</p>
            <p className="mt-1 text-xs text-slate-400">
              Carga o corrige una apuesta para otro jugador. Sirve para casos avisados a tiempo: el backend no acepta
              partidos finalizados ni con marcador cargado.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Persona
              <select
                value={manualBetUserId}
                onChange={(e) => setManualBetUserId(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                {adminUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Partido
              <select
                value={manualBetMatchId}
                onChange={(e) => setManualBetMatchId(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                {manualBetMatches.length === 0 ? (
                  <option value="">Sin partidos disponibles</option>
                ) : (
                  manualBetMatches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {formatAdminMatchOption(match)}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Resultado
              <select
                value={manualBetPrediction}
                onChange={(e) => setManualBetPrediction(e.target.value as "home" | "away" | "draw")}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                <option value="home">{selectedManualMatch?.team_home ?? "Local"}</option>
                <option value="draw">Empate</option>
                <option value="away">{selectedManualMatch?.team_away ?? "Visitante"}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Goles local (opc.)
              <input
                type="number"
                min={0}
                step={1}
                value={manualBetScoreHome}
                onChange={(e) => setManualBetScoreHome(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white sm:w-32"
                placeholder="opc."
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Goles visita (opc.)
              <input
                type="number"
                min={0}
                step={1}
                value={manualBetScoreAway}
                onChange={(e) => setManualBetScoreAway(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white sm:w-32"
                placeholder="opc."
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isLoading("manual_bet") || !manualBetUserId || !manualBetMatchId}
              onClick={() => void saveManualBet()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {isLoading("manual_bet") ? "Guardando…" : "Guardar apuesta manual"}
            </button>
            <p className="text-xs text-slate-500">
              Si ingresas marcador, el 1x2 se ajusta automaticamente a esos goles.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-500/35 bg-card p-4 space-y-3">
          <p className="font-semibold text-emerald-200">Cuotas de entrada</p>
          <p className="text-xs text-slate-400">
            Marca quién pagó la cuota de la polla. Se refleja en la columna &quot;Cuota&quot; del ranking.
          </p>
          <ul className="divide-y divide-slate-800 rounded-lg border border-slate-700">
            {adminUsers.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">Sin usuarios registrados.</li>
            ) : (
              adminUsers.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    disabled={togglingEntryUserId === user.id}
                    onClick={() => void toggleEntryPaid(user)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      user.entry_paid
                        ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {togglingEntryUserId === user.id ? "…" : user.entry_paid ? "✓ Pagó" : "Pendiente"}
                  </button>
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

