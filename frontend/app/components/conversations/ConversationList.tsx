"use client";

import { useEffect, useState } from "react";
import { getConversations } from "@/app/lib/api/conversations";
import { Conversation } from "@/app/lib/types";
import { useChat } from "@/app/lib/context/ChatContext";

export default function ConversationList({ onSelect }: { onSelect: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { currentConversationId, setCurrentConversationId } = useChat();

  useEffect(() => {
    getConversations().then(setConversations);
  }, []);

  return (
    <ul className="space-y-0.5">
      {conversations.map((conv) => {
        const isActive = conv.id === currentConversationId;
        return (
          <li key={conv.id}>
            <button
              onClick={() => {
                setCurrentConversationId(conv.id);
                // Also trigger fetching old messages here in a real app
                onSelect();
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors truncate
                ${isActive 
                  ? "bg-black/5 font-medium text-gray-900" 
                  : "text-gray-600 hover:bg-black/5 hover:text-gray-900"
                }
              `}
              title={conv.title}
            >
              <span className="opacity-40 mr-1.5 text-xs">○</span>
              {conv.title}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
