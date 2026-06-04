"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
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
  | "load_schedule";

const ADMIN_EMAIL = "vitoco2489@gmail.com";

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
  const [loadingAction, setLoadingAction] = useState<ActionKey | null>(null);

  const isLoading = (k: ActionKey) => loadingAction === k;

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) {
      router.replace("/");
      return;
    }
    const [u, p] = await Promise.all([fetchMe(), apiFetch<Pool>("/pool")]);
    if (u.email.toLowerCase() !== ADMIN_EMAIL) {
      router.replace("/");
      return;
    }
    setMe(u);
    setPool(p);
    setPoolInput(String(p.pool_total_usd ?? 0));
  }, [router]);

  useEffect(() => {
    void load().catch((e) => {
      toast.error(e instanceof Error ? e.message : "Failed to load admin page");
      router.replace("/");
    });
  }, [load, router]);

  async function savePool() {
    const n = parseInt(poolInput, 10);
    if (Number.isNaN(n) || n < 0) {
      toast.error("Pool total must be a non-negative integer.");
      return;
    }
    setLoadingAction("save_pool");
    try {
      const p = await apiFetch<Pool>("/admin/pool", { method: "PUT", body: JSON.stringify({ pool_total: n }) });
      setPool(p);
      toast.success("Pool updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update pool");
    } finally {
      setLoadingAction(null);
    }
  }

  async function loadSchedule() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(scheduleJson);
    } catch {
      toast.error("Invalid schedule JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || !("matches" in parsed)) {
      toast.error('JSON must be { "name": "...", "matches": [ ... ] }');
      return;
    }
    if (!window.confirm(scheduleReplace ? "Replace ALL matches and bets with this schedule?" : "Import new matches only?")) {
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
      const errNote = r.error_count ? ` (${r.error_count} row errors)` : "";
      toast.success(`Schedule: ${r.created} created, ${r.skipped} skipped, ${r.bracket_slots_updated} slots filled.${errNote}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import schedule");
    } finally {
      setLoadingAction(null);
    }
  }

  async function loadJsonMatches() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatches);
    } catch {
      toast.error("Invalid JSON.");
      return;
    }
    if (!Array.isArray(parsed)) {
      toast.error("Body must be a JSON array of matches.");
      return;
    }
    setLoadingAction("load_json");
    try {
      const res = await apiFetch<{ created: number; skipped: number }>("/admin/load-matches", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      toast.success(`Matches loaded: ${res.created} created, ${res.skipped} skipped.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load matches");
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
      const emsg = res.errors.length ? ` Errors: ${res.errors.map((e) => `row ${e.row}: ${e.message}`).join("; ")}` : "";
      toast.success(`CSV loaded: ${res.created} created, ${res.skipped} skipped.${emsg}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load CSV");
    } finally {
      setLoadingAction(null);
    }
  }

  async function setSimulatedClock() {
    const raw = simTimeIso.trim();
    if (!raw) {
      toast.error("Set an ISO time first.");
      return;
    }
    setLoadingAction("simulate_time");
    try {
      const r = await apiFetch<ServerTimeResponse>("/admin/simulate-time", {
        method: "POST",
        body: JSON.stringify({ current_time: raw }),
      });
      toast.success(`Simulated clock set: ${r.now}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set simulated time");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetSimulatedClock() {
    setLoadingAction("reset_time");
    try {
      const r = await apiFetch<ServerTimeResponse>("/admin/reset-time", { method: "POST", body: JSON.stringify({}) });
      toast.success(`Clock reset: ${r.now}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset time");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetSimulation() {
    setLoadingAction("reset_sim");
    try {
      const r = await apiFetch<ResetSimulationResponse>("/admin/reset-simulation", { method: "POST", body: JSON.stringify({}) });
      toast.success(`Simulation reset: ${r.bets_deleted_new} deleted, ${r.bets_restored} restored.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset simulation");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetAllData() {
    if (resetConfirmText.trim() !== "CONFIRM RESET") {
      toast.error("Type CONFIRM RESET to continue");
      return;
    }
    if (!window.confirm("Delete all bets and reset all matches?")) return;
    setLoadingAction("reset_all_data");
    try {
      const r = await apiFetch<ResetAllDataResponse>("/admin/reset-all-data", {
        method: "POST",
        body: JSON.stringify({ confirm: "CONFIRM RESET" }),
      });
      toast.success(`All data reset: ${r.bets_deleted} bets deleted, ${r.matches_reset} matches reset.`);
      setResetConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset all data");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetBetsOnly() {
    if (deleteBetsConfirmText.trim() !== "DELETE BETS") {
      toast.error("Type DELETE BETS to continue");
      return;
    }
    if (!window.confirm("Delete all bets?")) return;
    setLoadingAction("reset_bets");
    try {
      const r = await apiFetch<ResetBetsResponse>("/admin/reset-bets", {
        method: "POST",
        body: JSON.stringify({ confirm: "DELETE BETS" }),
      });
      toast.success(`Bets deleted: ${r.bets_deleted}`);
      setDeleteBetsConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete bets");
    } finally {
      setLoadingAction(null);
    }
  }

  async function resetMatchesAndBets() {
    if (deleteAllConfirmText.trim() !== "DELETE ALL") {
      toast.error("Type DELETE ALL to continue");
      return;
    }
    if (!window.confirm("Delete ALL matches and bets? This cannot be undone.")) return;
    setLoadingAction("reset_matches");
    try {
      const r = await apiFetch<ResetMatchesResponse>("/admin/reset-matches", {
        method: "POST",
        body: JSON.stringify({ confirm: "DELETE ALL" }),
      });
      toast.success(`Deleted: ${r.matches_deleted} matches, ${r.bets_deleted} bets`);
      setDeleteAllConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete matches");
    } finally {
      setLoadingAction(null);
    }
  }

  if (!me) {
    return <div className="min-h-screen bg-pitch px-4 py-8 text-slate-300">Loading…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-pitch px-4 py-8 text-white">
      <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200">
          Dashboard
        </Link>
        <span>›</span>
        <span className="text-slate-200">Admin</span>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-slate-400">Centralized admin tools.</p>
      </header>

      <div className="space-y-6">
        <section className="rounded-xl border border-primary/30 bg-card/50 p-4">
          <p className="text-base font-semibold text-primary">Match Manager</p>
          <p className="mt-1 text-sm text-slate-400">Manage scores and statuses on the dedicated page.</p>
          <Link href="/admin/matches" className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-pitch">
            Open Match Manager
          </Link>
        </section>

        <section className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <p className="font-semibold text-primary">Import World Cup schedule</p>
          <p className="text-xs text-slate-400">
            Paste the full JSON ({`{ "name", "matches": [ team1, team2, date, time, group?, num? ] }`}). Knockout
            placeholders (1A, W73…) fill automatically when group results and prior games finish.
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={scheduleReplace}
              onChange={(e) => setScheduleReplace(e.target.checked)}
            />
            Replace existing matches and bets first
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
            {isLoading("load_schedule") ? "Importing…" : "Import schedule"}
          </button>
        </section>

        <section className="rounded-xl border border-slate-700 bg-card p-4 space-y-3">
          <p className="font-semibold">Load Matches (simple)</p>
          <textarea
            className="h-28 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 font-mono text-xs"
            value={jsonMatches}
            onChange={(e) => setJsonMatches(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button disabled={isLoading("load_json")} onClick={() => void loadJsonMatches()} className="rounded-lg bg-slate-700 px-3 py-2 text-sm">
              {isLoading("load_json") ? "Loading..." : "Load JSON"}
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
          <p className="font-semibold text-amber-200">Simulated Time</p>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm"
            value={simTimeIso}
            onChange={(e) => setSimTimeIso(e.target.value)}
            placeholder="2026-06-10T19:57:00Z"
          />
          <div className="flex flex-wrap gap-2">
            <button disabled={isLoading("simulate_time")} onClick={() => void setSimulatedClock()} className="rounded-lg bg-amber-600/80 px-3 py-2 text-sm">
              {isLoading("simulate_time") ? "Saving..." : "Set Simulated Time"}
            </button>
            <button disabled={isLoading("reset_time")} onClick={() => void resetSimulatedClock()} className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm">
              {isLoading("reset_time") ? "Saving..." : "Reset Time"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-card p-4 space-y-3">
          <p className="font-semibold">Pool Management</p>
          {pool ? <p className="text-sm text-slate-400">Current pool: {pool.pool_total_usd} USD</p> : null}
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={poolInput}
              onChange={(e) => setPoolInput(e.target.value)}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            />
            <button disabled={isLoading("save_pool")} onClick={() => void savePool()} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-pitch">
              {isLoading("save_pool") ? "Saving..." : "Update Pool"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-card p-4 space-y-3">
          <p className="font-semibold">Reset Tools</p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={isLoading("reset_sim")}
              onClick={() => void resetSimulation()}
              className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm"
            >
              {isLoading("reset_sim") ? "Saving..." : "Reset Simulation"}
            </button>
          </div>
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-3">
            <p className="text-sm font-semibold text-danger">Danger Zone</p>
            <p className="mt-1 text-xs text-slate-300">
              These actions permanently delete data. Use the exact confirmation strings to proceed.
            </p>

            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-200">Option A — reset matches to scheduled (keep matches)</p>
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
                  {isLoading("reset_all_data") ? "Resetting..." : "Reset All Data"}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-200">Option B — delete bets only</p>
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
                  {isLoading("reset_bets") ? "Deleting..." : "Reset Bets Only"}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-200">Option C — delete matches + bets (test wipe)</p>
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
                  {isLoading("reset_matches") ? "Deleting..." : "Reset Matches + Bets"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

