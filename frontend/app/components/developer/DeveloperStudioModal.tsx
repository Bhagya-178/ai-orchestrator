"use client";

import { useState, useEffect } from "react";
import {
  X,
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  Send,
  AlertCircle,
  Clock,
  ShieldCheck,
  Activity,
  Lock,
  ArrowRight,
  Shield,
} from "lucide-react";
import { useAuth } from "@/app/lib/context/AuthContext";
import {
  ApiKeyItem,
  CreateApiKeyResult,
  WebhookItem,
  WebhookDeliveryItem,
} from "@/app/lib/types";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  getAvailableScopes,
  listWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  getSupportedWebhookEvents,
} from "@/app/lib/api/developer";

interface DeveloperStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeveloperStudioModal({ isOpen, onClose }: DeveloperStudioModalProps) {
  const { isAuthenticated, setShowAuthModal, setAuthModalMode } = useAuth();
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks">("keys");

  // API Keys state
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["chat:read", "chat:write"]);
  const [newKeyPrefix, setNewKeyPrefix] = useState<"ak_live" | "ak_test">("ak_live");
  const [createdKeyResult, setCreatedKeyResult] = useState<CreateApiKeyResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [supportedEvents, setSupportedEvents] = useState<string[]>([]);
  const [isCreateWebhookOpen, setIsCreateWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDesc, setWebhookDesc] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["workflow.completed"]);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [selectedWebhookDeliveries, setSelectedWebhookDeliveries] = useState<{
    id: string;
    items: WebhookDeliveryItem[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadData();
    }
  }, [isOpen, activeTab, isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "keys") {
        const [kList, sList] = await Promise.all([listApiKeys(), getAvailableScopes()]);
        setKeys(kList);
        setAvailableScopes(sList);
      } else {
        const [wList, eList] = await Promise.all([listWebhooks(), getSupportedWebhookEvents()]);
        setWebhooks(wList);
        setSupportedEvents(eList);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load developer platform data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await createApiKey({
        name: newKeyName.trim(),
        scopes: newKeyScopes,
        prefix: newKeyPrefix,
      });
      setCreatedKeyResult(res);
      setIsCreateKeyOpen(false);
      setNewKeyName("");
      loadData();
    } catch (e: any) {
      alert(`Failed to create API key: ${e.message}`);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm("Are you sure you want to permanently revoke this API key?")) return;
    try {
      await revokeApiKey(id);
      loadData();
    } catch (e: any) {
      alert(`Failed to revoke key: ${e.message}`);
    }
  };

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim()) return;
    try {
      await createWebhook({
        url: webhookUrl.trim(),
        events: webhookEvents,
        description: webhookDesc.trim(),
      });
      setIsCreateWebhookOpen(false);
      setWebhookUrl("");
      setWebhookDesc("");
      loadData();
    } catch (e: any) {
      alert(`Failed to create webhook: ${e.message}`);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    try {
      await deleteWebhook(id);
      loadData();
    } catch (e: any) {
      alert(`Failed to delete webhook: ${e.message}`);
    }
  };

  const handleTestPing = async (id: string) => {
    setTestingWebhookId(id);
    try {
      const res = await testWebhook(id);
      alert(`Ping sent! HTTP Status: ${res.status_code || "Error"} (${res.duration_ms.toFixed(0)}ms)`);
    } catch (e: any) {
      alert(`Test ping failed: ${e.message}`);
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleViewDeliveries = async (id: string) => {
    try {
      const list = await getWebhookDeliveries(id);
      setSelectedWebhookDeliveries({ id, items: list });
    } catch (e: any) {
      alert(`Failed to fetch deliveries: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-4xl h-[80vh] bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Developer Studio & Integrations
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage cryptographically hashed API keys and HMAC-signed webhook subscriptions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        {!isAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-transparent to-black/5 dark:to-white/5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5" />
              Enterprise Feature
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Developer Platform — Sign In Required
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mb-6 leading-relaxed">
              Programmatic API keys with granular scopes and HMAC-SHA256 authenticated Webhook callbacks require an active user account.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full mb-8 text-left text-xs">
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-start gap-2.5">
                <Key className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Scoped API Keys</div>
                  <div className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">Integrate LLM orchestration directly into external services with rate limiting.</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-start gap-2.5">
                <Webhook className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Event Webhooks</div>
                  <div className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">Subscribe to workflow.completed and document.indexed events via signed HTTP POSTs.</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setAuthModalMode("login");
                  setShowAuthModal(true);
                  onClose();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-all"
              >
                Sign In to Access
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setAuthModalMode("register");
                  setShowAuthModal(true);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-all"
              >
                Create Free Account
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigator */}
            <div className="flex items-center gap-2 px-6 py-2.5 border-b border-[var(--border)] bg-[var(--card)]/30">
              <button
                onClick={() => setActiveTab("keys")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "keys"
                    ? "bg-emerald-600 text-white"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>API Keys</span>
              </button>
              <button
                onClick={() => setActiveTab("webhooks")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "webhooks"
                    ? "bg-emerald-600 text-white"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Webhook className="w-3.5 h-3.5" />
                <span>Webhooks</span>
              </button>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-auto p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

          {/* API Keys Tab */}
          {activeTab === "keys" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active API Keys</h3>
                  <p className="text-xs text-gray-500">Keys are authenticated via the X-API-Key header.</p>
                </div>
                <button
                  onClick={() => setIsCreateKeyOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create API Key</span>
                </button>
              </div>

              {keys.length === 0 ? (
                <div className="p-8 border border-dashed border-[var(--border)] rounded-xl text-center text-xs text-gray-400">
                  No active API keys found. Create one to access the platform programmatically.
                </div>
              ) : (
                <div className="space-y-2">
                  {keys.map((k) => (
                    <div
                      key={k.id}
                      className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">{k.name}</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                            {k.key_prefix}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {k.scopes.map((s) => (
                            <span
                              key={s}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === "webhooks" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Webhook Subscriptions</h3>
                  <p className="text-xs text-gray-500">Signed with HMAC-SHA256 in X-Orchestrator-Signature header.</p>
                </div>
                <button
                  onClick={() => setIsCreateWebhookOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Endpoint</span>
                </button>
              </div>

              {webhooks.length === 0 ? (
                <div className="p-8 border border-dashed border-[var(--border)] rounded-xl text-center text-xs text-gray-400">
                  No webhook endpoints configured.
                </div>
              ) : (
                <div className="space-y-2">
                  {webhooks.map((w) => (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-mono font-semibold text-gray-900 dark:text-white">
                          {w.url}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{w.description || "No description"}</div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {w.events.map((ev) => (
                            <span
                              key={ev}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-mono"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestPing(w.id)}
                          disabled={testingWebhookId === w.id}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-[var(--border)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <Send className={`w-3 h-3 ${testingWebhookId === w.id ? "animate-spin" : ""}`} />
                          <span>Test Ping</span>
                        </button>
                        <button
                          onClick={() => handleViewDeliveries(w.id)}
                          className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        >
                          Logs
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(w.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create API Key Modal */}
        {isCreateKeyOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-md bg-[var(--background)] border border-[var(--border)] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold">Generate New API Key</h3>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Key Name / Label</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production Pipeline Worker"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs bg-transparent"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Key Environment</label>
                <select
                  value={newKeyPrefix}
                  onChange={(e) => setNewKeyPrefix(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs bg-[var(--background)]"
                >
                  <option value="ak_live">Live / Production (ak_live_...)</option>
                  <option value="ak_test">Test / Sandbox (ak_test_...)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsCreateKeyOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateApiKey}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg"
                >
                  Generate Key
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reveal Secret Modal */}
        {createdKeyResult && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
            <div className="w-full max-w-md bg-[var(--background)] border border-emerald-500 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                <ShieldCheck className="w-5 h-5" />
                <span>API Key Generated Successfully</span>
              </div>
              <p className="text-xs text-gray-500">
                Please copy your API key now. You will not be able to see it again!
              </p>
              <div className="p-3 rounded-lg bg-black/10 dark:bg-black/40 border border-[var(--border)] font-mono text-xs break-all flex items-center justify-between">
                <span>{createdKeyResult.raw_key}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdKeyResult.raw_key);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded ml-2"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={() => setCreatedKeyResult(null)}
                className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Register Webhook Modal */}
        {isCreateWebhookOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-md bg-[var(--background)] border border-[var(--border)] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold">Register Webhook Endpoint</h3>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Endpoint URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.yourdomain.com/webhooks"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs bg-transparent"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Description</label>
                <input
                  type="text"
                  value={webhookDesc}
                  onChange={(e) => setWebhookDesc(e.target.value)}
                  placeholder="e.g., Slack Alert Bridge"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs bg-transparent"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsCreateWebhookOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWebhook}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg"
                >
                  Register
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
