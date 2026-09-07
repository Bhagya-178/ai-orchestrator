"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDown, Lightbulb, Code, BookOpen, Sparkles } from "lucide-react";
import { useChat } from "@/app/lib/context/ChatContext";
import MessageBubble from "./MessageBubble";
import ChatComposer from "./ChatComposer";
import ArtifactViewer from "../artifacts/ArtifactViewer";

const STARTER_PROMPTS = [
  {
    icon: <Lightbulb className="w-3.5 h-3.5 text-amber-500" />,
    title: "Explain Concept",
    prompt: "Explain how neural network attention mechanisms work with a simple real-world analogy.",
  },
  {
    icon: <Code className="w-3.5 h-3.5 text-blue-500" />,
    title: "Code Assistant",
    prompt: "Write a high-performance Python script to analyze CSV logs and detect anomalies.",
  },
  {
    icon: <Sparkles className="w-3.5 h-3.5 text-purple-500" />,
    title: "Interactive Canvas",
    prompt: "Create an interactive HTML and JavaScript financial compound interest calculator with a clean dark mode UI.",
  },
  {
    icon: <BookOpen className="w-3.5 h-3.5 text-emerald-500" />,
    title: "Study Guide",
    prompt: "Create a structured study guide with key takeaways and quiz questions on distributed consensus algorithms.",
  },
];

export default function ChatView() {
  const { messages, currentConversationId, sendMessage } = useChat();
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
    setShowScrollBottom(false);
  }, []);

  // When user manually scrolls with mouse wheel or touch, acknowledge manual interaction
  const handleUserInteraction = useCallback(() => {
    isProgrammaticScrollRef.current = false;
  }, []);

  // Detect user scroll position: show button and pause auto-scroll if scrolled up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // While smooth programmatic scroll is in progress, ignore distance until it settles
    if (isProgrammaticScrollRef.current) {
      if (distanceFromBottom <= 50) {
        isProgrammaticScrollRef.current = false;
        userScrolledUpRef.current = false;
        setShowScrollBottom(false);
      }
      return;
    }

    const isUp = distanceFromBottom > 120;
    setShowScrollBottom(isUp);
    userScrolledUpRef.current = isUp;
  }, []);

  // When switching conversations or opening a past chat, jump directly to bottom
  useEffect(() => {
    if (currentConversationId !== lastConversationIdRef.current) {
      lastConversationIdRef.current = currentConversationId;
      userScrolledUpRef.current = false;
      const timer = setTimeout(() => scrollToBottom("auto"), 60);
      return () => clearTimeout(timer);
    }
  }, [currentConversationId, scrollToBottom]);

  // When messages change (new user prompt or streaming tokens)
  useEffect(() => {
    const prevCount = lastMessageCountRef.current;
    const currentCount = messages.length;
    lastMessageCountRef.current = currentCount;

    if (currentCount === 0) return;

    // If a new message was added
    if (currentCount > prevCount) {
      const lastMsg = messages[messages.length - 1];
      // User sent a new message -> always scroll down immediately
      if (lastMsg?.role === "user") {
        userScrolledUpRef.current = false;
        scrollToBottom("smooth");
        return;
      }
    }

    // While streaming tokens, keep scrolled to bottom if user has not scrolled up
    if (!userScrolledUpRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 h-full relative overflow-hidden">
        <div className="flex flex-col items-center justify-center max-w-lg w-full mt-[-6vh] mb-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">AI Orchestrator</h1>
          <p className="text-[1rem] text-gray-500 dark:text-gray-400 mb-6">Your local AI workspace.</p>
          
          {/* Starter Prompt Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full mb-4 text-left">
            {STARTER_PROMPTS.map((starter, i) => (
              <button
                key={i}
                onClick={() => sendMessage(starter.prompt)}
                className="p-3 rounded-xl border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/5 transition-all text-left group cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  {starter.icon}
                  <span>{starter.title}</span>
                </div>
                <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                  {starter.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-[800px] mt-auto lg:mt-0 lg:absolute lg:bottom-0">
          <ChatComposer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full relative min-h-0">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleUserInteraction}
        onTouchMove={handleUserInteraction}
        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      >
        <div className="max-w-[800px] mx-auto flex flex-col gap-8 pb-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {/* Generous bottom spacer so the entire response and copy buttons sit comfortably above the chat box */}
          <div ref={bottomAnchorRef} className="h-44 sm:h-52 w-full pointer-events-none shrink-0" />
        </div>
      </div>

      {/* Floating Scroll to Bottom Button (Claude / ChatGPT style) */}
      {showScrollBottom && (
        <div className="absolute bottom-36 sm:bottom-40 right-6 sm:right-10 z-30">
          <button
            onClick={() => scrollToBottom("smooth")}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-[#27272a] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 shadow-lg hover:bg-gray-50 dark:hover:bg-[#323236] transition-all hover:scale-105 active:scale-95"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pt-10">
        <ChatComposer />
      </div>

      {/* Claude-style Artifact Canvas */}
      <ArtifactViewer />
    </div>
  );
}
