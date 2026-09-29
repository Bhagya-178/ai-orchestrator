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
  active: boolean;
}

const MAX_PARTICLES = 36;

function QuantumBreakout() {
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
      y: 315,
      w: 80,
      h: 11,
      lastX: 135,
      vx: 0,
      speed: 9.0,
    },
    ball: {
      x: 175,
      y: 295,
      vx: 4.2,
      vy: -6.0,
      radius: 6,
      speed: 7.5,
      isFireball: false,
    },
    bricks: [] as Brick[],
    trails: Array.from({ length: 8 }, () => ({ x: 175, y: 295, active: false })),
    trailIdx: 0,
    particlePool: Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      color: "#ec4899",
      size: 2,
      active: false,
    })) as Particle[],
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
    const pool = stateRef.current.particlePool;
    let spawned = 0;
    for (let i = 0; i < pool.length && spawned < count; i++) {
      if (!pool[i].active) {
        const angle = Math.random() * Math.PI * 2;
        const spd = (Math.random() * 3.5 + 1.5) * speedMult;
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

  const resetBall = useCallback(() => {
    const paddle = stateRef.current.paddle;
    const dir = Math.random() > 0.5 ? 1 : -1;
    stateRef.current.ball = {
      x: paddle.x + paddle.w / 2,
      y: paddle.y - 12,
      vx: dir * 4.2,
      vy: -6.0,
      radius: 6,
      speed: 7.5,
      isFireball: false,
    };
    stateRef.current.brickCombo = 0;
    setCombo(0);
  }, []);

  const startGame = useCallback(() => {
    initBricks();
    stateRef.current.paddle.x = 140;
    stateRef.current.paddle.vx = 0;
    resetBall();
    stateRef.current.screenShake = 0;
    setScore(0);
    setLives(3);
    setIsGameOver(false);
    setIsWon(false);
    setIsPlaying(true);
    arcadeAudio.playReadyChime();
  }, [initBricks, resetBall]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
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
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    stateRef.current.lastTime = performance.now();

    const render = (time: number) => {
      const state = stateRef.current;
      const rawDt = (time - state.lastTime) / 1000;
      state.lastTime = time;
      const dtFactor = Math.min(2.0, Math.max(0.5, rawDt * 60));

      const { paddle, ball, bricks, keys } = state;

      if (isPlaying && !isGameOver && !isWon) {
        // Paddle movement
        paddle.lastX = paddle.x;
        const targetVx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        paddle.vx += (targetVx * paddle.speed - paddle.vx) * 0.45 * dtFactor;
        paddle.x += paddle.vx * dtFactor;
        paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));

        // Sub-stepped ball physics (2 sub-steps to prevent brick tunneling)
        const subSteps = 2;
        const subDt = dtFactor / subSteps;

        for (let step = 0; step < subSteps; step++) {
          ball.x += ball.vx * subDt;
          ball.y += ball.vy * subDt;

          // ── ANTI-TRAP SAFEGUARD ──
          // If vertical velocity is too low, inject downward push so it never drifts endlessly horizontally
          if (Math.abs(ball.vy) < 1.4) {
            ball.vy = ball.vy >= 0 ? 2.5 : -2.5;
          }

          // Left / Right walls
          if (ball.x - ball.radius <= 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx);
            arcadeAudio.playBounce();
          } else if (ball.x + ball.radius >= canvas.width) {
            ball.x = canvas.width - ball.radius;
            ball.vx = -Math.abs(ball.vx);
            arcadeAudio.playBounce();
          }

          // Top ceiling
          if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy);
            arcadeAudio.playBounce();
          }

          // Paddle Collision
          if (
            ball.y + ball.radius >= paddle.y &&
            ball.y - ball.radius <= paddle.y + paddle.h &&
            ball.x >= paddle.x - ball.radius &&
            ball.x <= paddle.x + paddle.w + ball.radius &&
            ball.vy > 0
          ) {
            arcadeAudio.playBounce();
            ball.y = paddle.y - ball.radius;

            const hitOffset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            const bounceAngle = hitOffset * (Math.PI * 0.38);

            const currentSpeed = Math.min(13.0, ball.speed + 0.12);
            ball.speed = currentSpeed;

            ball.vx = Math.sin(bounceAngle) * currentSpeed + paddle.vx * 0.4;
            ball.vy = -Math.cos(bounceAngle) * currentSpeed;

            state.brickCombo = 0;
            setCombo(0);
            ball.isFireball = false;
            break;
          }

          // Brick Collisions
          for (let i = bricks.length - 1; i >= 0; i--) {
            const b = bricks[i];
            if (
              ball.x + ball.radius >= b.x &&
              ball.x - ball.radius <= b.x + b.w &&
              ball.y + ball.radius >= b.y &&
              ball.y - ball.radius <= b.y + b.h
            ) {
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
                addScreenShake(3);
                spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 12, 1.1);
                bricks.splice(i, 1);
              } else {
                arcadeAudio.playBounce();
                spawnParticles(ball.x, ball.y, b.color, 5);
              }

              if (bricks.length === 0) {
                arcadeAudio.playReadyChime();
                setIsWon(true);
                setIsPlaying(false);
                return;
              }

              break;
            }
          }

          // Ball Out (Floor)
          if (ball.y - ball.radius > canvas.height) {
            arcadeAudio.playCrash();
            addScreenShake(5);
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
            break;
          }
        }

        // Trail
        state.trails[state.trailIdx] = { x: ball.x, y: ball.y, active: true };
        state.trailIdx = (state.trailIdx + 1) % state.trails.length;
      }

      // Update particle pool
      for (const p of state.particlePool) {
        if (p.active) {
          p.x += p.vx * dtFactor;
          p.y += p.vy * dtFactor;
          p.life -= 0.05 * dtFactor;
          if (p.life <= 0) p.active = false;
        }
      }

      if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - 0.4 * dtFactor);

      // ── Draw Graphics ──
      ctx.save();
      if (state.screenShake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * state.screenShake * 2,
          (Math.random() - 0.5) * state.screenShake * 2
        );
      }

      // Background
      ctx.fillStyle = "#080c16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Bricks
      for (const b of bricks) {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 3);
        ctx.fill();

        if (b.hits === 1 && b.maxHits > 1) {
          ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(b.x + 8, b.y + 3);
          ctx.lineTo(b.x + b.w / 2, b.y + b.h - 3);
          ctx.lineTo(b.x + b.w - 8, b.y + 4);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillRect(b.x + 2, b.y + 1, b.w - 4, 2);
      }

      // Draw Trails
      for (let i = 0; i < state.trails.length; i++) {
        const pt = state.trails[i];
        if (pt.active) {
          ctx.fillStyle = ball.isFireball ? "rgba(245, 158, 11, 0.3)" : "rgba(236, 72, 153, 0.25)";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ball.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Ball
      ctx.save();
      ctx.shadowColor = ball.isFireball ? "#f59e0b" : "#ec4899";
      ctx.shadowBlur = 8;
      ctx.fillStyle = ball.isFireball ? "#f59e0b" : "#f8fafc";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Draw Paddle
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 5);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(paddle.x + paddle.w / 2 - 8, paddle.y + 2, 16, 2);

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
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>HYPER</span>
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
          height={335}
          onPointerMove={handlePointerMove}
          className="block aspect-[72/67] max-w-[340px] sm:max-w-[360px] cursor-none touch-none"
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
                  Move mouse or A/D to steer paddle. Slice into ball while moving to launch fast angle cuts!
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
        Controls: <b>Mouse</b> or <b>A / D / Arrows</b> to Steer · Hit edges for sharp slices
      </p>
    </div>
  );
}

export default React.memo(QuantumBreakout);
