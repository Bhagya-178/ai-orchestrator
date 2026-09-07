"use client";

import React, { useState, useEffect } from "react";
import { X, Database, FolderPlus, Search, FileText, Layers, Hash, Sparkles, Check, ChevronRight } from "lucide-react";
import { KnowledgeCollection, HybridSearchResult } from "@/app/lib/types";
import { listKnowledgeCollections, createKnowledgeCollection, performHybridSearch, inspectDocumentChunks } from "@/app/lib/api/ragV2";
import { listDocuments } from "@/app/lib/api/documents";

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KnowledgeBaseModal({ isOpen, onClose }: KnowledgeBaseModalProps) {
  const [collections, setCollections] = useState<KnowledgeCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<KnowledgeCollection | null>(null);
  const [activeTab, setActiveTab] = useState<"collections" | "search" | "inspector">("collections");

  // Collection creation
  const [isCreating, setIsCreating] = useState(false);
  const [colName, setColName] = useState("");
  const [colDesc, setColDesc] = useState("");
  const [colColor, setColColor] = useState("#3b82f6");

  // Hybrid Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HybridSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Inspector state
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [chunkData, setChunkData] = useState<any>(null);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    listKnowledgeCollections()
      .then((cols) => {
        setCollections(cols);
        if (cols.length > 0) setSelectedCollection(cols[0]);
      })
      .catch(console.error);

    listDocuments()
      .then((docs) => {
        setDocuments(docs);
        if (docs.length > 0) setSelectedDocId(docs[0].id);
      })
      .catch(console.error);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName.trim()) return;
    try {
      const created = await createKnowledgeCollection({
        name: colName.trim(),
        description: colDesc.trim(),
        color: colColor,
      });
      setColName("");
      setColDesc("");
      setIsCreating(false);
      const updated = await listKnowledgeCollections();
      setCollections(updated);
      setSelectedCollection(created);
    } catch (err: any) {
      alert(`Error creating collection: ${err.message}`);
    }
  };

  const handleHybridSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await performHybridSearch({
        query: searchQuery.trim(),
        collection_id: selectedCollection?.id,
      });
      setSearchResults(res.results);
    } catch (err: any) {
      alert(`Search error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInspectDocument = async (docId: string) => {
    setSelectedDocId(docId);
    setIsLoadingChunks(true);
    try {
      const data = await inspectDocumentChunks(docId);
      setChunkData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl max-h-[85vh] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Hybrid RAG 2.0 & Knowledge Base</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dense vector + BM25 keyword fusion, collections, and chunk inspection</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-medium">
              <button
                onClick={() => setActiveTab("collections")}
                className={`px-3 py-1 rounded-lg ${activeTab === "collections" ? "bg-white dark:bg-black/40 shadow-sm text-gray-900 dark:text-white" : "text-gray-500"}`}
              >
                Collections
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`px-3 py-1 rounded-lg ${activeTab === "search" ? "bg-white dark:bg-black/40 shadow-sm text-gray-900 dark:text-white" : "text-gray-500"}`}
              >
                Hybrid Search
              </button>
              <button
                onClick={() => setActiveTab("inspector")}
                className={`px-3 py-1 rounded-lg ${activeTab === "inspector" ? "bg-white dark:bg-black/40 shadow-sm text-gray-900 dark:text-white" : "text-gray-500"}`}
              >
                Chunk Inspector
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Collections */}
        {activeTab === "collections" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Collections list */}
            <div className="w-64 border-r border-[var(--border)] p-4 space-y-3 flex flex-col bg-black/[0.01]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Collections</span>
                <button
                  onClick={() => setIsCreating(true)}
                  className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                  title="New Collection"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1 flex-1 overflow-y-auto">
                {collections.map((col) => {
                  const isSelected = selectedCollection?.id === col.id;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setSelectedCollection(col)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                        <span className="truncate">{col.name}</span>
                      </div>
                      <span className="text-[10px] opacity-75 font-mono">{col.document_ids?.length || 0}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Details */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
              {isCreating ? (
                <form onSubmit={handleCreateCollection} className="max-w-md space-y-3 p-4 border border-[var(--border)] rounded-xl bg-black/[0.02]">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Create Knowledge Collection</h4>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">Collection Name</label>
                    <input
                      type="text"
                      required
                      value={colName}
                      onChange={(e) => setColName(e.target.value)}
                      placeholder="e.g. Legal Agreements, Source Code"
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">Description</label>
                    <input
                      type="text"
                      value={colDesc}
                      onChange={(e) => setColDesc(e.target.value)}
                      placeholder="Scope of documents in this collection..."
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                    >
                      Save Collection
                    </button>
                  </div>
                </form>
              ) : selectedCollection ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedCollection.color }} />
                        {selectedCollection.name}
                      </h3>
                      <p className="text-gray-500 text-[11px] mt-0.5">{selectedCollection.description || "No description set."}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                      Documents in this Collection ({selectedCollection.document_ids?.length || 0})
                    </span>
                    {selectedCollection.document_ids?.length === 0 ? (
                      <div className="p-8 text-center rounded-xl border border-dashed border-[var(--border)] text-gray-400">
                        No documents assigned to this collection yet. Upload documents or assign existing files.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedCollection.document_ids.map((id) => (
                          <div key={id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                            <span className="font-mono text-[11px]">{id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Tab 2: Hybrid Search Tester */}
        {activeTab === "search" && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-4 text-xs">
            <form onSubmit={handleHybridSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter test query for hybrid search (e.g. 'authentication security', 'database schema')..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow transition-all disabled:opacity-50"
              >
                {isSearching ? "Searching..." : "Hybrid Search"}
              </button>
            </form>

            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  Run a query to view fused dense vector and BM25 sparse results with RRF scores.
                </div>
              ) : (
                searchResults.map((hit, idx) => (
                  <div key={hit.chunk_id || idx} className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">#{idx + 1}</span>
                        <span className="text-gray-400">Chunk: {hit.chunk_id.slice(0, 12)}...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
                          RRF Score: {hit.rrf_score}
                        </span>
                        {hit.dense_rank && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[10px]">
                            Dense #{hit.dense_rank}
                          </span>
                        )}
                        {hit.sparse_rank && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 text-[10px]">
                            BM25 #{hit.sparse_rank}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 line-clamp-3 font-mono text-[11px] bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded-lg">
                      {hit.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Chunk Inspector */}
        {activeTab === "inspector" && (
          <div className="flex-1 flex overflow-hidden text-xs">
            {/* Document Selector */}
            <div className="w-72 border-r border-[var(--border)] p-4 space-y-2 flex flex-col bg-black/[0.01]">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Select Document</span>
              <div className="space-y-1 flex-1 overflow-y-auto">
                {documents.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleInspectDocument(d.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left truncate transition-colors ${
                      selectedDocId === d.id ? "bg-blue-600 text-white font-medium" : "hover:bg-black/5 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{d.filename}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chunks View */}
            <div className="flex-1 p-6 overflow-y-auto space-y-3">
              {isLoadingChunks ? (
                <div className="text-center py-12 text-gray-400">Loading chunk breakdown...</div>
              ) : chunkData ? (
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Document Chunks ({chunkData.total_chunks})
                    </span>
                    <span className="text-gray-400 font-mono text-[11px]">ID: {selectedDocId.slice(0, 12)}...</span>
                  </div>

                  <div className="space-y-2.5">
                    {chunkData.chunks.map((c: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                          <span>Chunk #{c.chunk_index ?? i + 1}</span>
                          <span>{c.content?.length || 0} characters</span>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 font-mono text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto">
                          {c.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  Select an ingested document on the left to inspect its raw chunks and token boundaries.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
