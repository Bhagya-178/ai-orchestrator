"use client";

import { useEffect, useState, useCallback } from "react";
import { getConversations, deleteConversation } from "@/app/lib/api/conversations";
import { Conversation } from "@/app/lib/types";
import { useChat } from "@/app/lib/context/ChatContext";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import { Trash2 } from "lucide-react";

export default function ConversationList({ onSelect }: { onSelect: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { currentConversationId, loadConversation, clearChat, isGenerating } = useChat();
  const { isSidebarOpen } = useNavigation();

  const loadConversations = useCallback(() => {
    getConversations().then(setConversations);
  }, []);

  // Auto-refresh when sidebar opens, conversation ID changes, or message generation completes
  useEffect(() => {
    loadConversations();
  }, [loadConversations, isSidebarOpen, currentConversationId, isGenerating]);

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

  return (
    <ul className="space-y-0.5">
      {conversations.map((conv) => {
        const isActive = conv.id === currentConversationId;
        return (
          <li key={conv.id} className="relative group">
            <button
              onClick={() => {
                loadConversation(conv.id);
                onSelect();
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors truncate pr-8
                ${isActive 
                  ? "bg-black/5 dark:bg-white/10 font-medium text-gray-900 dark:text-gray-100" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100"
                }
              `}
              title={conv.title}
            >
              <span className="opacity-40 mr-1.5 text-xs">○</span>
              {conv.title}
            </button>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
              title="Delete conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
