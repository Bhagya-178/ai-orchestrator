"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Zap } from "lucide-react";
import { arcadeAudio } from "./arcadeAudio";

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: number;
  hits: number;
  maxHits: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function QuantumBreakout() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);

  const stateRef = useRef({
    paddle: { x: 130, y: 330, w: 75, h: 10, speed: 6 },
    ball: { x: 170, y: 310, vx: 3, vy: -4, radius: 5 },
    bricks: [] as Brick[],
    particles: [] as Particle[],
    keys: { left: false, right: false },
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_breakout_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const initBricks = useCallback(() => {
    const rows = 4;
    const cols = 6;
    const brickW = 48;
    const brickH = 14;
    const padding = 7;
    const offsetX = 18;
    const offsetY = 35;
    const bricks: Brick[] = [];

    const rowColors = [
      { color: "#ec4899", points: 30, hits: 2 }, // Pink (2-hit)
      { color: "#a855f7", points: 20, hits: 1 }, // Purple
      { color: "#3b82f6", points: 15, hits: 1 }, // Blue
      { color: "#06b6d4", points: 10, hits: 1 }, // Cyan
    ];

    for (let r = 0; r < rows; r++) {
      const cfg = rowColors[r];
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: offsetX + c * (brickW + padding),
          y: offsetY + r * (brickH + padding),
          w: brickW,
          h: brickH,
          color: cfg.color,
          points: cfg.points,
          hits: cfg.hits,
          maxHits: cfg.hits,
        });
      }
    }
    stateRef.current.bricks = bricks;
  }, []);

  const createParticles = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      stateRef.current.particles.push({
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
    initBricks();
    stateRef.current.paddle.x = 142;
    stateRef.current.ball = { x: 180, y: 310, vx: 3 * (Math.random() > 0.5 ? 1 : -1), vy: -4, radius: 5 };
    stateRef.current.particles = [];
    setScore(0);
    setLives(3);
    setIsGameOver(false);
    setIsWon(false);
    setIsPlaying(true);
  }, [initBricks]);

  // Mouse & Touch tracking for the paddle
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const clientX = e.clientX - rect.left;
    const canvasX = clientX * scaleX;
    stateRef.current.paddle.x = Math.max(0, Math.min(canvas.width - stateRef.current.paddle.w, canvasX - stateRef.current.paddle.w / 2));
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        stateRef.current.keys.left = true;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        stateRef.current.keys.right = true;
      } else if (e.code === "Space" && !isPlaying) {
        startGame();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        stateRef.current.keys.left = false;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        stateRef.current.keys.right = false;
      }
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
      const { paddle, ball, bricks, particles, keys } = stateRef.current;

      if (isPlaying && !isGameOver && !isWon) {
        // Move paddle via keyboard
        if (keys.left) {
          paddle.x = Math.max(0, paddle.x - paddle.speed);
        }
        if (keys.right) {
          paddle.x = Math.min(canvas.width - paddle.w, paddle.x + paddle.speed);
        }

        // Ball movement
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall collisions
        if (ball.x - ball.radius <= 0) {
          ball.x = ball.radius;
          ball.vx = Math.abs(ball.vx);
          arcadeAudio.playBounce();
        } else if (ball.x + ball.radius >= canvas.width) {
          ball.x = canvas.width - ball.radius;
          ball.vx = -Math.abs(ball.vx);
          arcadeAudio.playBounce();
        }

        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius;
          ball.vy = Math.abs(ball.vy);
          arcadeAudio.playBounce();
        }

        // Paddle collision
        if (
          ball.y + ball.radius >= paddle.y &&
          ball.y - ball.radius <= paddle.y + paddle.h &&
          ball.x >= paddle.x &&
          ball.x <= paddle.x + paddle.w
        ) {
          arcadeAudio.playBounce();
          ball.vy = -Math.abs(ball.vy);
          // Angle deflection according to strike distance from center of paddle
          const hitPoint = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
          ball.vx = hitPoint * 5.2;
          createParticles(ball.x, paddle.y, "#38bdf8", 6);
        }

        // Bottom collision (Lose life)
        if (ball.y - ball.radius > canvas.height) {
          arcadeAudio.playCrash();
          setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
              setIsGameOver(true);
              setIsPlaying(false);
            } else {
              // Reset ball
              ball.x = paddle.x + paddle.w / 2;
              ball.y = paddle.y - 12;
              ball.vx = 3 * (Math.random() > 0.5 ? 1 : -1);
              ball.vy = -4;
            }
            return next;
          });
        }

        // Brick collision
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          if (
            ball.x + ball.radius >= b.x &&
            ball.x - ball.radius <= b.x + b.w &&
            ball.y + ball.radius >= b.y &&
            ball.y - ball.radius <= b.y + b.h
          ) {
            b.hits -= 1;
            ball.vy = -ball.vy;
            createParticles(ball.x, ball.y, b.color, 8);

            if (b.hits <= 0) {
              arcadeAudio.playBreak();
              bricks.splice(i, 1);
              const pts = b.points;
              setScore((prev) => {
                const next = prev + pts;
                setHighScore((prevHigh) => {
                  if (next > prevHigh) {
                    try {
                      localStorage.setItem("ai_arcade_breakout_highscore", String(next));
                    } catch {}
                    return next;
                  }
                  return prevHigh;
                });
                return next;
              });

              if (bricks.length === 0) {
                arcadeAudio.playReadyChime();
                setIsWon(true);
                setIsPlaying(false);
              }
            } else {
              arcadeAudio.playBounce();
            }
            break;
          }
        }
      }

      // Render graphics
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Bricks
      bricks.forEach((b) => {
        ctx.save();
        ctx.fillStyle = b.color;
        if (b.maxHits > 1 && b.hits === 1) {
          // Cracked state
          ctx.globalAlpha = 0.6;
        }
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 3);
        ctx.fill();
        ctx.restore();
      });

      // Paddle
      ctx.save();
      ctx.fillStyle = "#38bdf8";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 5);
      ctx.fill();
      ctx.restore();

      // Ball
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) {
          particles.splice(i, 1);
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
  }, [isPlaying, isGameOver, isWon]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* HUD Header */}
      <div className="flex items-center justify-between w-full px-2 mb-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[var(--muted)]">SCORE:</span>
            <span className="font-bold text-pink-400 text-sm">{score}</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-cyan-400 text-[11px]">
            <Zap className="w-3 h-3 fill-current" />
            <span>LIVES: {lives}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 font-mono text-[var(--muted)] text-[11px]">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span>BEST: {highScore}</span>
        </div>
      </div>

      {/* Canvas Board */}
      <div className="relative rounded-2xl overflow-hidden border border-pink-500/20 shadow-lg bg-black/60 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          onPointerMove={handlePointerMove}
          className="block aspect-square max-w-[340px] sm:max-w-[360px] cursor-ew-resize touch-none"
        />

        {/* Start / End Overlay */}
        {(!isPlaying || isGameOver || isWon) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            {isWon ? (
              <>
                <p className="text-emerald-400 font-bold text-lg mb-1 tracking-wider">SECTOR CLEARED!</p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{score}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium text-xs shadow-md shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Next Run</span>
                </button>
              </>
            ) : isGameOver ? (
              <>
                <p className="text-red-400 font-bold text-lg mb-1 tracking-wider">OUT OF LIVES</p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{score}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-medium text-xs shadow-md shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Breakout</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 text-pink-400 fill-pink-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Quantum Breakout</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[220px] mb-4">
                  Slide mouse/finger or use Left/Right keys to bounce the orb and shatter bricks!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-black font-semibold text-xs shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Launch Orb
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Tip: Drag or use Left / Right arrow keys
      </p>
    </div>
  );
}
