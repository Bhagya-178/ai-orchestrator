"use client";

import { useState, useEffect } from "react";
import {
  X,
  Moon,
  Sun,
  Monitor,
  Trash2,
  FileText,
  Loader2,
  Cpu,
  Check,
  Sparkles,
  Key,
  Cloud,
  Plus,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Activity,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "@/app/lib/context/ThemeContext";
import { listDocuments, deleteDocument } from "@/app/lib/api/documents";
import { UploadedDocument } from "@/app/lib/types";
import { useChat } from "@/app/lib/context/ChatContext";
import { getModelDetails, ModelDetail } from "@/app/lib/api/health";
import {
  CustomModel,
  listCustomModels,
  createCustomModel,
  updateCustomModel,
  deleteCustomModel,
  testCustomModel,
  TestConnectionResponse,
} from "@/app/lib/api/customModels";

const PROVIDER_PRESETS = [
  {
    provider: "anthropic",
    label: "Anthropic Claude",
    badge: "Claude",
    defaultName: "Claude 3.5 Sonnet",
    defaultModelId: "claude-3-5-sonnet-20241022",
    apiBasePlaceholder: "https://api.anthropic.com",
    keyPlaceholder: "sk-ant-api03-...",
    color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40",
  },
  {
    provider: "openai",
    label: "OpenAI",
    badge: "OpenAI",
    defaultName: "GPT-4o",
    defaultModelId: "gpt-4o",
    apiBasePlaceholder: "https://api.openai.com/v1",
    keyPlaceholder: "sk-proj-...",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40",
  },
  {
    provider: "groq",
    label: "Groq (Ultra-Fast)",
    badge: "Groq",
    defaultName: "Groq Llama 3.3 70B",
    defaultModelId: "llama-3.3-70b-versatile",
    apiBasePlaceholder: "https://api.groq.com/openai/v1",
    keyPlaceholder: "gsk_...",
    color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/40",
  },
  {
    provider: "deepseek",
    label: "DeepSeek",
    badge: "DeepSeek",
    defaultName: "DeepSeek-V3",
    defaultModelId: "deepseek-chat",
    apiBasePlaceholder: "https://api.deepseek.com",
    keyPlaceholder: "sk-...",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40",
  },
  {
    provider: "gemini",
    label: "Google Gemini",
    badge: "Gemini",
    defaultName: "Gemini 1.5 Pro",
    defaultModelId: "gemini-1.5-pro-latest",
    apiBasePlaceholder: "https://generativelanguage.googleapis.com",
    keyPlaceholder: "AIzaSy...",
    color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/40",
  },
  {
    provider: "openrouter",
    label: "OpenRouter",
    badge: "OpenRouter",
    defaultName: "OpenRouter Claude 3.5",
    defaultModelId: "anthropic/claude-3.5-sonnet",
    apiBasePlaceholder: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-v1-...",
    color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40",
  },
  {
    provider: "custom",
    label: "Custom / vLLM / Ollama Remote",
    badge: "Custom",
    defaultName: "Custom LLM Endpoint",
    defaultModelId: "model-name",
    apiBasePlaceholder: "https://api.your-domain.com/v1",
    keyPlaceholder: "sk-...",
    color: "text-gray-600 bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/40",
  },
];

export default function SettingsModal({
  isOpen,
  onClose,
  defaultTab = "appearance",
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "appearance" | "providers" | "models" | "files";
}) {
  const [activeTab, setActiveTab] = useState<"appearance" | "providers" | "models" | "files">(defaultTab);
  const { theme, setTheme } = useTheme();

  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [modelDetails, setModelDetails] = useState<ModelDetail[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Custom BYOK Models state
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newProvider, setNewProvider] = useState("anthropic");
  const [newName, setNewName] = useState("Claude 3.5 Sonnet");
  const [newModelId, setNewModelId] = useState("claude-3-5-sonnet-20241022");
  const [newApiKey, setNewApiKey] = useState("");
  const [newApiBase, setNewApiBase] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { currentConversationId, intentOverride, setIntentOverride, updateSettings } = useChat();

  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      const details = await getModelDetails();
      setModelDetails(details);
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const loadCustomModels = async () => {
    setIsLoadingCustom(true);
    try {
      const cms = await listCustomModels();
      setCustomModels(cms);
    } catch (err) {
      console.error("Failed to load custom models:", err);
    } finally {
      setIsLoadingCustom(false);
    }
  };

  const loadDocs = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await listDocuments(currentConversationId);
      setDocuments(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "providers") {
        loadCustomModels();
      } else if (activeTab === "models") {
        loadModels();
      } else if (activeTab === "files") {
        loadDocs();
      }
    }
  }, [isOpen, activeTab, currentConversationId]);

  // Handle external open-settings event
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.tab) {
        setActiveTab(ce.detail.tab);
      }
    };
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

  const handleSelectPreset = (preset: typeof PROVIDER_PRESETS[0]) => {
    setNewProvider(preset.provider);
    setNewName(preset.defaultName);
    setNewModelId(preset.defaultModelId);
    setNewApiBase("");
    setTestResult(null);
    setSaveError(null);
  };

  const handleTestConnection = async () => {
    if (!newApiKey.trim()) {
      setTestResult({ success: false, error: "Please enter an API key first." });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testCustomModel({
        provider: newProvider,
        model_id: newModelId.trim(),
        api_key: newApiKey.trim(),
        api_base: newApiBase.trim() || undefined,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || "Connection failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCustomModel = async () => {
    if (!newName.trim() || !newModelId.trim() || !newApiKey.trim()) {
      setSaveError("Name, Model ID, and API Key are all required.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await createCustomModel({
        name: newName.trim(),
        provider: newProvider,
        model_id: newModelId.trim(),
        api_key: newApiKey.trim(),
        api_base: newApiBase.trim() || undefined,
        is_active: true,
      });
      setNewApiKey("");
      setTestResult(null);
      setIsAddingCustom(false);
      await loadCustomModels();
      // Notify other components (ChatComposer) to refresh model list
      window.dispatchEvent(new Event("models-updated"));
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save model.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (model: CustomModel) => {
    try {
      await updateCustomModel(model.id, { is_active: !model.is_active });
      setCustomModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, is_active: !m.is_active } : m))
      );
      window.dispatchEvent(new Event("models-updated"));
    } catch (err) {
      alert("Failed to update model status.");
    }
  };

  const handleDeleteCustomModel = async (id: string) => {
    if (confirm("Are you sure you want to delete this custom model configuration?")) {
      try {
        await deleteCustomModel(id);
        setCustomModels((prev) => prev.filter((m) => m.id !== id));
        if (intentOverride === `custom:${id}`) {
          setIntentOverride("auto");
          updateSettings("auto", undefined);
        }
        window.dispatchEvent(new Event("models-updated"));
      } catch (err) {
        alert("Failed to delete model.");
      }
    }
  };

  const handleDeleteFile = async (docId: string) => {
    if (confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteDocument(docId);
        setDocuments((docs) => docs.filter((d) => d.id !== docId));
      } catch (err) {
        alert("Failed to delete document.");
      }
    }
  };

  if (!isOpen) return null;

  const currentPreset = PROVIDER_PRESETS.find((p) => p.provider === newProvider) || PROVIDER_PRESETS[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-[760px] bg-[var(--background)] border border-[var(--border)] shadow-[var(--shadow-lg)] rounded-2xl overflow-hidden flex flex-col md:flex-row h-[85vh] max-h-[620px] transition-all">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-[210px] border-b md:border-b-0 md:border-r border-[var(--border)] p-3 md:p-4 flex flex-row md:flex-col overflow-x-auto gap-1 bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
          <div className="hidden md:block text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2.5 px-2.5">
            Settings
          </div>

          <button
            onClick={() => setActiveTab("appearance")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-2.5 ${
              activeTab === "appearance"
                ? "bg-black/10 dark:bg-white/10 text-[var(--foreground)] font-semibold"
                : "hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)]"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Appearance</span>
          </button>

          <button
            onClick={() => setActiveTab("providers")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-2.5 ${
              activeTab === "providers"
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold"
                : "hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)]"
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-500" />
            <span>API Providers (BYOK)</span>
          </button>

          <button
            onClick={() => setActiveTab("models")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-2.5 ${
              activeTab === "models"
                ? "bg-black/10 dark:bg-white/10 text-[var(--foreground)] font-semibold"
                : "hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)]"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Local Ollama Models</span>
          </button>

          <button
            onClick={() => setActiveTab("files")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-2.5 ${
              activeTab === "files"
                ? "bg-black/10 dark:bg-white/10 text-[var(--foreground)] font-semibold"
                : "hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Knowledge Files</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center bg-black/[0.01] dark:bg-white/[0.01]">
            <div>
              <h2 className="font-semibold text-base text-[var(--foreground)]">
                {activeTab === "appearance" && "Appearance"}
                {activeTab === "providers" && "API Providers & Cloud Models (BYOK)"}
                {activeTab === "models" && "Local Ollama Models"}
                {activeTab === "files" && "Knowledge Base Documents"}
              </h2>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                {activeTab === "appearance" && "Customize your interface theme and visual preferences"}
                {activeTab === "providers" && "Insert API keys from OpenAI, Anthropic, Groq, DeepSeek, Gemini, or any provider"}
                {activeTab === "models" && "Manage local weights running through the Ollama runtime"}
                {activeTab === "files" && "Documents indexed for Retrieval-Augmented Generation (RAG)"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* ── APPEARANCE TAB ── */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
                    Color Theme
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all cursor-pointer ${
                        theme === "light"
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)]"
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      <span className="text-xs font-semibold">Light</span>
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all cursor-pointer ${
                        theme === "dark"
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)]"
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                      <span className="text-xs font-semibold">Dark (Zinc)</span>
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all cursor-pointer ${
                        theme === "system"
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)]"
                      }`}
                    >
                      <Monitor className="w-5 h-5" />
                      <span className="text-xs font-semibold">System</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── API PROVIDERS & BYOK TAB ── */}
            {activeTab === "providers" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--foreground)]">
                    Configured Cloud Models ({customModels.length})
                  </div>
                  {!isAddingCustom && (
                    <button
                      onClick={() => {
                        setIsAddingCustom(true);
                        setTestResult(null);
                        setSaveError(null);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Provider / Model</span>
                    </button>
                  )}
                </div>

                {/* ADD NEW MODEL FORM */}
                {isAddingCustom && (
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/20 dark:bg-blue-950/15 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" />
                        Configure New Model & API Key
                      </span>
                      <button
                        onClick={() => setIsAddingCustom(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Quick Provider Presets */}
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--muted)] mb-1.5">
                        Select Provider Preset
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {PROVIDER_PRESETS.map((p) => (
                          <button
                            key={p.provider}
                            type="button"
                            onClick={() => handleSelectPreset(p)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-all cursor-pointer flex items-center justify-between ${
                              newProvider === p.provider
                                ? "border-blue-500 bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                                : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--muted)]"
                            }`}
                          >
                            <span className="truncate">{p.badge}</span>
                            {newProvider === p.provider && <Check className="w-3 h-3 text-blue-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">
                          Display Name (Dynamic)
                        </label>
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. Claude 3.5 Sonnet"
                          className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] outline-none focus:border-blue-500 text-[var(--foreground)]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">
                          Upstream Model Identifier
                        </label>
                        <input
                          type="text"
                          value={newModelId}
                          onChange={(e) => setNewModelId(e.target.value)}
                          placeholder="e.g. claude-3-5-sonnet-20241022"
                          className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] outline-none focus:border-blue-500 font-mono text-[var(--foreground)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">
                        API Key
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showKey ? "text" : "password"}
                          value={newApiKey}
                          onChange={(e) => setNewApiKey(e.target.value)}
                          placeholder={currentPreset.keyPlaceholder}
                          className="w-full text-xs px-3 py-2 pr-10 rounded-lg bg-[var(--background)] border border-[var(--border)] outline-none focus:border-blue-500 font-mono text-[var(--foreground)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">
                        Base URL Override (Optional)
                      </label>
                      <input
                        type="text"
                        value={newApiBase}
                        onChange={(e) => setNewApiBase(e.target.value)}
                        placeholder={currentPreset.apiBasePlaceholder || "Optional custom URL"}
                        className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] outline-none focus:border-blue-500 font-mono text-[var(--foreground)]"
                      />
                    </div>

                    {/* Test feedback */}
                    {testResult && (
                      <div
                        className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                          testResult.success
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300"
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span className="truncate">
                          {testResult.success
                            ? `✓ Connected to ${newProvider} (${testResult.latency_ms}ms latency)`
                            : `Connection failed: ${testResult.error}`}
                        </span>
                      </div>
                    )}

                    {saveError && (
                      <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                        {saveError}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTesting || !newApiKey.trim()}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--foreground)] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        <span>{isTesting ? "Testing..." : "Test Connection"}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingCustom(false)}
                          className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:text-[var(--foreground)] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveCustomModel}
                          disabled={isSaving || !newApiKey.trim()}
                          className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Save & Enable</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SAVED MODELS LIST */}
                {isLoadingCustom ? (
                  <div className="flex items-center justify-center p-8 text-[var(--muted)]">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs">Loading configured models...</span>
                  </div>
                ) : customModels.length === 0 && !isAddingCustom ? (
                  <div className="text-center p-8 border border-dashed border-[var(--border)] rounded-xl space-y-2">
                    <Cloud className="w-8 h-8 mx-auto text-gray-400" />
                    <p className="text-xs text-[var(--foreground)] font-medium">No external API models added yet</p>
                    <p className="text-[11px] text-[var(--muted)] max-w-sm mx-auto">
                      Add an API key from Anthropic, OpenAI, Groq, DeepSeek, or Gemini to run cloud models alongside your local setup.
                    </p>
                    <button
                      onClick={() => setIsAddingCustom(true)}
                      className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Your First Cloud Model</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {customModels.map((m) => {
                      const isSelected = intentOverride === `custom:${m.id}` || intentOverride === m.name;
                      return (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs"
                              : "border-[var(--border)] bg-black/[0.01] dark:bg-white/[0.01]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-[var(--foreground)]">
                                {m.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                                {m.provider}
                              </span>
                              {isSelected && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-600 text-white font-medium">
                                  Active in Chat
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--muted)]">
                              <span className="font-mono">{m.model_id}</span>
                              <span>· Key: {m.masked_key}</span>
                              {m.api_base ? <span>· {m.api_base}</span> : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Select for chat */}
                            <button
                              type="button"
                              onClick={() => {
                                setIntentOverride(`custom:${m.id}`);
                                updateSettings(`custom:${m.id}`, undefined);
                              }}
                              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--foreground)]"
                              }`}
                            >
                              {isSelected ? "Selected" : "Use"}
                            </button>

                            {/* Enable/Disable toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(m)}
                              className={`text-[11px] px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                m.is_active
                                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                                  : "text-gray-400 bg-black/5 dark:bg-white/5"
                              }`}
                              title={m.is_active ? "Enabled in model picker" : "Disabled in model picker"}
                            >
                              {m.is_active ? "Enabled" : "Disabled"}
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomModel(m.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Delete model"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── LOCAL OLLAMA MODELS TAB ── */}
            {activeTab === "models" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--muted)]">
                    Local models installed in the Ollama runtime ({modelDetails.length} detected).
                  </p>
                  <button
                    onClick={loadModels}
                    disabled={isLoadingModels}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>

                {isLoadingModels ? (
                  <div className="flex items-center justify-center p-8 text-[var(--muted)]">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs">Querying local Ollama runtime...</span>
                  </div>
                ) : modelDetails.length === 0 ? (
                  <div className="text-center p-8 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl">
                    No local models found. Pull a model via <code>ollama pull qwen2.5-coder:7b</code>.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modelDetails.map((m) => {
                      const isCurrentActive = intentOverride === m.name;
                      const sizeMb = m.size ? Math.round(m.size / (1024 * 1024)) : 0;
                      const sizeGb = (sizeMb / 1024).toFixed(1);
                      return (
                        <div
                          key={m.name}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            isCurrentActive
                              ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20"
                              : "border-[var(--border)] bg-black/[0.01] dark:bg-white/[0.01]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-[var(--foreground)] truncate">
                                {m.name}
                              </span>
                              {m.parameter_size && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/5 dark:bg-white/10 font-mono text-[var(--muted)]">
                                  {m.parameter_size}
                                </span>
                              )}
                              {isCurrentActive && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--muted)]">
                              {m.size ? <span>{sizeMb > 1000 ? `${sizeGb} GB` : `${sizeMb} MB`}</span> : null}
                              {m.quantization_level && <span>· {m.quantization_level}</span>}
                              {m.family && <span>· {m.family}</span>}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setIntentOverride(m.name);
                              updateSettings(m.name, undefined);
                            }}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                              isCurrentActive
                                ? "bg-blue-600 text-white"
                                : "hover:bg-black/10 dark:hover:bg-white/10 text-[var(--foreground)] border border-[var(--border)]"
                            }`}
                          >
                            {isCurrentActive ? "Active" : "Select"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── KNOWLEDGE FILES TAB ── */}
            {activeTab === "files" && (
              <div className="space-y-4">
                <p className="text-xs text-[var(--muted)]">
                  Manage documents uploaded to this conversation&apos;s knowledge base.
                </p>

                {isLoadingDocs ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-[var(--border)] rounded-xl">
                    <FileText className="w-8 h-8 mx-auto text-[var(--muted)] mb-2" />
                    <p className="text-xs text-[var(--muted)]">No documents uploaded to this conversation yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border border-[var(--border)] rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-black/5 dark:bg-white/10 rounded-lg">
                            <FileText className="w-4 h-4 text-[var(--muted)]" />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-medium truncate text-[var(--foreground)]" title={doc.filename}>
                              {doc.filename}
                            </span>
                            <span className="text-[10px] text-[var(--muted)]">
                              {(doc.fileSize / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(doc.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
