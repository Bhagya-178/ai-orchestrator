"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Flame } from "lucide-react";
import { arcadeAudio } from "./arcadeAudio";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function CyberSnake() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Game internal state stored in refs to avoid re-renders during 60FPS loop
  const stateRef = useRef({
    gridSize: 20,
    tileCount: 20,
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 10 },
    bonusFood: null as { x: number; y: number; timer: number } | null,
    dir: { x: 0, y: 0 },
    nextDir: { x: 0, y: 0 },
    lastTick: 0,
    tickInterval: 90, // ms
    particles: [] as Particle[],
    consecutiveQuickEats: 0,
    lastEatTime: 0,
  });

  // Load high score
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_snake_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const spawnFood = useCallback(() => {
    const { tileCount, snake } = stateRef.current;
    let newFood: { x: number; y: number } = { x: 0, y: 0 };
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
      };
      const onSnake = snake.some((seg) => seg.x === newFood.x && seg.y === newFood.y);
      if (!onSnake) break;
    }
    stateRef.current.food = newFood;

    // 25% chance of spawning bonus gold food
    if (Math.random() < 0.25 && !stateRef.current.bonusFood) {
      stateRef.current.bonusFood = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
        timer: 80, // frames
      };
    }
  }, []);

  const createParticles = (x: number, y: number, color: string, count = 12) => {
    const particles = stateRef.current.particles;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color,
      });
    }
  };

  const startGame = useCallback(() => {
    stateRef.current.snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    stateRef.current.dir = { x: 1, y: 0 };
    stateRef.current.nextDir = { x: 1, y: 0 };
    stateRef.current.particles = [];
    stateRef.current.tickInterval = 90;
    stateRef.current.consecutiveQuickEats = 0;
    stateRef.current.bonusFood = null;
    spawnFood();
    setScore(0);
    setCombo(1);
    setIsGameOver(false);
    setIsPlaying(true);
  }, [spawnFood]);

  const handleDirInput = useCallback((dx: number, dy: number) => {
    const { dir } = stateRef.current;
    if (dx !== 0 && dir.x === 0) {
      stateRef.current.nextDir = { x: dx, y: 0 };
    } else if (dy !== 0 && dir.y === 0) {
      stateRef.current.nextDir = { x: 0, y: dy };
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) {
        if (e.code === "Space" || e.code === "Enter") {
          startGame();
        }
        return;
      }

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          handleDirInput(0, -1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          handleDirInput(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          handleDirInput(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          handleDirInput(1, 0);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, handleDirInput, startGame]);

  // Main 60FPS Render & Game Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = (time: number) => {
      const state = stateRef.current;
      const { tileCount, snake, food, bonusFood } = state;
      const cellSize = canvas.width / tileCount;

      // Update game physics on tick interval
      if (isPlaying && !isGameOver && time - state.lastTick > state.tickInterval) {
        state.lastTick = time;
        state.dir = state.nextDir;

        const head = {
          x: snake[0].x + state.dir.x,
          y: snake[0].y + state.dir.y,
        };

        // Wall wrap-around
        if (head.x < 0) head.x = tileCount - 1;
        if (head.x >= tileCount) head.x = 0;
        if (head.y < 0) head.y = tileCount - 1;
        if (head.y >= tileCount) head.y = 0;

        // Self collision check
        const hitSelf = snake.some((seg) => seg.x === head.x && seg.y === head.y);
        if (hitSelf) {
          arcadeAudio.playCrash();
          setIsGameOver(true);
          setIsPlaying(false);
          return;
        }

        snake.unshift(head);

        // Food collision
        const px = head.x * cellSize + cellSize / 2;
        const py = head.y * cellSize + cellSize / 2;

        if (head.x === food.x && head.y === food.y) {
          arcadeAudio.playPoint();
          createParticles(px, py, "#10b981", 14);

          // Calculate combo
          const now = Date.now();
          const timeSinceLast = now - state.lastEatTime;
          state.lastEatTime = now;
          let newMultiplier = 1;
          if (timeSinceLast < 2500) {
            state.consecutiveQuickEats += 1;
            newMultiplier = Math.min(4, 1 + state.consecutiveQuickEats);
          } else {
            state.consecutiveQuickEats = 0;
          }
          setCombo(newMultiplier);

          const addedScore = 10 * newMultiplier;
          setScore((prev) => {
            const next = prev + addedScore;
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

          // Accelerate slightly
          state.tickInterval = Math.max(55, state.tickInterval - 1);
          spawnFood();
        } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
          arcadeAudio.playBreak();
          createParticles(px, py, "#fbbf24", 20);
          setScore((prev) => prev + 50);
          state.bonusFood = null;
        } else {
          snake.pop();
        }

        // Tick bonus food timer
        if (state.bonusFood) {
          state.bonusFood.timer -= 1;
          if (state.bonusFood.timer <= 0) {
            state.bonusFood = null;
          }
        }
      }

      // Draw canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cyber Grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
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

      // Draw Bonus Gold Food
      if (bonusFood) {
        const bx = bonusFood.x * cellSize + cellSize / 2;
        const by = bonusFood.y * cellSize + cellSize / 2;
        ctx.save();
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(bx, by, cellSize / 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Regular Food (Emerald Orb)
      const fx = food.x * cellSize + cellSize / 2;
      const fy = food.y * cellSize + cellSize / 2;
      ctx.save();
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(fx, fy, cellSize / 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Snake Body & Head
      snake.forEach((seg, i) => {
        const sx = seg.x * cellSize + 1.5;
        const sy = seg.y * cellSize + 1.5;
        const sSize = cellSize - 3;
        ctx.save();

        if (i === 0) {
          // Head
          ctx.fillStyle = "#38bdf8";
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 10;
        } else {
          // Gradual trail
          const ratio = 1 - i / Math.max(snake.length, 1);
          ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0.35, ratio)})`;
        }

        ctx.beginPath();
        ctx.roundRect(sx, sy, sSize, sSize, 4);
        ctx.fill();
        ctx.restore();
      });

      // Update & Draw Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) {
          state.particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

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
            <span className="text-[var(--muted)]">SCORE:</span>
            <span className="font-bold text-sky-400 text-sm">{score}</span>
          </div>
          {combo > 1 && (
            <div className="flex items-center gap-1 text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] animate-pulse">
              <Flame className="w-3 h-3 fill-current" />
              <span>{combo}x COMBO</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 font-mono text-[var(--muted)] text-[11px]">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span>BEST: {highScore}</span>
        </div>
      </div>

      {/* Canvas Board */}
      <div className="relative rounded-2xl overflow-hidden border border-sky-500/20 shadow-lg bg-black/60 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          className="block aspect-square max-w-[340px] sm:max-w-[360px]"
        />

        {/* Start / Game Over Overlay */}
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            {isGameOver ? (
              <>
                <p className="text-red-400 font-bold text-lg mb-1 tracking-wider">COLLISION DETECTED</p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{score}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium text-xs shadow-md shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Play Again</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 text-sky-400 fill-sky-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Cyber Snake</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[200px] mb-4">
                  Arrow keys or WASD to navigate. Eat orbs to multiply your streak!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Press to Start
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* D-Pad Controls for mobile or trackpad */}
      <div className="grid grid-cols-3 gap-1.5 w-36 mt-3 sm:hidden">
        <div />
        <button
          onClick={() => handleDirInput(0, -1)}
          className="p-2 rounded-lg bg-white/10 active:bg-white/20 text-white text-xs font-bold"
        >
          ▲
        </button>
        <div />
        <button
          onClick={() => handleDirInput(-1, 0)}
          className="p-2 rounded-lg bg-white/10 active:bg-white/20 text-white text-xs font-bold"
        >
          ◀
        </button>
        <button
          onClick={() => handleDirInput(0, 1)}
          className="p-2 rounded-lg bg-white/10 active:bg-white/20 text-white text-xs font-bold"
        >
          ▼
        </button>
        <button
          onClick={() => handleDirInput(1, 0)}
          className="p-2 rounded-lg bg-white/10 active:bg-white/20 text-white text-xs font-bold"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
