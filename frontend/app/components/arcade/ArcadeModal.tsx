"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Gamepad2, 
  X, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  ArrowRight, 
  Minimize2, 
  Maximize2,
  Grid,
  Sparkles,
  Trophy,
  Zap,
  Flame
} from "lucide-react";
import ArcadeVolleyball from "./ArcadeVolleyball";
import CyberHockey from "./CyberHockey";
import CyberSnake from "./CyberSnake";
import QuantumBreakout from "./QuantumBreakout";
import VoidRunner from "./VoidRunner";
import { arcadeAudio } from "./arcadeAudio";

export type GameType = "menu" | "volley" | "hockey" | "snake" | "breakout" | "runner";

const GAME_CATALOG = [
  {
    id: "volley" as const,
    name: "Arcade Volleyball",
    emoji: "🏐",
    category: "1v1 Competitive",
    desc: "Spike, bump and dive against intelligent Cyber AI bot. First to 5 wins!",
    badge: "1v1 REAL-TIME",
    color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-400",
  },
  {
    id: "hockey" as const,
    name: "Neon Air Hockey",
    emoji: "🏓",
    category: "1v1 Face-Off",
    desc: "High-speed puck ricochet duel against aggressive Cyber AI striker.",
    badge: "FAST PACED",
    color: "from-sky-500/20 to-purple-500/10 border-sky-500/30 text-sky-400",
  },
  {
    id: "snake" as const,
    name: "Cyber Snake",
    emoji: "🐍",
    category: "Classic Arcade",
    desc: "Speed-scaling neon serpent with combo streaks & bonus golden sparks.",
    badge: "COMBO STREAKS",
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400",
  },
  {
    id: "breakout" as const,
    name: "Quantum Breakout",
    emoji: "🧱",
    category: "Brick Breaker",
    desc: "Angle bounce physics, multi-hit neon bricks, and particle explosions.",
    badge: "HIGH SCORE",
    color: "from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-400",
  },
  {
    id: "runner" as const,
    name: "Void Runner",
    emoji: "🚀",
    category: "Hyperspace Dodge",
    desc: "Warp through asteroid fields & collect stardust crystals to survive.",
    badge: "ADRENALINE",
    color: "from-indigo-500/20 to-violet-500/10 border-indigo-500/30 text-indigo-400",
  },
];

interface ArcadeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
  onViewAnswer: () => void;
}

export default function ArcadeModal({
  isOpen,
  onClose,
  isGenerating,
  onViewAnswer,
}: ArcadeModalProps) {
  const [activeGame, setActiveGame] = useState<GameType>("volley");
  const [isMuted, setIsMuted] = useState(arcadeAudio.isMuted);
  const [showCompletionNotice, setShowCompletionNotice] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const wasGeneratingRef = useRef(isGenerating);

  // Monitor generation state change (true -> false)
  useEffect(() => {
    if (wasGeneratingRef.current && !isGenerating && isOpen) {
      arcadeAudio.playReadyChime();
      setShowCompletionNotice(true);
    }
    wasGeneratingRef.current = isGenerating;
  }, [isGenerating, isOpen]);

  // Reset completion banner when a new generation starts
  useEffect(() => {
    if (isGenerating) {
      setShowCompletionNotice(false);
    }
  }, [isGenerating]);

  const toggleMute = () => {
    const nextMuted = arcadeAudio.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleViewAnswer = () => {
    setShowCompletionNotice(false);
    onClose();
    onViewAnswer();
  };

  const handleKeepPlaying = () => {
    setShowCompletionNotice(false);
  };

  if (!isOpen) return null;

  // Minimized floating dock pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 right-5 z-50">
        <div className="flex items-center gap-2 p-2 rounded-2xl liquid-glass border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-xl animate-fade-in">
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-600 dark:text-sky-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <Gamepad2 className="w-4 h-4 animate-bounce" />
            <span>Resume Game</span>
            <Maximize2 className="w-3.5 h-3.5 ml-1 opacity-70" />
          </button>
          {!isGenerating && (
            <button
              onClick={handleViewAnswer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <span>View Answer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-[460px] rounded-3xl liquid-glass border border-white/30 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col relative transition-all"
        style={{
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.25)"
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/8 bg-white/20 dark:bg-zinc-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-xs">
              <Gamepad2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                  Neural Arcade
                </h3>
                {isGenerating ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-500 dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    ● Ready
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveGame(activeGame === "menu" ? "volley" : "menu")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeGame === "menu"
                  ? "bg-sky-500 text-black font-semibold shadow-xs"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              title="Select / Change Game"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Select Game</span>
            </button>
            <button
              onClick={toggleMute}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title={isMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Minimize to Dock"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Close Arcade"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Game Selector Bar (when game is active) */}
        {activeGame !== "menu" && (
          <div className="flex items-center justify-between overflow-x-auto p-1.5 bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/8 text-[11px] font-semibold gap-1 scrollbar-none">
            <button
              onClick={() => setActiveGame("volley")}
              className={`py-1 px-2.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeGame === "volley"
                  ? "bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-xs border border-cyan-500/30"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              🏐 Volley 1v1
            </button>
            <button
              onClick={() => setActiveGame("hockey")}
              className={`py-1 px-2.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeGame === "hockey"
                  ? "bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 shadow-xs border border-sky-500/30"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              🏓 Hockey 1v1
            </button>
            <button
              onClick={() => setActiveGame("snake")}
              className={`py-1 px-2.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeGame === "snake"
                  ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/30"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              🐍 Snake
            </button>
            <button
              onClick={() => setActiveGame("breakout")}
              className={`py-1 px-2.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeGame === "breakout"
                  ? "bg-white dark:bg-zinc-800 text-pink-600 dark:text-pink-400 shadow-xs border border-pink-500/30"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              🧱 Breakout
            </button>
            <button
              onClick={() => setActiveGame("runner")}
              className={`py-1 px-2.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeGame === "runner"
                  ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-500/30"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              🚀 Runner
            </button>
          </div>
        )}

        {/* Game Active Canvas Area OR Game Selection Menu */}
        <div className="p-4 flex flex-col items-center justify-center relative min-h-[410px]">
          {activeGame === "menu" ? (
            /* Dedicated Visual Game Selection Hub */
            <div className="w-full flex flex-col gap-2.5 py-1">
              <div className="text-center mb-1">
                <h4 className="text-sm font-bold text-[var(--foreground)]">
                  Select an Arcade Mini-Game
                </h4>
                <p className="text-[11px] text-[var(--muted)]">
                  Ultra-lightweight competitive games running at 60 FPS while you wait.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-1">
                {GAME_CATALOG.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGame(g.id)}
                    className="flex items-center gap-3.5 p-3 rounded-2xl liquid-glass-card text-left group hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border border-white/20 dark:border-white/10"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                      {g.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-[var(--foreground)] group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors">
                          {g.name}
                        </span>
                        <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-white/40 dark:bg-white/10 border border-white/20 text-[var(--muted)]">
                          {g.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] line-clamp-1 leading-relaxed">
                        {g.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeGame === "volley" && <ArcadeVolleyball />}
              {activeGame === "hockey" && <CyberHockey />}
              {activeGame === "snake" && <CyberSnake />}
              {activeGame === "breakout" && <QuantumBreakout />}
              {activeGame === "runner" && <VoidRunner />}
            </>
          )}

          {/* Liquid Glass Completion Overlay Banner */}
          {showCompletionNotice && (
            <div className="absolute inset-x-4 top-4 z-40 animate-slide-down">
              <div 
                className="p-3.5 rounded-2xl liquid-glass border border-emerald-500/40 bg-white/95 dark:bg-zinc-900/95 shadow-2xl backdrop-blur-2xl flex flex-col gap-2.5"
                style={{
                  boxShadow: "0 10px 30px -5px rgba(16, 185, 129, 0.2), 0 20px 40px rgba(0,0,0,0.5)"
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[var(--foreground)]">
                        Response Generated & Ready!
                      </h4>
                      <p className="text-[11px] text-[var(--muted)]">
                        Model has finished answering your prompt.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleViewAnswer}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 hover:brightness-110 active:scale-98 transition-all cursor-pointer"
                  >
                    <span>View Answer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleKeepPlaying}
                    className="py-2 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--foreground)] text-xs font-semibold transition-all cursor-pointer"
                  >
                    Keep Playing
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 border-t border-black/5 dark:border-white/8 bg-black/5 dark:bg-white/5 flex items-center justify-between text-[11px] text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-sky-400" /> &lt;0.5% CPU
            </span>
            <span>·</span>
            <span>&lt;2MB RAM</span>
          </div>
          <span>Zero LLM Inference Lag</span>
        </div>
      </div>
    </div>
  );
}
