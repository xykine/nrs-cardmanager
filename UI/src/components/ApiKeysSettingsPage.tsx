import { FormEvent, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { ApiKey, ApiKeyCreated } from "../types";
import { apiKeyService } from "../services/api";

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ApiKeysSettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [keyBannerTitle, setKeyBannerTitle] = useState("created");
  const [copied, setCopied] = useState(false);

  const loadKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiKeyService.list();
      setKeys(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const showNewKey = (created: ApiKeyCreated, title: "created" | "regenerated") => {
    setCreatedKey(created);
    setKeyBannerTitle(title);
    setCopied(false);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    setError(null);
    try {
      const created = await apiKeyService.create(trimmed);
      showNewKey(created, "created");
      setName("");
      await loadKeys();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm("Revoke this API key? Customers using it will lose access.")) {
      return;
    }
    setActionId(id);
    setError(null);
    try {
      await apiKeyService.revoke(id);
      await loadKeys();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setActionId(null);
    }
  };

  const handleReactivate = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await apiKeyService.reactivate(id);
      await loadKeys();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to reactivate API key");
    } finally {
      setActionId(null);
    }
  };

  const handleRegenerate = async (id: string, nameLabel: string) => {
    if (
      !window.confirm(
        `Regenerate the API key for “${nameLabel}”? The previous key will stop working immediately.`,
      )
    ) {
      return;
    }
    setActionId(id);
    setError(null);
    try {
      const created = await apiKeyService.regenerate(id);
      showNewKey(created, "regenerated");
      await loadKeys();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to regenerate API key");
    } finally {
      setActionId(null);
    }
  };

  const handleCopy = async () => {
    if (!createdKey?.key) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">API Keys</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create customer API keys for the QR decode endpoint. Keys are shown only once at creation or regeneration.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {createdKey && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                API key for “{createdKey.name}” {keyBannerTitle}
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Copy this key now. You will not be able to see it again.
              </p>
              <code className="mt-3 block break-all rounded-md bg-white border border-amber-200 px-3 py-2 text-sm text-slate-800 font-mono">
                {createdKey.key}
              </code>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy key"}
            </button>
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
      >
        <label className="block text-sm font-medium text-slate-700" htmlFor="api-key-name">
          Customer / integration name
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="api-key-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Scanner"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creating…" : "Create API key"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Existing keys</h2>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-sm text-slate-500">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">No API keys yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Prefix</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((key) => {
                  const busy = actionId === key.id;
                  return (
                    <tr key={key.id} className="text-slate-700">
                      <td className="px-4 py-3 font-medium text-slate-900">{key.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{key.keyPrefix}…</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(key.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(key.lastUsedAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            key.isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {key.isActive ? "Active" : "Revoked"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {key.isActive ? (
                            <button
                              type="button"
                              onClick={() => handleRevoke(key.id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {busy ? "…" : "Revoke"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivate(key.id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              {busy ? "…" : "Reactivate"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRegenerate(key.id, key.name)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {busy ? "…" : "Regenerate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">Customer usage</p>
        <p>
          <span className="font-medium">POST</span>{" "}
          <code className="font-mono">/api/cards/qr/decode</code>
        </p>
        <p>
          Header: <code className="font-mono">X-API-Key: &lt;your-key&gt;</code>
        </p>
        <p>
          Body: <code className="font-mono">{`{ "token": "<qr-token>" }`}</code>
        </p>
      </div>
      </div>
    </div>
  );
}
