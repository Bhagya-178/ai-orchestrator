"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from "react";
import { ChatMessage, UploadedDocument } from "../types";
import { streamChat, getChatMessages } from "../api/chat";
import { createConversation, getConversation, updateConversationSettings } from "../api/conversations";
import { listDocuments, reassignDocumentSession } from "../api/documents";

interface ChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isGenerating: boolean;
  sendMessage: (content: string) => Promise<void>;
  activeDocument: UploadedDocument | null;
  setActiveDocument: (doc: UploadedDocument | null) => void;
  currentConversationId: string;
  currentTitle: string;
  loadConversation: (id: string) => Promise<void>;
  clearChat: () => void;
  useDocumentContext: boolean;
  setUseDocumentContext: (val: boolean) => void;
  intentOverride: string;
  setIntentOverride: (val: string) => void;
  effortLevel: string;
  setEffortLevel: (val: string) => void;
  updateSettings: (newIntent?: string, newEffort?: string) => Promise<void>;
  stopGeneration: () => void;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  regenerateLastResponse: () => Promise<void>;
  /** Increments whenever a new conversation is first committed to the backend */
  conversationVersion: number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDocument, setActiveDocument] = useState<UploadedDocument | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string>("default-session");
  const [currentTitle, setCurrentTitle] = useState<string>("New Chat");
  const [useDocumentContext, setUseDocumentContext] = useState(true);
  const [intentOverride, setIntentOverride] = useState<string>("auto");
  const [effortLevel, setEffortLevel] = useState<string>("medium");
  const [conversationVersion, setConversationVersion] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);
    if (id === "default-session" || id.length < 10) {
      setMessages([]);
      setCurrentTitle("New Chat");
      setActiveDocument(null);
      setUseDocumentContext(true);
      setIntentOverride("auto");
      setEffortLevel("medium");
      return;
    }
    
    // Load past messages
    let history: ChatMessage[] = [];
    try {
      history = await getChatMessages(id);
    } catch (err) {
      console.warn("Failed to load conversation history:", err);
    }

    // Load past conversation settings (intent, effort level, and title)
    try {
      const conv = await getConversation(id);
      if (conv && conv.title && conv.title !== "New Conversation" && conv.title !== "New Chat") {
        setCurrentTitle(conv.title);
      } else if (history.length > 0) {
        const firstUser = history.find(m => m.role === "user" && m.content.trim());
        setCurrentTitle(firstUser?.content.slice(0, 45) || "New Chat");
      } else {
        setCurrentTitle("New Chat");
      }

      if (conv) {
        if (conv.intent_override) setIntentOverride(conv.intent_override);
        if (conv.effort_level) setEffortLevel(conv.effort_level);
      }
    } catch (err) {
      console.warn("Failed to load conversation settings:", err);
      if (history.length > 0) {
        const firstUser = history.find(m => m.role === "user" && m.content.trim());
        setCurrentTitle(firstUser?.content.slice(0, 45) || "New Chat");
      }
    }

    // Load past documents
    let docs: UploadedDocument[] = [];
    try {
      docs = await listDocuments(id);
    } catch (err) {
      console.warn("Failed to load documents for session:", err);
    }

    if (docs && docs.length > 0) {
      setActiveDocument(docs[0]);
      setUseDocumentContext(true);

      // Ensure the first user message displays the attached document badge
      let attached = false;
      const historyWithDocs = history.map((msg) => {
        if (!attached && msg.role === "user") {
          attached = true;
          return msg.attachedDocument ? msg : { ...msg, attachedDocument: docs[0] };
        }
        return msg;
      });
      setMessages(historyWithDocs);
    } else {
      setActiveDocument(null);
      setMessages(history);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(crypto.randomUUID());
    setCurrentTitle("New Chat");
    setActiveDocument(null);
    setUseDocumentContext(true);
    setIntentOverride("auto");
    setEffortLevel("medium");
  }, []);

  const updateSettings = useCallback(async (newIntent?: string, newEffort?: string) => {
    if (newIntent) setIntentOverride(newIntent);
    if (newEffort) setEffortLevel(newEffort);

    if (currentConversationId && currentConversationId !== "default-session" && currentConversationId.length >= 10) {
      await updateConversationSettings(currentConversationId, {
        intent_override: newIntent,
        effort_level: newEffort,
      });
    }
  }, [currentConversationId]);

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
      const derivedTitle = content.trim().length > 40 ? content.trim().substring(0, 40) + "..." : content.trim();
      setCurrentTitle(derivedTitle);

      // If currentConversationId is the placeholder "default-session", create a real conversation
      if (sessionId === "default-session" || sessionId.length < 10) {
        const newConv = await createConversation(derivedTitle);
        sessionId = newConv.id;
        setCurrentConversationId(sessionId);
      }
      // Signal ConversationList to refresh after this new session is committed
      setConversationVersion(v => v + 1);

      // Ensure uploaded document is associated with this conversation's sessionId
      if (activeDocument && activeDocument.status !== "uploading") {
        try {
          await reassignDocumentSession(activeDocument.id, sessionId);
        } catch (err) {
          console.warn("Document session reassignment error:", err);
        }
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
        activeDocument && useDocumentContext ? "auto" : intentOverride,
        activeDocument && useDocumentContext ? "high" : effortLevel,
        abortController.signal,
        (toolStep) => {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.id === assistantId) {
              const currentSteps = lastMsg.toolSteps || [];
              const newPrev = [...prev];
              newPrev[newPrev.length - 1] = {
                ...lastMsg,
                toolSteps: [...currentSteps, toolStep],
              };
              return newPrev;
            }
            return prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, toolSteps: [...(msg.toolSteps || []), toolStep] }
                : msg
            );
          });
        }
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
        // Increment version so ConversationList refreshes after messages are saved to DB
        setConversationVersion(v => v + 1);
      }
    }
  };

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (isGenerating || !newContent.trim()) return;
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Prune subsequent messages to branch cleanly
    setMessages(prev => prev.slice(0, msgIndex));
    // Send updated prompt
    await sendMessage(newContent);
  }, [isGenerating, messages, sendMessage]);

  const regenerateLastResponse = useCallback(async () => {
    if (isGenerating || messages.length < 2) return;
    // Find last user message
    let lastUserPrompt = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserPrompt = messages[i].content;
        break;
      }
    }
    if (!lastUserPrompt) return;

    // Remove trailing assistant message
    setMessages(prev => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "assistant") {
          return prev.slice(0, i);
        }
      }
      return prev;
    });

    await sendMessage(lastUserPrompt);
  }, [isGenerating, messages, sendMessage]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        isGenerating,
        sendMessage,
        editMessage,
        regenerateLastResponse,
        activeDocument,
        setActiveDocument: handleSetActiveDocument,
        currentConversationId,
        currentTitle,
        loadConversation,
        clearChat,
        useDocumentContext,
        setUseDocumentContext,
        intentOverride,
        setIntentOverride,
        effortLevel,
        setEffortLevel,
        updateSettings,
        stopGeneration,
        conversationVersion,
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
