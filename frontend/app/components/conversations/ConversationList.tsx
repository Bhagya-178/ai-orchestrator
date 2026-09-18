"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { 
  getConversations, 
  deleteConversation, 
  updateConversationSettings, 
  exportConversation 
} from "@/app/lib/api/conversations";
import { Conversation, ConversationExportData } from "@/app/lib/types";
import { useChat } from "@/app/lib/context/ChatContext";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import { useAuth } from "@/app/lib/context/AuthContext";
import { Trash2, Pin, Edit2, Check, X, Download, Search } from "lucide-react";
import ExportModal from "./ExportModal";

export default function ConversationList({ onSelect }: { onSelect: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [exportData, setExportData] = useState<ConversationExportData | null>(null);

  const { currentConversationId, loadConversation, clearChat, conversationVersion } = useChat();
  const { isSidebarOpen } = useNavigation();
  const { isAuthenticated, setShowAuthModal, setAuthModalMode } = useAuth();

  const loadConversations = useCallback(() => {
    getConversations().then(setConversations);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, isSidebarOpen, currentConversationId, conversationVersion, isAuthenticated]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this conversation?")) {
      await deleteConversation(id);
      loadConversations();
      if (currentConversationId === id) {
        clearChat();
      }
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    const newPinned = !conv.is_pinned;
    await updateConversationSettings(conv.id, { is_pinned: newPinned });
    loadConversations();
  };

  const startRename = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = async (e: React.MouseEvent | React.FormEvent, convId: string) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      await updateConversationSettings(convId, { title: editTitle.trim() });
      loadConversations();
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleExport = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      setAuthModalMode("login");
      setShowAuthModal(true);
      return;
    }
    const data = await exportConversation(convId);
    if (data) {
      setExportData(data);
    }
  };

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  return (
    <div className="flex flex-col gap-2">
      {/* Search Input */}
      {conversations.length > 0 && (
        <div className="relative px-1 mb-1">
          <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-neutral-100/80 dark:bg-zinc-900/80 border border-neutral-200/80 dark:border-zinc-800/80 rounded-lg py-1.5 pl-8 pr-7 text-xs text-neutral-900 dark:text-zinc-100 placeholder:text-neutral-400 dark:placeholder:text-zinc-500 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200 p-0.5 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Empty States */}
      {conversations.length === 0 ? (
        <div className="px-2 py-6 text-center text-xs text-neutral-400 dark:text-zinc-500">
          No conversations yet.
          <br />Start chatting to save history.
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="px-2 py-4 text-center text-xs text-neutral-400 dark:text-zinc-500">
          No chats matching &quot;{searchQuery}&quot;
        </div>
      ) : (
        <ul className="space-y-0.5">
          {filteredConversations.map((conv) => {
            const isActive = conv.id === currentConversationId;
            const cleanTitle = (conv.title || "New Chat").replace(/\s+/g, " ").trim();
            const isEditing = editingId === conv.id;

            return (
              <li key={conv.id} className="relative group">
                {isEditing ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-900 rounded-lg border border-blue-500/60 shadow-xs ring-2 ring-blue-500/10">
                    <input
                      type="text"
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(e, conv.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full bg-transparent text-xs text-neutral-900 dark:text-zinc-100 outline-none py-1"
                    />
                    <button
                      onClick={(e) => saveRename(e, conv.id)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={cancelRename}
                      className="p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        loadConversation(conv.id);
                        onSelect();
                      }}
                      className={`relative w-full text-left pl-3 pr-2.5 py-2 rounded-lg text-[13px] transition-all leading-snug flex items-start gap-1.5 group-hover:pr-22
                        ${isActive
                          ? "bg-neutral-200/60 dark:bg-zinc-800/70 font-medium text-neutral-900 dark:text-zinc-100 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-blue-600 dark:before:bg-blue-500 before:rounded-r-full"
                          : "text-neutral-600 dark:text-zinc-400 hover:bg-neutral-100/80 dark:hover:bg-zinc-800/40 hover:text-neutral-900 dark:hover:text-zinc-200"
                        }
                      `}
                      title={cleanTitle}
                    >
                      {conv.is_pinned && (
                        <Pin className="w-3 h-3 text-blue-500 fill-blue-500 shrink-0 mt-0.5" />
                      )}
                      <span className="block break-words line-clamp-2 transition-all">
                        {cleanTitle}
                      </span>
                    </button>

                    {/* Action Bar (Hover Buttons) */}
                    <div className="absolute right-1 top-1.5 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-md shadow-xs py-0.5 px-1 border border-neutral-200/80 dark:border-zinc-700/80 z-10 gap-0.5">
                      {/* Pin Button */}
                      <button
                        onClick={(e) => handleTogglePin(e, conv)}
                        className={`p-1 rounded transition-colors ${
                          conv.is_pinned
                            ? "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            : "text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 hover:bg-neutral-100 dark:hover:bg-zinc-800"
                        }`}
                        title={conv.is_pinned ? "Unpin chat" : "Pin chat"}
                      >
                        <Pin className={`w-3 h-3 ${conv.is_pinned ? "fill-blue-500" : ""}`} />
                      </button>

                      {/* Rename Button */}
                      <button
                        onClick={(e) => startRename(e, conv)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        title="Rename title"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {/* Export Button */}
                      <button
                        onClick={(e) => handleExport(e, conv.id)}
                        className="p-1 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors"
                        title="Export chat"
                      >
                        <Download className="w-3 h-3" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="p-1 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Export Modal */}
      {exportData && (
        <ExportModal
          exportData={exportData}
          onClose={() => setExportData(null)}
        />
      )}
    </div>
  );
}
