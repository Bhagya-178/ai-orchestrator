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
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg py-1.5 pl-8 pr-6 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Empty States */}
      {conversations.length === 0 ? (
        <div className="px-2 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
          No conversations yet.
          <br />Start chatting to save history.
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="px-2 py-4 text-center text-xs text-gray-400">
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
                  <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#222] rounded-lg border border-blue-400 shadow-xs">
                    <input
                      type="text"
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(e, conv.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full bg-transparent text-xs text-gray-900 dark:text-white outline-none py-1"
                    />
                    <button
                      onClick={(e) => saveRename(e, conv.id)}
                      className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={cancelRename}
                      className="p-1 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 rounded"
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
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] transition-all leading-snug flex items-start gap-1.5 group-hover:pr-20
                        ${isActive
                          ? "bg-black/8 dark:bg-white/10 font-medium text-gray-900 dark:text-gray-100"
                          : "text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100"
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
                    <div className="absolute right-1 top-1.5 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-xs rounded-md shadow-xs py-0.5 px-0.5 border border-black/5 dark:border-white/10 z-10">
                      {/* Pin Button */}
                      <button
                        onClick={(e) => handleTogglePin(e, conv)}
                        className={`p-1 rounded transition-colors ${
                          conv.is_pinned
                            ? "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"
                        }`}
                        title={conv.is_pinned ? "Unpin chat" : "Pin chat"}
                      >
                        <Pin className={`w-3 h-3 ${conv.is_pinned ? "fill-blue-500" : ""}`} />
                      </button>

                      {/* Rename Button */}
                      <button
                        onClick={(e) => startRename(e, conv)}
                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
                        title="Rename title"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {/* Export Button */}
                      <button
                        onClick={(e) => handleExport(e, conv.id)}
                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Export chat"
                      >
                        <Download className="w-3 h-3" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
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
