"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Flame, Zap, Palette } from "lucide-react";
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
  active: boolean;
}

type SkinType = "viper" | "solar" | "matrix";

interface SkinConfig {
  name: string;
  head: string;
  headBorder: string;
  armorPrimary: string;
  armorSecondary: string;
  spine: string;
  visor: string;
  foodColor: string;
}

const SKINS: Record<SkinType, SkinConfig> = {
  viper: {
    name: "Mecha Viper",
    head: "#06b6d4",
    headBorder: "#38bdf8",
    armorPrimary: "#0284c7",
    armorSecondary: "#4f46e5",
    spine: "#facc15",
    visor: "#ffffff",
    foodColor: "#10b981",
  },
  solar: {
    name: "Solar Dragon",
    head: "#f97316",
    headBorder: "#fbbf24",
    armorPrimary: "#ea580c",
    armorSecondary: "#7c2d12",
    spine: "#fef08a",
    visor: "#ffffff",
    foodColor: "#38bdf8",
  },
  matrix: {
    name: "Matrix Serpent",
    head: "#10b981",
    headBorder: "#34d399",
    armorPrimary: "#059669",
    armorSecondary: "#064e3b",
    spine: "#a7f3d0",
    visor: "#ffffff",
    foodColor: "#ec4899",
  },
};

const MAX_PARTICLES = 36;

function CyberSnake() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTurbo, setIsTurbo] = useState(false);
  const [activeSkin, setActiveSkin] = useState<SkinType>("viper");

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
    baseTickInterval: 70, // snappy arcade rhythm
    turboTickInterval: 35, // nitro speed
    isTurboActive: false,
    skin: "viper" as SkinType,
    particlePool: Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      color: "#38bdf8",
      size: 2,
      active: false,
    })) as Particle[],
    screenShake: 0,
    quickEatCount: 0,
    lastEatTime: 0,
  });

  useEffect(() => {
    try {
      const savedScore = localStorage.getItem("ai_arcade_snake_highscore");
      if (savedScore) setHighScore(parseInt(savedScore, 10));
      const savedSkin = localStorage.getItem("ai_arcade_snake_skin") as SkinType;
      if (savedSkin && SKINS[savedSkin]) {
        setActiveSkin(savedSkin);
        stateRef.current.skin = savedSkin;
      }
    } catch {}
  }, []);

  const changeSkin = (newSkin: SkinType) => {
    setActiveSkin(newSkin);
    stateRef.current.skin = newSkin;
    try {
      localStorage.setItem("ai_arcade_snake_skin", newSkin);
    } catch {}
  };

  const addScreenShake = (amount: number) => {
    stateRef.current.screenShake = Math.max(stateRef.current.screenShake, amount);
  };

  const spawnParticles = (x: number, y: number, color: string, count = 10) => {
    const pool = stateRef.current.particlePool;
    let spawned = 0;
    for (let i = 0; i < pool.length && spawned < count; i++) {
      if (!pool[i].active) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 3.5 + 1.2;
        pool[i].x = x;
        pool[i].y = y;
        pool[i].vx = Math.cos(angle) * spd;
        pool[i].vy = Math.sin(angle) * spd;
        pool[i].life = 1.0;
        pool[i].color = color;
        pool[i].size = Math.random() * 2.5 + 1.5;
        pool[i].active = true;
        spawned++;
      }
    }
  };

  const spawnFood = useCallback(() => {
    const { tileCount, snake } = stateRef.current;
    let newFood: Point = { x: 0, y: 0 };
    let placed = false;
    let attempts = 0;

    // Fast-path random probing (O(1) average when board is not saturated)
    while (attempts++ < 200) {
      const rx = Math.floor(Math.random() * tileCount);
      const ry = Math.floor(Math.random() * tileCount);
      const onSnake = snake.some((seg) => seg.x === rx && seg.y === ry);
      if (!onSnake) {
        newFood = { x: rx, y: ry };
        placed = true;
        break;
      }
    }

    // Fallback: Exact scan of remaining open cells if board is densely populated
    if (!placed) {
      const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
      const freeSlots: Point[] = [];
      for (let x = 0; x < tileCount; x++) {
        for (let y = 0; y < tileCount; y++) {
          if (!occupied.has(`${x},${y}`)) {
            freeSlots.push({ x, y });
          }
        }
      }
      if (freeSlots.length > 0) {
        newFood = freeSlots[Math.floor(Math.random() * freeSlots.length)];
      } else {
        // Grid fully filled - player won the game!
        setIsGameOver(true);
        setIsPlaying(false);
        arcadeAudio.playReadyChime();
        return;
      }
    }

    stateRef.current.food = newFood;

    // 25% chance of bonus golden core (must not overlap food or snake)
    if (Math.random() < 0.25 && !stateRef.current.bonusFood) {
      let bAttempts = 0;
      while (bAttempts++ < 50) {
        const bx = Math.floor(Math.random() * tileCount);
        const by = Math.floor(Math.random() * tileCount);
        const onSnake = snake.some((seg) => seg.x === bx && seg.y === by);
        const onFood = newFood.x === bx && newFood.y === by;
        if (!onSnake && !onFood) {
          stateRef.current.bonusFood = { x: bx, y: by, timer: 100 };
          break;
        }
      }
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

    // Disallow 180-degree immediate self-reversal
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

  // Main 60-120 FPS Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    stateRef.current.lastTick = performance.now();

    const render = (time: number) => {
      const state = stateRef.current;
      const { tileCount, snake, prevSnake, food, bonusFood } = state;
      const cellSize = canvas.width / tileCount;
      const skin = SKINS[state.skin] || SKINS.viper;

      const currentInterval = state.isTurboActive ? state.turboTickInterval : state.baseTickInterval;

      // ── Physics Tick ──
      if (isPlaying && !isGameOver && time - state.lastTick >= currentInterval) {
        state.lastTick = time;
        state.prevSnake = snake.map((s) => ({ ...s }));

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

        // Self-collision
        const selfHit = snake.some((seg) => seg.x === head.x && seg.y === head.y);
        if (selfHit) {
          arcadeAudio.playCrash();
          addScreenShake(7);
          spawnParticles(head.x * cellSize + cellSize / 2, head.y * cellSize + cellSize / 2, "#ef4444", 20);
          setIsGameOver(true);
          setIsPlaying(false);
          return;
        }

        snake.unshift(head);

        // Food collision
        if (head.x === food.x && head.y === food.y) {
          arcadeAudio.playPoint();
          const now = performance.now();
          const isQuick = now - state.lastEatTime < 2400;
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

          spawnParticles(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, skin.foodColor, 12);

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
          arcadeAudio.playPowerup();
          addScreenShake(4);
          spawnParticles(bonusFood.x * cellSize + cellSize / 2, bonusFood.y * cellSize + cellSize / 2, "#facc15", 16);
          setScore((prev) => prev + 50);
          state.bonusFood = null;
        } else {
          snake.pop();
        }

        if (state.bonusFood) {
          state.bonusFood.timer -= 1;
          if (state.bonusFood.timer <= 0) state.bonusFood = null;
        }
      }

      // Update particle pool
      for (const p of state.particlePool) {
        if (p.active) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.05;
          if (p.life <= 0) p.active = false;
        }
      }

      if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - 0.4);

      // ── Draw Graphics ──
      ctx.save();
      if (state.screenShake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * state.screenShake * 2,
          (Math.random() - 0.5) * state.screenShake * 2
        );
      }

      // Background
      ctx.fillStyle = "#070c14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cyber Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
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

      // Sub-tile visual interpolation
      const interpAlpha = Math.min(1.0, Math.max(0.0, (time - state.lastTick) / currentInterval));

      // Draw Bonus Food
      if (bonusFood) {
        const bx = bonusFood.x * cellSize + cellSize / 2;
        const by = bonusFood.y * cellSize + cellSize / 2;
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(bx, by, cellSize / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw Food
      const fx = food.x * cellSize + cellSize / 2;
      const fy = food.y * cellSize + cellSize / 2;
      ctx.fillStyle = skin.foodColor;
      ctx.beginPath();
      ctx.arc(fx, fy, cellSize / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(fx - 2, fy - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // ── DRAW BRAND NEW MECHA VIPER SNAKE SKIN ──
      for (let i = snake.length - 1; i >= 0; i--) {
        const cur = snake[i];
        const prev = prevSnake[i] || cur;

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
          // Mecha Viper Head (Shield Hood)
          ctx.fillStyle = skin.head;
          ctx.strokeStyle = skin.headBorder;
          ctx.lineWidth = 2;

          ctx.beginPath();
          ctx.roundRect(px - cellSize / 2 + 1, py - cellSize / 2 + 1, cellSize - 2, cellSize - 2, 6);
          ctx.fill();
          ctx.stroke();

          // Cyber Optic Visor
          const eyeDist = 4;
          const eyeOffX = state.dir.y !== 0 ? eyeDist : state.dir.x * 4;
          const eyeOffY = state.dir.x !== 0 ? eyeDist : state.dir.y * 4;

          ctx.fillStyle = skin.visor;
          ctx.beginPath();
          ctx.arc(px + eyeOffX, py + eyeOffY, 2.5, 0, Math.PI * 2);
          ctx.arc(
            px - (state.dir.y !== 0 ? eyeDist : -state.dir.x * 4),
            py - (state.dir.x !== 0 ? eyeDist : -state.dir.y * 4),
            2.5,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else {
          // Articulated Cyber-Armor Body Scales
          const ratio = 1 - i / snake.length;
          const segSize = (cellSize / 2 - 1) * (0.75 + 0.25 * ratio);

          ctx.fillStyle = i % 2 === 0 ? skin.armorPrimary : skin.armorSecondary;
          ctx.beginPath();
          ctx.roundRect(px - segSize, py - segSize, segSize * 2, segSize * 2, 4);
          ctx.fill();

          // Glowing Central Energy Spine
          ctx.fillStyle = skin.spine;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(1.5, 2.5 * ratio), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Particles
      for (const p of state.particlePool) {
        if (p.active) {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
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
      <div className="flex items-center justify-between w-full px-2 mb-2 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-emerald-400 font-bold">SCORE:</span>
            <span className="font-extrabold text-white text-sm">{score}</span>
          </div>
          {combo > 1 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
              <Flame className="w-3 h-3 text-emerald-400" />
              <span>{combo}X</span>
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

      {/* Skin Selector Bar */}
      <div className="flex items-center justify-between w-full px-2 mb-2 text-[11px]">
        <div className="flex items-center gap-1 text-[var(--muted)]">
          <Palette className="w-3.5 h-3.5 text-sky-400" />
          <span>SKIN:</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["viper", "solar", "matrix"] as SkinType[]).map((sk) => (
            <button
              key={sk}
              onClick={() => changeSkin(sk)}
              className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                activeSkin === sk
                  ? "bg-white/20 border-white/40 text-white shadow-xs"
                  : "bg-white/5 border-transparent text-[var(--muted)] hover:text-white"
              }`}
            >
              {SKINS[sk].name}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Grid */}
      <div className="relative rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-black/80 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={330}
          className="block aspect-[12/11] max-w-[340px] sm:max-w-[360px]"
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
                  WASD / Arrows to turn. Hold <b>Spacebar</b> for <b>Turbo Boost</b>! Switch skins anytime.
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
            onTouchCancel={() => {
              stateRef.current.isTurboActive = false;
              setIsTurbo(false);
            }}
            onMouseDown={() => {
              stateRef.current.isTurboActive = true;
              setIsTurbo(true);
            }}
            onMouseUp={() => {
              stateRef.current.isTurboActive = false;
              setIsTurbo(false);
            }}
            onMouseLeave={() => {
              stateRef.current.isTurboActive = false;
              setIsTurbo(false);
            }}
            className="w-12 h-10 rounded-xl bg-sky-500 text-black font-bold flex items-center justify-center text-xs cursor-pointer select-none active:scale-95"
            title="Hold for Turbo"
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

export default React.memo(CyberSnake);
