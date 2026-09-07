"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Sparkles, ArrowRight, Tag, BookOpen } from "lucide-react";
import { PromptTemplate } from "@/app/lib/types";
import { listPromptTemplates, renderPromptTemplate } from "@/app/lib/api/prompts";

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertPrompt: (promptText: string, systemPrompt?: string) => void;
}

const CATEGORIES = ["All", "Coding", "Security", "Data Science", "Writing", "General"];

export default function PromptLibraryModal({ isOpen, onClose, onInsertPrompt }: PromptLibraryModalProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<PromptTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    listPromptTemplates()
      .then((data) => setTemplates(data))
      .catch((err) => console.error("Failed to fetch templates:", err))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredTemplates = templates.filter((tpl) => {
    const matchesCat = selectedCategory === "All" || tpl.category.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      tpl.title.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.tags.some((t) => t.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const handleSelectTemplate = (tpl: PromptTemplate) => {
    setActiveTemplate(tpl);
    const defaults: Record<string, string> = {};
    tpl.variables.forEach((v) => {
      defaults[v.name] = v.default || "";
    });
    setVariableValues(defaults);
  };

  const handleApplyTemplate = async () => {
    if (!activeTemplate) return;
    setIsRendering(true);
    try {
      const res = await renderPromptTemplate(activeTemplate.id, variableValues);
      onInsertPrompt(res.rendered_prompt, res.system_prompt);
      onClose();
    } catch (err: any) {
      alert(`Error rendering template: ${err.message}`);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Prompt Engineering Studio</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Curated, parameterized prompt templates for professional workflows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Template Explorer */}
          <div className="w-1/2 border-r border-[var(--border)] flex flex-col p-4 space-y-3 overflow-y-auto">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates or tags..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>

            {/* Categories */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Template List */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="text-xs text-gray-400 py-8 text-center">Loading templates...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-xs text-gray-400 py-8 text-center">No matching templates found.</div>
              ) : (
                filteredTemplates.map((tpl) => {
                  const isSelected = activeTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? "border-purple-500 bg-purple-500/5 shadow-sm"
                          : "border-[var(--border)] hover:border-gray-400 dark:hover:border-gray-600 bg-[var(--background)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white truncate">{tpl.title}</span>
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium px-2 py-0.5 rounded-md bg-purple-500/10">
                          {tpl.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{tpl.description}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tpl.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-gray-400 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Variable Form & Preview */}
          <div className="w-1/2 flex flex-col p-5 overflow-y-auto">
            {activeTemplate ? (
              <div className="flex-1 flex flex-col space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{activeTemplate.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{activeTemplate.description}</p>
                </div>

                {activeTemplate.system_prompt && (
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] text-xs">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                      System Instructions
                    </span>
                    <p className="text-[11px] text-gray-700 dark:text-gray-300 italic">{activeTemplate.system_prompt}</p>
                  </div>
                )}

                {/* Variable Form Inputs */}
                {activeTemplate.variables.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Template Variables
                    </span>
                    {activeTemplate.variables.map((v) => (
                      <div key={v.name} className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                          <span>{v.name}</span>
                          {v.required && <span className="text-[10px] text-rose-500 font-semibold">*Required</span>}
                        </label>
                        <input
                          type="text"
                          value={variableValues[v.name] || ""}
                          onChange={(e) => setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                          placeholder={v.default ? `Default: ${v.default}` : `Enter ${v.name}...`}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-4 border-t border-[var(--border)] flex justify-end">
                  <button
                    onClick={handleApplyTemplate}
                    disabled={isRendering}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-xl shadow-md transition-all hover:gap-3 disabled:opacity-50"
                  >
                    <span>Insert into Chat</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                <BookOpen className="w-10 h-10 stroke-1 mb-2 opacity-50" />
                <p className="text-xs font-medium">Select a template to configure variables and preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
