"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Flame, Zap } from "lucide-react";
import { arcadeAudio } from "./arcadeAudio";

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export default function CyberSnake() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTurbo, setIsTurbo] = useState(false);

  const stateRef = useRef({
    gridSize: 20,
    tileCount: 20,
    snake: [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ] as Point[],
    prevSnake: [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ] as Point[],
    food: { x: 15, y: 10 } as Point,
    bonusFood: null as { x: number; y: number; timer: number } | null,
    dir: { x: 1, y: 0 } as Point,
    inputQueue: [] as Point[],
    lastTick: 0,
    baseTickInterval: 68, // fast arcade pace
    turboTickInterval: 32, // blazing turbo pace
    isTurboActive: false,
    particles: [] as Particle[],
    screenShake: 0,
    quickEatCount: 0,
    lastEatTime: 0,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_snake_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const addScreenShake = (amount: number) => {
    stateRef.current.screenShake = Math.max(stateRef.current.screenShake, amount);
  };

  const spawnParticles = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      stateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color,
        size: Math.random() * 3 + 2,
      });
    }
  };

  const spawnFood = useCallback(() => {
    const { tileCount, snake } = stateRef.current;
    let newFood: Point = { x: 0, y: 0 };
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
      };
      const onSnake = snake.some((seg) => seg.x === newFood.x && seg.y === newFood.y);
      if (!onSnake) break;
    }
    stateRef.current.food = newFood;

    // 25% chance of spawning bonus golden core
    if (Math.random() < 0.30 && !stateRef.current.bonusFood) {
      stateRef.current.bonusFood = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
        timer: 100,
      };
    }
  }, []);

  const startGame = useCallback(() => {
    const initialSnake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    stateRef.current.snake = [...initialSnake];
    stateRef.current.prevSnake = [...initialSnake];
    stateRef.current.dir = { x: 1, y: 0 };
    stateRef.current.inputQueue = [];
    stateRef.current.particles = [];
    stateRef.current.quickEatCount = 0;
    stateRef.current.bonusFood = null;
    stateRef.current.screenShake = 0;
    stateRef.current.isTurboActive = false;
    setIsTurbo(false);
    spawnFood();
    setScore(0);
    setCombo(1);
    setIsGameOver(false);
    setIsPlaying(true);
    arcadeAudio.playReadyChime();
  }, [spawnFood]);

  const queueDirection = useCallback((dx: number, dy: number) => {
    const { inputQueue, dir } = stateRef.current;
    const lastPending = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : dir;

    // Disallow 180-degree immediate reversal
    if (dx !== 0 && lastPending.x === 0) {
      if (inputQueue.length < 3) inputQueue.push({ x: dx, y: 0 });
    } else if (dy !== 0 && lastPending.y === 0) {
      if (inputQueue.length < 3) inputQueue.push({ x: 0, y: dy });
    }
  }, []);

  // Keyboard navigation & Turbo Boost
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) {
        if (e.code === "Space" || e.code === "Enter") startGame();
        return;
      }

      if (e.code === "Space" || e.key === "Shift") {
        stateRef.current.isTurboActive = true;
        setIsTurbo(true);
      }

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          queueDirection(0, -1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          queueDirection(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          queueDirection(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          queueDirection(1, 0);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "Shift") {
        stateRef.current.isTurboActive = false;
        setIsTurbo(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPlaying, queueDirection, startGame]);

  // Main 60-120 FPS Loop with Sub-Tile Interpolation
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stateRef.current.lastTick = performance.now();

    const render = (time: number) => {
      const state = stateRef.current;
      const { tileCount, snake, prevSnake, food, bonusFood } = state;
      const cellSize = canvas.width / tileCount;

      const currentInterval = state.isTurboActive ? state.turboTickInterval : state.baseTickInterval;

      // ── Game Physics Tick ──
      if (isPlaying && !isGameOver && time - state.lastTick >= currentInterval) {
        state.lastTick = time;

        // Save current positions for smooth visual interpolation
        state.prevSnake = snake.map((s) => ({ ...s }));

        // Pop next direction from buffer queue
        if (state.inputQueue.length > 0) {
          state.dir = state.inputQueue.shift()!;
        }

        const head = {
          x: snake[0].x + state.dir.x,
          y: snake[0].y + state.dir.y,
        };

        // Wall wrap-around
        if (head.x < 0) head.x = tileCount - 1;
        if (head.x >= tileCount) head.x = 0;
        if (head.y < 0) head.y = tileCount - 1;
        if (head.y >= tileCount) head.y = 0;

        // Self-collision check
        const selfHit = snake.some((seg) => seg.x === head.x && seg.y === head.y);
        if (selfHit) {
          arcadeAudio.playCrash();
          addScreenShake(8);
          spawnParticles(head.x * cellSize + cellSize / 2, head.y * cellSize + cellSize / 2, "#ef4444", 25);
          setIsGameOver(true);
          setIsPlaying(false);
          return;
        }

        snake.unshift(head);

        // Check Food Eaten
        if (head.x === food.x && head.y === food.y) {
          arcadeAudio.playPoint();
          const now = performance.now();
          const isQuick = now - state.lastEatTime < 2500;
          state.lastEatTime = now;

          if (isQuick) {
            state.quickEatCount += 1;
            setCombo((c) => Math.min(5, c + 1));
          } else {
            state.quickEatCount = 0;
            setCombo(1);
          }

          const multiplier = state.isTurboActive ? 2 : 1;
          const pointsEarned = 10 * (state.quickEatCount > 1 ? 2 : 1) * multiplier;

          spawnParticles(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, "#10b981", 14);

          setScore((prev) => {
            const next = prev + pointsEarned;
            setHighScore((prevHigh) => {
              if (next > prevHigh) {
                try {
                  localStorage.setItem("ai_arcade_snake_highscore", String(next));
                } catch {}
                return next;
              }
              return prevHigh;
            });
            return next;
          });

          spawnFood();
        } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
          // Bonus Golden Food
          arcadeAudio.playPowerup();
          addScreenShake(4);
          spawnParticles(bonusFood.x * cellSize + cellSize / 2, bonusFood.y * cellSize + cellSize / 2, "#facc15", 20);
          setScore((prev) => prev + 50);
          state.bonusFood = null;
        } else {
          // Normal move: remove tail
          snake.pop();
        }

        // Bonus Food Timer countdown
        if (state.bonusFood) {
          state.bonusFood.timer -= 1;
          if (state.bonusFood.timer <= 0) state.bonusFood = null;
        }

        // Spawn turbo exhaust particles from snake tail
        if (state.isTurboActive && snake.length > 1) {
          const tail = snake[snake.length - 1];
          spawnParticles(tail.x * cellSize + cellSize / 2, tail.y * cellSize + cellSize / 2, "#38bdf8", 2);
        }
      }

      // Update Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - 0.4);

      // ── Render Graphics ──
      ctx.save();
      if (state.screenShake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * state.screenShake * 2.5,
          (Math.random() - 0.5) * state.screenShake * 2.5
        );
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cyber Grid Background
      ctx.fillStyle = "#070c14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(16, 185, 129, 0.06)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
      }

      // Sub-tile visual interpolation factor (0.0 to 1.0)
      const interpAlpha = Math.min(1.0, Math.max(0.0, (time - state.lastTick) / currentInterval));

      // Draw Bonus Gold Food
      if (bonusFood) {
        const bx = bonusFood.x * cellSize + cellSize / 2;
        const by = bonusFood.y * cellSize + cellSize / 2;
        const pulse = Math.sin(time * 0.015) * 3;

        ctx.save();
        ctx.shadowColor = "#facc15";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(bx, by, cellSize / 2 - 2 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Standard Energy Core (Food)
      const fx = food.x * cellSize + cellSize / 2;
      const fy = food.y * cellSize + cellSize / 2;
      const fPulse = Math.sin(time * 0.01) * 2;

      ctx.save();
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(fx, fy, cellSize / 2 - 3 + fPulse, 0, Math.PI * 2);
      ctx.fill();

      // Core Sparkle
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(fx - 2, fy - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Smooth Snake Body Segments
      for (let i = snake.length - 1; i >= 0; i--) {
        const cur = snake[i];
        const prev = prevSnake[i] || cur;

        // Handle wrap-around distance anomaly
        let renderX = cur.x;
        let renderY = cur.y;
        if (Math.abs(cur.x - prev.x) <= 1) {
          renderX = prev.x + (cur.x - prev.x) * interpAlpha;
        }
        if (Math.abs(cur.y - prev.y) <= 1) {
          renderY = prev.y + (cur.y - prev.y) * interpAlpha;
        }

        const px = renderX * cellSize + cellSize / 2;
        const py = renderY * cellSize + cellSize / 2;
        const isHead = i === 0;

        ctx.save();
        if (isHead) {
          ctx.shadowColor = state.isTurboActive ? "#38bdf8" : "#10b981";
          ctx.shadowBlur = state.isTurboActive ? 22 : 14;
          ctx.fillStyle = state.isTurboActive ? "#38bdf8" : "#34d399";
        } else {
          const ratio = 1 - i / snake.length;
          ctx.shadowColor = "#10b981";
          ctx.shadowBlur = 6 * ratio;
          ctx.fillStyle = state.isTurboActive ? `rgba(56, 189, 248, ${0.4 + 0.6 * ratio})` : `rgba(16, 185, 129, ${0.35 + 0.65 * ratio})`;
        }

        ctx.beginPath();
        const segRadius = isHead ? cellSize / 2 - 1 : (cellSize / 2 - 2) * (0.75 + 0.25 * (1 - i / snake.length));
        ctx.arc(px, py, Math.max(3, segRadius), 0, Math.PI * 2);
        ctx.fill();

        // Eyes on Head facing direction
        if (isHead) {
          const eyeDist = 4;
          const eyeOffX = state.dir.y !== 0 ? eyeDist : state.dir.x * 3;
          const eyeOffY = state.dir.x !== 0 ? eyeDist : state.dir.y * 3;

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(px + eyeOffX, py + eyeOffY, 2.2, 0, Math.PI * 2);
          ctx.arc(px - (state.dir.y !== 0 ? eyeDist : -state.dir.x * 3), py - (state.dir.x !== 0 ? eyeDist : -state.dir.y * 3), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isGameOver, spawnFood]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* HUD Header */}
      <div className="flex items-center justify-between w-full px-2 mb-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-emerald-400 font-bold">SCORE:</span>
            <span className="font-extrabold text-white text-sm">{score}</span>
          </div>
          {combo > 1 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 animate-pulse">
              <Flame className="w-3 h-3 text-emerald-400" />
              <span>{combo}X COMBO</span>
            </div>
          )}
          {isTurbo && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold border border-sky-500/30">
              <Zap className="w-3 h-3 text-sky-400 fill-sky-400" />
              <span>TURBO</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 font-mono text-[var(--muted)] text-[11px]">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span>BEST: {highScore}</span>
        </div>
      </div>

      {/* Canvas Grid */}
      <div className="relative rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-black/80 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          className="block aspect-square max-w-[340px] sm:max-w-[360px]"
        />

        {/* Start / Game Over Overlay */}
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            {isGameOver ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
                  <Flame className="w-6 h-6 text-red-400" />
                </div>
                <p className="font-bold text-lg mb-1 tracking-wider text-red-400">
                  SYSTEM OVERLOAD!
                </p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{score}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-semibold text-xs shadow-md shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reboot Snake</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 text-emerald-400 fill-emerald-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Cyber Snake 2.0</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[240px] mb-4">
                  WASD / Arrows to turn. Hold <b>Spacebar</b> for <b>Turbo Nitro Boost</b>! Buffer turns without missing corners.
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Initiate Serpent
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile D-Pad Controls */}
      <div className="flex flex-col items-center mt-3 sm:hidden gap-1.5 w-full max-w-[240px]">
        <button
          onClick={() => queueDirection(0, -1)}
          className="w-12 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white font-bold flex items-center justify-center text-sm"
        >
          ▲
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => queueDirection(-1, 0)}
            className="w-12 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white font-bold flex items-center justify-center text-sm"
          >
            ◀
          </button>
          <button
            onTouchStart={() => {
              stateRef.current.isTurboActive = true;
              setIsTurbo(true);
            }}
            onTouchEnd={() => {
              stateRef.current.isTurboActive = false;
              setIsTurbo(false);
            }}
            className="w-12 h-10 rounded-xl bg-sky-500 text-black font-bold flex items-center justify-center text-xs"
          >
            ⚡
          </button>
          <button
            onClick={() => queueDirection(1, 0)}
            className="w-12 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white font-bold flex items-center justify-center text-sm"
          >
            ▶
          </button>
        </div>
        <button
          onClick={() => queueDirection(0, 1)}
          className="w-12 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white font-bold flex items-center justify-center text-sm"
        >
          ▼
        </button>
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Controls: <b>WASD / Arrows</b> to Turn · <b>Hold Space / Shift</b> Turbo Boost
      </p>
    </div>
  );
}
