"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { ChatMessage, UploadedDocument, Conversation } from "../types";
import { streamChat } from "../api/chat";
import { createConversation } from "../api/conversations";

interface ChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isGenerating: boolean;
  sendMessage: (content: string) => Promise<void>;
  activeDocument: UploadedDocument | null;
  setActiveDocument: (doc: UploadedDocument | null) => void;
  currentConversationId: string;
  setCurrentConversationId: (id: string) => void;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDocument, setActiveDocument] = useState<UploadedDocument | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string>("default-session");

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(Math.random().toString(36).substring(7));
    setActiveDocument(null);
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isGenerating) return;

    let sessionId = currentConversationId;
    if (messages.length === 0) {
      // Create new conversation on first message
      const newConv = await createConversation(content.substring(0, 30));
      sessionId = newConv.id;
      setCurrentConversationId(sessionId);
    }

    const newUserMsg: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: content.trim()
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setIsGenerating(true);

    const assistantId = Math.random().toString();
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
      }
    ]);

    let fullResponse = "";
    
    try {
      await streamChat(
        newUserMsg.content,
        sessionId,
        (token) => {
          fullResponse += token;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantId ? { ...msg, content: fullResponse } : msg
            )
          );
        },
        (metadata) => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantId ? { 
                ...msg, 
                model: metadata.model,
                latencyMs: metadata.latency_ms
              } : msg
            )
          );
        }
      );
    } catch (error) {
      console.error("Chat failed:", error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantId ? { ...msg, content: fullResponse + "\n\n*(Error: Connection to backend failed)*" } : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        isGenerating,
        sendMessage,
        activeDocument,
        setActiveDocument,
        currentConversationId,
        setCurrentConversationId,
        clearChat
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
