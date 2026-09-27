"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Zap, Award } from "lucide-react";
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
  size: number;
}

export default function QuantumBreakout() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [combo, setCombo] = useState(0);

  const stateRef = useRef({
    paddle: {
      x: 135,
      y: 320,
      w: 80,
      h: 11,
      lastX: 135,
      vx: 0,
      speed: 9.5,
    },
    ball: {
      x: 175,
      y: 300,
      vx: 4.5,
      vy: -6.5,
      radius: 6,
      speed: 8.0,
      isFireball: false,
    },
    bricks: [] as Brick[],
    particles: [] as Particle[],
    trails: [] as { x: number; y: number; alpha: number; color: string }[],
    keys: { left: false, right: false },
    screenShake: 0,
    brickCombo: 0,
    lastTime: 0,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_breakout_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const addScreenShake = (amount: number) => {
    stateRef.current.screenShake = Math.max(stateRef.current.screenShake, amount);
  };

  const spawnParticles = (x: number, y: number, color: string, count = 10, speedMult = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 4 + 2) * speedMult;
      stateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1.0,
        color,
        size: Math.random() * 3 + 2,
      });
    }
  };

  const initBricks = useCallback(() => {
    const rows = 4;
    const cols = 6;
    const brickW = 48;
    const brickH = 15;
    const padding = 7;
    const offsetX = 18;
    const offsetY = 35;
    const bricks: Brick[] = [];

    const rowColors = [
      { color: "#ec4899", points: 30, hits: 2 }, // Pink (2-hit fortified)
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

  const resetBall = useCallback(() => {
    const paddle = stateRef.current.paddle;
    const dir = Math.random() > 0.5 ? 1 : -1;
    stateRef.current.ball = {
      x: paddle.x + paddle.w / 2,
      y: paddle.y - 12,
      vx: dir * 4.5,
      vy: -6.5,
      radius: 6,
      speed: 8.0,
      isFireball: false,
    };
    stateRef.current.brickCombo = 0;
    setCombo(0);
    stateRef.current.trails = [];
  }, []);

  const startGame = useCallback(() => {
    initBricks();
    stateRef.current.paddle.x = 140;
    stateRef.current.paddle.vx = 0;
    resetBall();
    stateRef.current.particles = [];
    stateRef.current.screenShake = 0;
    setScore(0);
    setLives(3);
    setIsGameOver(false);
    setIsWon(false);
    setIsPlaying(true);
    arcadeAudio.playReadyChime();
  }, [initBricks, resetBall]);

  // Pointer / Mouse move tracking
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const clientX = e.clientX - rect.left;
    const canvasX = clientX * scaleX;

    const paddle = stateRef.current.paddle;
    paddle.lastX = paddle.x;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, canvasX - paddle.w / 2));
    paddle.vx = paddle.x - paddle.lastX;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) {
        if (e.code === "Space" || e.code === "Enter") startGame();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        stateRef.current.keys.left = true;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        stateRef.current.keys.right = true;
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

  // Main 60-120 FPS Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stateRef.current.lastTime = performance.now();

    const render = (time: number) => {
      const state = stateRef.current;
      const rawDt = (time - state.lastTime) / 1000;
      state.lastTime = time;
      const dtFactor = Math.min(2.0, Math.max(0.5, rawDt * 60));

      const { paddle, ball, bricks, keys } = state;

      if (isPlaying && !isGameOver && !isWon) {
        // Paddle keyboard physics
        paddle.lastX = paddle.x;
        const targetVx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        paddle.vx += (targetVx * paddle.speed - paddle.vx) * 0.45 * dtFactor;
        paddle.x += paddle.vx * dtFactor;
        paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));

        // Ball physics
        ball.x += ball.vx * dtFactor;
        ball.y += ball.vy * dtFactor;

        // Trail points
        state.trails.push({
          x: ball.x,
          y: ball.y,
          alpha: 0.8,
          color: ball.isFireball ? "#f59e0b" : "#ec4899",
        });
        if (state.trails.length > 10) state.trails.shift();

        // Left / Right wall rebounds
        if (ball.x - ball.radius <= 0) {
          ball.x = ball.radius;
          ball.vx = Math.abs(ball.vx);
          arcadeAudio.playBounce();
          spawnParticles(0, ball.y, "#38bdf8", 5);
        } else if (ball.x + ball.radius >= canvas.width) {
          ball.x = canvas.width - ball.radius;
          ball.vx = -Math.abs(ball.vx);
          arcadeAudio.playBounce();
          spawnParticles(canvas.width, ball.y, "#38bdf8", 5);
        }

        // Top wall rebound
        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius;
          ball.vy = Math.abs(ball.vy);
          arcadeAudio.playBounce();
          spawnParticles(ball.x, 0, "#ec4899", 5);
        }

        // ── Dynamic Paddle Rebound & Spin Slicing ──
        if (
          ball.y + ball.radius >= paddle.y &&
          ball.y - ball.radius <= paddle.y + paddle.h &&
          ball.x >= paddle.x - ball.radius &&
          ball.x <= paddle.x + paddle.w + ball.radius &&
          ball.vy > 0
        ) {
          arcadeAudio.playBounce();
          ball.y = paddle.y - ball.radius;

          // Normalized hit offset (-1 to 1)
          const hitOffset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
          const bounceAngle = hitOffset * (Math.PI * 0.38); // up to ~68 degrees angle

          // Dynamic speed scaling with combo
          const currentSpeed = Math.min(13.5, ball.speed + 0.15);
          ball.speed = currentSpeed;

          ball.vx = Math.sin(bounceAngle) * currentSpeed;
          ball.vy = -Math.cos(bounceAngle) * currentSpeed;

          // Impart paddle momentum
          ball.vx += paddle.vx * 0.45;

          // Reset combo upon paddle catch
          state.brickCombo = 0;
          setCombo(0);
          ball.isFireball = false;

          spawnParticles(ball.x, paddle.y, "#38bdf8", 7);
        }

        // ── Brick Collisions ──
        for (let i = bricks.length - 1; i >= 0; i--) {
          const b = bricks[i];
          if (
            ball.x + ball.radius >= b.x &&
            ball.x - ball.radius <= b.x + b.w &&
            ball.y + ball.radius >= b.y &&
            ball.y - ball.radius <= b.y + b.h
          ) {
            // Determine collision edge
            const overlapLeft = ball.x + ball.radius - b.x;
            const overlapRight = b.x + b.w - (ball.x - ball.radius);
            const overlapTop = ball.y + ball.radius - b.y;
            const overlapBottom = b.y + b.h - (ball.y - ball.radius);

            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            if (minOverlap === overlapLeft || minOverlap === overlapRight) {
              ball.vx = -ball.vx;
            } else {
              ball.vy = -ball.vy;
            }

            b.hits -= ball.isFireball ? 2 : 1;

            state.brickCombo += 1;
            setCombo(state.brickCombo);
            if (state.brickCombo >= 3) {
              ball.isFireball = true;
              arcadeAudio.playTurbo();
            }

            const pointsEarned = b.points * (ball.isFireball ? 2 : 1);
            setScore((prev) => {
              const next = prev + pointsEarned;
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

            if (b.hits <= 0) {
              arcadeAudio.playBreak();
              addScreenShake(4);
              spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 16, 1.2);
              bricks.splice(i, 1);
            } else {
              arcadeAudio.playBounce();
              spawnParticles(ball.x, ball.y, b.color, 6);
            }

            // Check Win Condition
            if (bricks.length === 0) {
              arcadeAudio.playReadyChime();
              setIsWon(true);
              setIsPlaying(false);
              return;
            }

            break; // Handle 1 brick collision per frame
          }
        }

        // ── Ball Lost (Bottom Floor) ──
        if (ball.y - ball.radius > canvas.height) {
          arcadeAudio.playCrash();
          addScreenShake(6);
          setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
              setIsGameOver(true);
              setIsPlaying(false);
            } else {
              resetBall();
            }
            return next;
          });
        }
      }

      // Update Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * dtFactor;
        p.y += p.vy * dtFactor;
        p.life -= 0.04 * dtFactor;
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - 0.4 * dtFactor);

      // ── Draw Graphics ──
      ctx.save();
      if (state.screenShake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * state.screenShake * 2.5,
          (Math.random() - 0.5) * state.screenShake * 2.5
        );
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Neon Gradient Backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGrad.addColorStop(0, "#080c16");
      bgGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Bricks
      for (const b of bricks) {
        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur = b.hits > 1 ? 12 : 8;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();

        // 2-Hit Crack line
        if (b.hits === 1 && b.maxHits > 1) {
          ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(b.x + 8, b.y + 3);
          ctx.lineTo(b.x + b.w / 2, b.y + b.h - 3);
          ctx.lineTo(b.x + b.w - 8, b.y + 4);
          ctx.stroke();
        }

        // Brick Top Bevel
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillRect(b.x + 2, b.y + 1, b.w - 4, 2);
        ctx.restore();
      }

      // Draw Ball Trails
      for (let i = 0; i < state.trails.length; i++) {
        const pt = state.trails[i];
        const alpha = (i / state.trails.length) * 0.55;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ball.radius * (i / state.trails.length), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Draw Ball
      ctx.save();
      ctx.shadowColor = ball.isFireball ? "#f59e0b" : "#ec4899";
      ctx.shadowBlur = ball.isFireball ? 20 : 12;
      ctx.fillStyle = ball.isFireball ? "#f59e0b" : "#f8fafc";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Paddle
      ctx.save();
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
      ctx.fill();

      // Paddle neon center line
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(paddle.x + paddle.w / 2 - 8, paddle.y + 3, 16, 2);
      ctx.restore();

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
  }, [isPlaying, isGameOver, isWon, resetBall]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* HUD Header */}
      <div className="flex items-center justify-between w-full px-2 mb-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-pink-400 font-bold">SCORE:</span>
            <span className="font-extrabold text-white text-sm">{score}</span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i < lives ? "bg-pink-500 shadow-xs shadow-pink-500/50" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
          {combo >= 3 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30 animate-pulse">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>HYPER BALL</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 font-mono text-[var(--muted)] text-[11px]">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span>BEST: {highScore}</span>
        </div>
      </div>

      {/* Canvas Rink */}
      <div className="relative rounded-2xl overflow-hidden border border-pink-500/25 shadow-2xl bg-black/80 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={340}
          onPointerMove={handlePointerMove}
          className="block aspect-[18/17] max-w-[340px] sm:max-w-[360px] cursor-none touch-none"
        />

        {/* Start / Game Over Overlay */}
        {(!isPlaying || isGameOver || isWon) && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            {isWon ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-3">
                  <Award className="w-6 h-6 text-yellow-400 animate-bounce" />
                </div>
                <p className="font-bold text-lg mb-1 tracking-wider text-pink-400">
                  SECTOR CLEARED! 🏆
                </p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{score}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold text-xs shadow-md shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Play Again</span>
                </button>
              </>
            ) : isGameOver ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
                  <RotateCcw className="w-6 h-6 text-red-400" />
                </div>
                <p className="font-bold text-lg mb-1 tracking-wider text-red-400">
                  SHIELD DEPLETED!
                </p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{score}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold text-xs shadow-md shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recharge & Try Again</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 text-pink-400 fill-pink-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Quantum Breakout</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[240px] mb-4">
                  Move mouse or A/D to steer paddle. Slice into the ball while moving to launch fast angle cuts!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-black font-semibold text-xs shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Launch Ball
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Controls: <b>Mouse</b> or <b>A / D / Arrows</b> to Steer Paddle · Hit on edges for sharp slice
      </p>
    </div>
  );
}
