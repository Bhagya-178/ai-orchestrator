"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDown, Lightbulb, Code, BookOpen, Sparkles } from "lucide-react";
import { useChat } from "@/app/lib/context/ChatContext";
import MessageBubble from "./MessageBubble";
import ChatComposer from "./ChatComposer";
import ArtifactViewer from "../artifacts/ArtifactViewer";

const STARTER_PROMPTS = [
  {
    icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
    title: "Explain a concept",
    prompt: "Explain how neural network attention mechanisms work with a simple real-world analogy.",
  },
  {
    icon: <Code className="w-4 h-4 text-blue-500" />,
    title: "Write code",
    prompt: "Write a high-performance Python script to analyze CSV logs and detect anomalies.",
  },
  {
    icon: <Sparkles className="w-4 h-4 text-purple-500" />,
    title: "Build an interactive UI",
    prompt: "Create an interactive HTML and JavaScript financial compound interest calculator with a clean dark mode UI.",
  },
  {
    icon: <BookOpen className="w-4 h-4 text-emerald-500" />,
    title: "Study guide",
    prompt: "Create a structured study guide with key takeaways and quiz questions on distributed consensus algorithms.",
  },
];

export default function ChatView() {
  const { messages, currentConversationId, sendMessage, isGenerating } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const userScrolledUpRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);
  const lastConversationIdRef = useRef(currentConversationId);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    isProgrammaticScrollRef.current = true;
    if (programmaticTimerRef.current) {
      clearTimeout(programmaticTimerRef.current);
    }
    programmaticTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 600);

    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior,
      });
    }
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior, block: "end" });
    }
    userScrolledUpRef.current = false;
    setShowScrollBottom((prev) => (prev ? false : prev));
  }, []);

  const handleUserInteraction = useCallback(() => {
    isProgrammaticScrollRef.current = false;
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (isProgrammaticScrollRef.current) {
      if (distanceFromBottom <= 50) {
        isProgrammaticScrollRef.current = false;
        userScrolledUpRef.current = false;
        setShowScrollBottom((prev) => (prev ? false : prev));
      }
      return;
    }

    const isUp = distanceFromBottom > 120;
    setShowScrollBottom((prev) => (prev !== isUp ? isUp : prev));
    userScrolledUpRef.current = isUp;
  }, []);

  useEffect(() => {
    if (currentConversationId !== lastConversationIdRef.current) {
      lastConversationIdRef.current = currentConversationId;
      userScrolledUpRef.current = false;
      const timer = setTimeout(() => scrollToBottom("auto"), 60);
      return () => clearTimeout(timer);
    }
  }, [currentConversationId, scrollToBottom]);

  useEffect(() => {
    const prevCount = lastMessageCountRef.current;
    const currentCount = messages.length;
    lastMessageCountRef.current = currentCount;

    if (currentCount === 0) return;

    if (currentCount > prevCount) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "user") {
        userScrolledUpRef.current = false;
        scrollToBottom("smooth");
        return;
      }
    }

    if (!userScrolledUpRef.current) {
      // During active generation / streaming, use "auto" to prevent animation restarts and scroll thrashing
      scrollToBottom(isGenerating ? "auto" : "smooth");
    }
  }, [messages, isGenerating, scrollToBottom]);

  // ── Empty State ──
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 h-full relative overflow-hidden">
        {/* Hero */}
        <div className="flex flex-col items-center text-center mb-8 mt-[-8vh]">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mb-4 shadow-md">
            <span className="text-white font-bold text-sm tracking-tight">AI</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-2">
            AI Orchestrator
          </h1>
          <p className="text-[var(--muted)] text-base max-w-xs">
            Your local AI workspace. Ask anything.
          </p>
        </div>

        {/* Starter cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-[680px] mb-6">
          {STARTER_PROMPTS.map((starter, i) => (
            <button
              key={i}
              onClick={() => sendMessage(starter.prompt)}
              className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--sidebar)] hover:bg-black/5 dark:hover:bg-white/5 hover:border-[var(--foreground)]/10 transition-all text-left group cursor-pointer"
            >
              <div className="mt-0.5 shrink-0">{starter.icon}</div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)] mb-0.5">
                  {starter.title}
                </div>
                <p className="text-xs text-[var(--muted)] line-clamp-2 leading-relaxed">
                  {starter.prompt}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Composer */}
        <div className="w-full max-w-[760px] mt-auto lg:mt-0 lg:absolute lg:bottom-0">
          <ChatComposer />
        </div>
      </div>
    );
  }

  // ── Active Chat ──
  return (
    <div className="flex-1 flex flex-col h-full relative min-h-0">
      {/* Scrollable message feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleUserInteraction}
        onTouchMove={handleUserInteraction}
        className="flex-1 overflow-y-auto px-4 py-8 scroll-smooth"
      >
        <div className="max-w-[760px] mx-auto flex flex-col gap-8 pb-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {/* Bottom anchor + spacer for the fixed composer */}
          <div ref={bottomAnchorRef} className="h-40 sm:h-48 w-full pointer-events-none shrink-0" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollBottom && (
        <div className="absolute bottom-36 sm:bottom-40 right-6 z-30">
          <button
            onClick={() => scrollToBottom("smooth")}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-[var(--shadow)] hover:bg-black/5 dark:hover:bg-white/5 transition-all hover:scale-105 active:scale-95"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pinned composer with gradient fade above */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/95 to-transparent pt-10 pointer-events-none">
        <div className="pointer-events-auto">
          <ChatComposer />
        </div>
      </div>

      {/* Canvas / Artifact viewer */}
      <ArtifactViewer />
    </div>
  );
}
