"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
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
  loadConversation: (id: string) => Promise<void>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

import { getChatMessages } from "../api/chat";
import { listDocuments, reassignDocumentSession } from "../api/documents";

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDocument, setActiveDocument] = useState<UploadedDocument | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string>("default-session");

  const loadConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);
    if (id === "default-session" || id.length < 10) {
      setMessages([]);
      setActiveDocument(null);
      return;
    }
    
    // Load past messages
    const history = await getChatMessages(id);
    setMessages(history);

    // Load past documents
    const docs = await listDocuments(id);
    if (docs && docs.length > 0) {
      setActiveDocument(docs[0]);
    } else {
      setActiveDocument(null);
    }
  }, []);

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

      // If a document was uploaded before the conversation existed,
      // reassign it from "default-session" to the real conversation ID
      if (activeDocument && activeDocument.id !== "uploading") {
        await reassignDocumentSession(activeDocument.id, sessionId);
      }
    }

    const newUserMsg: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: content.trim(),
      attachedDocument: activeDocument ? activeDocument : undefined
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setIsGenerating(true);
    
    // Clear the active document from the composer input since it's now "sent"
    if (activeDocument) {
      setActiveDocument(null);
    }

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const md = metadata as any;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantId ? { 
                ...msg, 
                model: md.model,
                latencyMs: md.latency_ms
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
        loadConversation,
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
