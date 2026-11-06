"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, HelpCircle, Plus, Trash2 } from "lucide-react";
import { InlineAlert } from "@/app/admin/components/AdminUi";
import { AI_HELP, PROVIDER_LABELS, PROVIDER_MODELS } from "@/app/admin/constants";
import { apiFetch } from "@/app/admin/api";
import type { ExtAiModels, SiteSettings } from "@/app/admin/types";

type Row = {
  rowKey: string; // stable React key
  id: string | null; // stored entry id, null for a new row
  provider: string;
  storedProvider: string | null; // provider the stored key belongs to
  model: string; // "" = automatic
  apiKey: string; // never pre-filled
  showKey: boolean;
  models: ExtAiModels | null;
  loadingModels: boolean;
};

const selectClass =
  "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50";
const iconButtonClass =
  "p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition";

let rowCounter = 0;
const newRowKey = () => `row-${++rowCounter}`;

function rowsFromSettings(settings: SiteSettings | null): Row[] {
  return (settings?.ext_ai_providers ?? []).map((p) => ({
    rowKey: newRowKey(),
    id: p.id,
    provider: p.provider,
    storedProvider: p.provider,
    model: p.model ?? "",
    apiKey: "",
    showKey: false,
    models: null,
    loadingModels: false,
  }));
}

export default function ExtAiProviderList({
  settings,
  onSaved,
  onShowHelp,
}: {
  settings: SiteSettings | null;
  onSaved: (updated: SiteSettings) => void;
  onShowHelp: (provider: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => rowsFromSettings(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const modelRequests = useRef<Record<string, number>>({});

  const patchRow = useCallback((rowKey: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  }, []);

  const loadModels = useCallback(
    async (row: Pick<Row, "rowKey" | "id" | "provider" | "storedProvider">, apiKey: string) => {
      const requestId = (modelRequests.current[row.rowKey] ?? 0) + 1;
      modelRequests.current[row.rowKey] = requestId;
      const canUseStoredKey = row.id && row.storedProvider === row.provider;
      if (!row.provider || (!apiKey && !canUseStoredKey)) {
        patchRow(row.rowKey, { models: null, loadingModels: false });
        return;
      }
      patchRow(row.rowKey, { models: null, loadingModels: true });
      const body: Record<string, string> = { provider: row.provider };
      if (apiKey) body.api_key = apiKey;
      else if (row.id) body.entry_id = row.id;
      let result: ExtAiModels | null = null;
      try {
        result = await apiFetch("/api/admin/ext-ai/models", { method: "POST", body: JSON.stringify(body) });
      } catch {
        // Not critical: the built-in model list is shown instead.
      }
      if (modelRequests.current[row.rowKey] === requestId) {
        patchRow(row.rowKey, { models: result, loadingModels: false });
      }
    },
    [patchRow],
  );

  // Reset the rows whenever the stored configuration changes (load / save).
  useEffect(() => {
    const fresh = rowsFromSettings(settings);
    setRows(fresh);
    fresh.forEach((r) => loadModels(r, ""));
  }, [settings, loadModels]);

  function changed(rowKey: string, patch: Partial<Row>) {
    setSuccess(false);
    patchRow(rowKey, patch);
  }

  function addRow() {
    setSuccess(false);
    const used = new Set(rows.map((r) => r.provider));
    const provider = ["gemini", "anthropic", "openai"].find((p) => !used.has(p)) ?? "openai";
    setRows((rs) => [
      ...rs,
      {
        rowKey: newRowKey(),
        id: null,
        provider,
        storedProvider: null,
        model: "",
        apiKey: "",
        showKey: false,
        models: null,
        loadingModels: false,
      },
    ]);
  }

  function moveRow(index: number, delta: number) {
    setSuccess(false);
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row);
      return next;
    });
  }

  async function save(providers: Row[]) {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const updated: SiteSettings = await apiFetch("/api/admin/ext-ai/providers", {
        method: "PUT",
        body: JSON.stringify({
          providers: providers.map((r) => ({
            id: r.id,
            provider: r.provider,
            model: r.model,
            ...(r.apiKey ? { api_key: r.apiKey } : {}),
          })),
        }),
      });
      onSaved(updated);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  function removeAll() {
    if (!confirm("Alle externen KIs entfernen?")) return;
    save([]);
  }

  const hasStored = (settings?.ext_ai_providers?.length ?? 0) > 0;

  return (
    <div className="p-4 space-y-3">

      {rows.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Keine externe KI eingerichtet – der Import nutzt die lokale KI.
        </p>
      )}
      {rows.length > 1 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Die KIs werden der Reihe nach verwendet. Schlägt eine fehl, übernimmt automatisch die nächste.
        </p>
      )}

      {rows.map((row, index) => {
        const options = row.models?.models.length
          ? row.models.models.map((m) => ({
              value: m.id,
              label: m.label === m.id ? m.id : `${m.label} (${m.id})`,
            }))
          : PROVIDER_MODELS[row.provider] ?? [];
        const keyStored = Boolean(row.id) && row.storedProvider === row.provider;
        return (
          <div
            key={row.rowKey}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 w-6 shrink-0">
                {index + 1}.
              </span>
              <select
                aria-label={`Anbieter ${index + 1}`}
                value={row.provider}
                onChange={(e) => {
                  const provider = e.target.value;
                  changed(row.rowKey, { provider, model: "" });
                  loadModels({ ...row, provider }, row.apiKey);
                }}
                className={selectClass}
              >
                {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {AI_HELP[row.provider] && (
                <button
                  type="button"
                  onClick={() => onShowHelp(row.provider)}
                  title="Hilfe: API-Schlüssel erstellen"
                  className={iconButtonClass}
                >
                  <HelpCircle size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => moveRow(index, -1)}
                disabled={index === 0}
                title="Nach oben (früher verwenden)"
                className={iconButtonClass}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveRow(index, 1)}
                disabled={index === rows.length - 1}
                title="Nach unten (später verwenden)"
                className={iconButtonClass}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setRows((rs) => rs.filter((r) => r.rowKey !== row.rowKey));
                }}
                title="Diese KI entfernen"
                className={`${iconButtonClass} hover:!text-red-500`}
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Modell</label>
              <select
                value={row.model}
                onChange={(e) => changed(row.rowKey, { model: e.target.value })}
                className={selectClass}
              >
                <option value="">
                  Automatisch (empfohlen){row.models?.auto_model ? ` – ${row.models.auto_model}` : ""}
                </option>
                {options.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
                {row.model && !options.find((m) => m.value === row.model) && (
                  <option value={row.model}>{row.model} (gespeichert)</option>
                )}
              </select>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {row.loadingModels
                  ? "Verfügbare Modelle werden geladen…"
                  : row.models?.error
                    ? row.models.error
                    : row.model
                      ? "Fest eingestelltes Modell – wird nicht automatisch aktualisiert."
                      : "Das empfohlene Modell wird automatisch gewählt und bei neuen Modellen aktualisiert."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                API-Schlüssel
                {keyStored && <span className="ml-2 text-green-600 dark:text-green-400">(gespeichert)</span>}
              </label>
              <div className="relative">
                <input
                  type={row.showKey ? "text" : "password"}
                  value={row.apiKey}
                  onChange={(e) => changed(row.rowKey, { apiKey: e.target.value })}
                  onBlur={() => {
                    if (row.apiKey) loadModels(row, row.apiKey);
                  }}
                  placeholder={keyStored ? "Leer lassen, um gespeicherten Schlüssel zu behalten" : "API-Schlüssel eingeben"}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => patchRow(row.rowKey, { showKey: !row.showKey })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {row.showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        disabled={rows.length >= 10}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-600 disabled:opacity-50 transition"
      >
        <Plus size={15} />
        {rows.length === 0 ? "Externe KI hinzufügen" : "Weitere KI als Ausweichlösung hinzufügen"}
      </button>

      {error && <InlineAlert tone="error" message={error} onClose={() => setError(null)} />}
      {success && <InlineAlert tone="success" message="Externe KIs gespeichert." />}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => save(rows)}
          disabled={saving}
          className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-medium transition"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        {hasStored && (
          <button
            onClick={removeAll}
            disabled={saving}
            title="Alle externen KIs entfernen"
            className="px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-red-500 disabled:opacity-50 transition"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
