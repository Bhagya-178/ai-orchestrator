"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/app/lib/context/ChatContext";
import MessageBubble from "./MessageBubble";
import ChatComposer from "./ChatComposer";

export default function ChatView() {
  const { messages } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 h-full relative">
        <div className="flex flex-col items-center justify-center max-w-lg w-full mt-[-10vh] mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">AI Orchestrator</h1>
          <p className="text-[1.05rem] text-gray-500 dark:text-gray-400 mb-6">Your local AI workspace.</p>
          <div className="text-sm text-gray-400 dark:text-gray-500 mb-8 flex flex-col gap-1">
            <span>One interface. Four specialized local models. Automatic routing.</span>
            <div className="flex items-center justify-center gap-2 mt-2 font-medium">
              <span>General</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>Coding</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>Study</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>Reasoning</span>
            </div>
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
        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      >
        <div className="max-w-[800px] mx-auto flex flex-col gap-8 pb-32">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pt-10">
        <ChatComposer />
      </div>
    </div>
  );
}
