"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from "react";
import { ChatMessage, UploadedDocument } from "../types";
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
  useDocumentContext: boolean;
  setUseDocumentContext: (val: boolean) => void;
  stopGeneration: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

import { getChatMessages } from "../api/chat";
import { listDocuments, reassignDocumentSession } from "../api/documents";

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDocument, setActiveDocument] = useState<UploadedDocument | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string>("default-session");
  const [useDocumentContext, setUseDocumentContext] = useState(true);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);
    if (id === "default-session" || id.length < 10) {
      setMessages([]);
      setActiveDocument(null);
      setUseDocumentContext(true);
      return;
    }
    
    // Load past messages
    const history = await getChatMessages(id);
    setMessages(history);

    // Load past documents
    const docs = await listDocuments(id);
    if (docs && docs.length > 0) {
      setActiveDocument(docs[0]);
      setUseDocumentContext(true);
    } else {
      setActiveDocument(null);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(crypto.randomUUID());
    setActiveDocument(null);
    setUseDocumentContext(true);
  }, []);

  const handleSetActiveDocument = useCallback((doc: UploadedDocument | null) => {
    setActiveDocument(doc);
    // Auto-enable document context when a new document is uploaded
    if (doc) {
      setUseDocumentContext(true);
    }
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const sendMessage = async (content: string) => {
    // Prevent sending message if generating or document is still uploading
    if (!content.trim() || isGenerating || (activeDocument && activeDocument.status === 'uploading')) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let sessionId = currentConversationId;
    if (messages.length === 0) {
      // Create new conversation on first message
      const newConv = await createConversation(content.substring(0, 30));
      sessionId = newConv.id;
      setCurrentConversationId(sessionId);

      // If a document was uploaded before the conversation existed,
      // reassign it from "default-session" to the real conversation ID
      if (activeDocument && activeDocument.status !== "uploading") {
        await reassignDocumentSession(activeDocument.id, sessionId);
      }
    }

    const newUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      attachedDocument: activeDocument ? activeDocument : undefined
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setIsGenerating(true);

    const assistantId = crypto.randomUUID();
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
          setMessages(prev => {
            // Optimization: avoid mapping over all messages
            const lastMsg = prev[prev.length - 1];
            if (lastMsg.id === assistantId) {
              const newPrev = [...prev];
              newPrev[newPrev.length - 1] = { ...lastMsg, content: fullResponse };
              return newPrev;
            }
            return prev.map(msg => msg.id === assistantId ? { ...msg, content: fullResponse } : msg);
          });
        },
        (metadata) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const md = metadata as any;
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg.id === assistantId) {
              const newPrev = [...prev];
              newPrev[newPrev.length - 1] = { ...lastMsg, model: md.model, latencyMs: md.latency_ms };
              return newPrev;
            }
            return prev.map(msg => 
              msg.id === assistantId ? { 
                ...msg, 
                model: md.model,
                latencyMs: md.latency_ms
              } : msg
            );
          });
        },
        useDocumentContext,
        abortController.signal
      );
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Generation aborted");
      } else {
        console.error("Chat failed:", error);
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantId ? { ...msg, content: fullResponse + "\n\n*(Error: Connection to backend failed)*" } : msg
          )
        );
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
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
        setActiveDocument: handleSetActiveDocument,
        currentConversationId,
        loadConversation,
        clearChat,
        useDocumentContext,
        setUseDocumentContext,
        stopGeneration
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
