"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Award, Zap } from "lucide-react";
import { arcadeAudio } from "./arcadeAudio";

interface Striker {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

export default function CyberHockey() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);

  const stateRef = useRef({
    table: { w: 360, h: 320, goalY1: 110, goalY2: 210 },
    player: { x: 55, y: 160, radius: 18, color: "#38bdf8" } as Striker,
    ai: { x: 305, y: 160, radius: 18, color: "#a855f7" } as Striker,
    puck: { x: 180, y: 160, vx: 3.5, vy: 1.5, radius: 10, speed: 4.5 } as Puck,
    keys: { up: false, down: false, left: false, right: false },
    scorePause: 0,
    trails: [] as { x: number; y: number; alpha: number }[],
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_hockey_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const resetPuck = useCallback((towards: "player" | "ai") => {
    const { puck, player, ai } = stateRef.current;
    player.x = 55;
    player.y = 160;
    ai.x = 305;
    ai.y = 160;
    puck.x = 180;
    puck.y = 160;
    puck.vx = towards === "player" ? -3.5 : 3.5;
    puck.vy = (Math.random() - 0.5) * 3;
    stateRef.current.trails = [];
    stateRef.current.scorePause = 35;
  }, []);

  const startGame = useCallback(() => {
    setPlayerScore(0);
    setAiScore(0);
    setWinner(null);
    setIsPlaying(true);
    resetPuck("player");
    arcadeAudio.playWhistle();
  }, [resetPuck]);

  // Pointer move tracking for player striker
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const targetX = (e.clientX - rect.left) * scaleX;
    const targetY = (e.clientY - rect.top) * scaleY;

    const { player, table } = stateRef.current;
    // Constrain player to their half of the table
    player.x = Math.max(player.radius + 4, Math.min(table.w / 2 - player.radius - 8, targetX));
    player.y = Math.max(player.radius + 4, Math.min(table.h - player.radius - 4, targetY));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) {
        if (e.code === "Space" || e.code === "Enter") startGame();
        return;
      }
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") stateRef.current.keys.up = true;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") stateRef.current.keys.down = true;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") stateRef.current.keys.left = true;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") stateRef.current.keys.right = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") stateRef.current.keys.up = false;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") stateRef.current.keys.down = false;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") stateRef.current.keys.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") stateRef.current.keys.right = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPlaying, startGame]);

  // 60FPS Game Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const state = stateRef.current;
      const { player, ai, puck, table, keys } = state;

      if (isPlaying && !winner) {
        if (state.scorePause > 0) {
          state.scorePause -= 1;
        } else {
          // Keyboard player movement
          const kSpeed = 5;
          if (keys.up) player.y = Math.max(player.radius + 4, player.y - kSpeed);
          if (keys.down) player.y = Math.min(table.h - player.radius - 4, player.y + kSpeed);
          if (keys.left) player.x = Math.max(player.radius + 4, player.x - kSpeed);
          if (keys.right) player.x = Math.min(table.w / 2 - player.radius - 8, player.x + kSpeed);

          // AI Striker Logic
          const aiTargetY = puck.y;
          const aiTargetX = puck.x > table.w / 2 ? Math.min(table.w - ai.radius - 12, puck.x + 10) : 295;

          const dy = aiTargetY - ai.y;
          const dx = aiTargetX - ai.x;
          ai.y += Math.sign(dy) * Math.min(4.2, Math.abs(dy));
          ai.x += Math.sign(dx) * Math.min(3.8, Math.abs(dx));

          // Constrain AI to right half
          ai.x = Math.max(table.w / 2 + ai.radius + 8, Math.min(table.w - ai.radius - 4, ai.x));
          ai.y = Math.max(ai.radius + 4, Math.min(table.h - ai.radius - 4, ai.y));

          // Move Puck
          puck.x += puck.vx;
          puck.y += puck.vy;

          // Trail points
          state.trails.push({ x: puck.x, y: puck.y, alpha: 0.6 });
          if (state.trails.length > 8) state.trails.shift();

          // Top and Bottom wall bounces
          if (puck.y - puck.radius <= 0) {
            puck.y = puck.radius;
            puck.vy = Math.abs(puck.vy);
            arcadeAudio.playBounce();
          } else if (puck.y + puck.radius >= table.h) {
            puck.y = table.h - puck.radius;
            puck.vy = -Math.abs(puck.vy);
            arcadeAudio.playBounce();
          }

          // Left Wall / Goal Check
          if (puck.x - puck.radius <= 0) {
            if (puck.y >= table.goalY1 && puck.y <= table.goalY2) {
              // Goal for AI!
              arcadeAudio.playWhistle();
              setAiScore((prev) => {
                const next = prev + 1;
                if (next >= 5) {
                  setWinner("ai");
                  setIsPlaying(false);
                } else {
                  resetPuck("player");
                }
                return next;
              });
            } else {
              puck.x = puck.radius;
              puck.vx = Math.abs(puck.vx);
              arcadeAudio.playBounce();
            }
          }

          // Right Wall / Goal Check
          if (puck.x + puck.radius >= table.w) {
            if (puck.y >= table.goalY1 && puck.y <= table.goalY2) {
              // Goal for Player!
              arcadeAudio.playSpike();
              setPlayerScore((prev) => {
                const next = prev + 1;
                setHighScore((prevHigh) => {
                  if (next > prevHigh) {
                    try {
                      localStorage.setItem("ai_arcade_hockey_highscore", String(next));
                    } catch {}
                    return next;
                  }
                  return prevHigh;
                });
                if (next >= 5) {
                  arcadeAudio.playReadyChime();
                  setWinner("player");
                  setIsPlaying(false);
                } else {
                  resetPuck("ai");
                }
                return next;
              });
            } else {
              puck.x = table.w - puck.radius;
              puck.vx = -Math.abs(puck.vx);
              arcadeAudio.playBounce();
            }
          }

          // Collision with Strikers
          const handleStrikerHit = (s: Striker) => {
            const cdx = puck.x - s.x;
            const cdy = puck.y - s.y;
            const dist = Math.hypot(cdx, cdy);
            if (dist < s.radius + puck.radius) {
              arcadeAudio.playBounce();
              const angle = Math.atan2(cdy, cdx);
              const speed = Math.min(8.5, Math.hypot(puck.vx, puck.vy) + 0.8);
              puck.vx = Math.cos(angle) * speed;
              puck.vy = Math.sin(angle) * speed;

              // Push puck outside striker to prevent stickiness
              puck.x = s.x + Math.cos(angle) * (s.radius + puck.radius + 1);
              puck.y = s.y + Math.sin(angle) * (s.radius + puck.radius + 1);
            }
          };

          handleStrikerHit(player);
          handleStrikerHit(ai);
        }
      }

      // Draw Graphics
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cyber Table Surface
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, table.w, table.h);

      // Table Border & Rink Markings
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, table.w - 4, table.h - 4);

      // Center Line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(table.w / 2, 0);
      ctx.lineTo(table.w / 2, table.h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center Circle
      ctx.beginPath();
      ctx.arc(table.w / 2, table.h / 2, 35, 0, Math.PI * 2);
      ctx.stroke();

      // Goal Boxes
      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.fillRect(0, table.goalY1, 6, table.goalY2 - table.goalY1);
      ctx.fillStyle = "rgba(168, 85, 247, 0.15)";
      ctx.fillRect(table.w - 6, table.goalY1, 6, table.goalY2 - table.goalY1);

      // Puck Trails
      state.trails.forEach((t) => {
        ctx.save();
        ctx.fillStyle = `rgba(250, 204, 21, ${t.alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, puck.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        t.alpha -= 0.05;
      });

      // Draw Puck
      ctx.save();
      ctx.fillStyle = "#facc15";
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Player Striker (Cyan)
      ctx.save();
      ctx.fillStyle = player.color;
      ctx.shadowColor = player.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(player.x, player.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw AI Striker (Purple)
      ctx.save();
      ctx.fillStyle = ai.color;
      ctx.shadowColor = ai.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(ai.x, ai.y, ai.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ai.x, ai.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, winner, resetPuck]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* HUD Header */}
      <div className="flex items-center justify-between w-full px-2 mb-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-sky-400 font-bold">YOU:</span>
            <span className="font-extrabold text-white text-sm">{playerScore}</span>
          </div>
          <span className="text-zinc-500 font-bold">VS</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-purple-400 font-bold">CYBER AI:</span>
            <span className="font-extrabold text-white text-sm">{aiScore}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 font-mono text-[var(--muted)] text-[11px]">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span>WINS: {highScore}</span>
        </div>
      </div>

      {/* Canvas Table */}
      <div className="relative rounded-2xl overflow-hidden border border-sky-500/20 shadow-xl bg-black/70 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={320}
          onPointerMove={handlePointerMove}
          className="block aspect-[18/16] max-w-[340px] sm:max-w-[360px] cursor-crosshair touch-none"
        />

        {/* Start / Game Over Overlay */}
        {(!isPlaying || winner) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            {winner ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-3">
                  {winner === "player" ? (
                    <Award className="w-6 h-6 text-yellow-400 animate-bounce" />
                  ) : (
                    <Trophy className="w-6 h-6 text-purple-400" />
                  )}
                </div>
                <p className={`font-bold text-lg mb-1 tracking-wider ${winner === "player" ? "text-sky-400" : "text-purple-400"}`}>
                  {winner === "player" ? "CHAMPION! 🏆" : "AI DEFENDED!"}
                </p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{playerScore} - {aiScore}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-medium text-xs shadow-md shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Face Off Again</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-sky-400 fill-sky-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Neon Air Hockey 1v1</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[220px] mb-4">
                  Drag with mouse/touch or use WASD to slam the puck into the Cyber AI goal!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Start Face-Off
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Tip: Drag mouse or use WASD / Arrow keys
      </p>
    </div>
  );
}
