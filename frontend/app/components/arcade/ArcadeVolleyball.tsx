"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Award, Zap } from "lucide-react";
import { arcadeAudio } from "./arcadeAudio";

interface Slime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  isJumping: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  active: boolean;
}

const MAX_PARTICLES = 32;

function ArcadeVolleyball() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);

  const stateRef = useRef({
    court: { groundY: 280, netX: 180, netW: 6, netH: 62 },
    player: {
      x: 75,
      y: 280,
      vx: 0,
      vy: 0,
      radius: 24,
      speed: 6.8,
      isJumping: false,
    } as Slime,
    ai: {
      x: 285,
      y: 280,
      vx: 0,
      vy: 0,
      radius: 24,
      speed: 5.8,
      isJumping: false,
    } as Slime,
    ball: {
      x: 80,
      y: 130,
      vx: 3.2,
      vy: -3.5,
      radius: 9,
      rotation: 0,
      isSpiked: false,
    },
    keys: { left: false, right: false, jump: false },
    gravity: 0.46,
    ballGravity: 0.36,
    pointScoredPause: 0,
    server: "player" as "player" | "ai",
    particlePool: Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      color: "#38bdf8",
      size: 2,
      active: false,
    })) as Particle[],
    trail: Array.from({ length: 8 }, () => ({ x: 80, y: 130, active: false })),
    trailIdx: 0,
    screenShake: 0,
    lastTime: 0,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_volley_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const addScreenShake = (amount: number) => {
    stateRef.current.screenShake = Math.max(stateRef.current.screenShake, amount);
  };

  const spawnParticles = (x: number, y: number, color: string, count = 8, speedMult = 1) => {
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
        pool[i].maxLife = Math.random() * 0.3 + 0.25;
        pool[i].color = color;
        pool[i].size = Math.random() * 2.5 + 1.5;
        pool[i].active = true;
        spawned++;
      }
    }
  };

  const resetRally = useCallback((serverWinner: "player" | "ai") => {
    const { player, ai, ball, court } = stateRef.current;
    player.x = 75;
    player.y = court.groundY;
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;

    ai.x = 285;
    ai.y = court.groundY;
    ai.vx = 0;
    ai.vy = 0;
    ai.isJumping = false;

    ball.isSpiked = false;
    stateRef.current.server = serverWinner;

    if (serverWinner === "player") {
      ball.x = 75;
      ball.y = 150;
      ball.vx = 2.8;
      ball.vy = -5.8;
    } else {
      ball.x = 285;
      ball.y = 150;
      ball.vx = -2.8;
      ball.vy = -5.8;
    }
    stateRef.current.pointScoredPause = 30; // ~0.5s pause
  }, []);

  const startGame = useCallback(() => {
    setPlayerScore(0);
    setAiScore(0);
    setWinner(null);
    setIsPlaying(true);
    resetRally("player");
    arcadeAudio.playWhistle();
  }, [resetRally]);

  const handleJump = useCallback(() => {
    const p = stateRef.current.player;
    if (!p.isJumping) {
      p.vy = -9.6;
      p.isJumping = true;
      arcadeAudio.playJump();
    }
  }, []);

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
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.code === "Space") {
        handleJump();
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
  }, [isPlaying, handleJump, startGame]);

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

      const { player, ai, ball, court, keys, gravity, ballGravity } = state;
      const netTopY = court.groundY - court.netH;
      const netLeft = court.netX - court.netW / 2;
      const netRight = court.netX + court.netW / 2;

      if (isPlaying && !winner) {
        if (state.pointScoredPause > 0) {
          state.pointScoredPause -= dtFactor;
        } else {
          // ── Update Player ──
          const targetVx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
          player.vx += (targetVx * player.speed - player.vx) * 0.45 * dtFactor;
          player.x += player.vx * dtFactor;
          player.x = Math.max(player.radius + 4, Math.min(netLeft - player.radius - 2, player.x));

          player.vy += gravity * dtFactor;
          player.y += player.vy * dtFactor;
          if (player.y >= court.groundY) {
            player.y = court.groundY;
            player.vy = 0;
            player.isJumping = false;
          }

          // ── Predictive AI Solver ──
          let aiTargetX = 285;
          if (ball.vx > 0.2 || ball.x > court.netX - 25) {
            // Solve parabolic equation to find exact landing position
            const dy = court.groundY - 20 - ball.y;
            const a = 0.5 * ballGravity;
            const b = ball.vy;
            const c = -dy;
            const discriminant = b * b - 4 * a * c;
            if (discriminant >= 0) {
              const t = (-b + Math.sqrt(discriminant)) / (2 * a);
              if (t > 0 && t < 120) {
                let landingX = ball.x + ball.vx * t;
                // Account for potential wall bounce
                if (landingX > canvas.width - ball.radius) {
                  landingX = (canvas.width - ball.radius) - (landingX - (canvas.width - ball.radius));
                }
                aiTargetX = Math.max(netRight + ai.radius + 8, Math.min(canvas.width - ai.radius - 8, landingX));
              }
            }
          }

          const aiDist = aiTargetX - ai.x;
          if (Math.abs(aiDist) > 3) {
            const aiDir = Math.sign(aiDist);
            ai.vx += (aiDir * ai.speed - ai.vx) * 0.35 * dtFactor;
            ai.x += ai.vx * dtFactor;
          } else {
            ai.vx *= 0.85;
          }
          ai.x = Math.max(netRight + ai.radius + 2, Math.min(canvas.width - ai.radius - 4, ai.x));

          // AI Jump Timing: jump when ball is dropping in its sector
          const ballNearAI = ball.x > court.netX + 15 && Math.abs(ball.x - ai.x) < 32;
          if (ballNearAI && ball.y < court.groundY - 45 && ball.vy > -1 && !ai.isJumping) {
            ai.vy = -9.2;
            ai.isJumping = true;
          }

          ai.vy += gravity * dtFactor;
          ai.y += ai.vy * dtFactor;
          if (ai.y >= court.groundY) {
            ai.y = court.groundY;
            ai.vy = 0;
            ai.isJumping = false;
          }

          // ── Update Ball Physics ──
          ball.vy += ballGravity * dtFactor;
          ball.x += ball.vx * dtFactor;
          ball.y += ball.vy * dtFactor;
          ball.rotation += ball.vx * 0.08 * dtFactor;

          // Record trail
          state.trail[state.trailIdx] = { x: ball.x, y: ball.y, active: true };
          state.trailIdx = (state.trailIdx + 1) % state.trail.length;

          // Wall Bounces
          if (ball.x - ball.radius <= 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx) * 0.94;
            arcadeAudio.playBounce();
          } else if (ball.x + ball.radius >= canvas.width) {
            ball.x = canvas.width - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 0.94;
            arcadeAudio.playBounce();
          }

          // Ceiling Bounce
          if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy) * 0.90;
            arcadeAudio.playBounce();
          }

          // ── Solid Net Collision ──
          if (
            ball.y + ball.radius >= netTopY &&
            ball.x + ball.radius >= netLeft &&
            ball.x - ball.radius <= netRight
          ) {
            arcadeAudio.playBounce();
            ball.isSpiked = false;

            if (ball.y < netTopY + 6) {
              // Top tape bounce
              ball.y = netTopY - ball.radius;
              ball.vy = -Math.abs(ball.vy) * 0.85;
            } else if (ball.x < court.netX) {
              // Rebound to player side
              ball.x = netLeft - ball.radius;
              ball.vx = -Math.abs(ball.vx) * 0.8;
            } else {
              // Rebound to AI side
              ball.x = netRight + ball.radius;
              ball.vx = Math.abs(ball.vx) * 0.8;
            }
          }

          // ── Slime Dome Collision & Guaranteed Net-Clearing Spike Physics ──
          const checkSlimeHit = (s: Slime, isPlayer: boolean) => {
            const dx = ball.x - s.x;
            const dy = ball.y - s.y;
            const dist = Math.hypot(dx, dy);

            if (dist < s.radius + ball.radius && ball.y <= s.y + 4) {
              // Angle from slime apex (-PI/2 is straight up)
              let normalX = dx / Math.max(1, dist);
              let normalY = dy / Math.max(1, dist);

              // Strictly enforce upward impulse (never spike straight into floor!)
              if (normalY > -0.35) normalY = -0.35;
              const len = Math.hypot(normalX, normalY) || 1;
              normalX /= len;
              normalY /= len;

              const isJumpingHit = s.isJumping && s.y < court.groundY - 25;

              if (isJumpingHit) {
                // ── EXCELLENT PLAYABLE SPIKE: Guaranteed Net-Clearing Drive ──
                arcadeAudio.playSpike();
                ball.isSpiked = true;
                addScreenShake(5);
                spawnParticles(ball.x, ball.y, isPlayer ? "#38bdf8" : "#ec4899", 10, 1.2);

                const spikeSpeed = 10.5;
                if (isPlayer) {
                  // Forward trajectory that clears the net tape
                  const distToNet = Math.max(10, court.netX - ball.x);
                  const neededVy = ball.y > netTopY - 15 ? -4.5 : -2.5; // arc over net
                  ball.vx = Math.max(6.5, spikeSpeed * 0.85);
                  ball.vy = neededVy;
                } else {
                  // AI spike toward player court
                  const neededVy = ball.y > netTopY - 15 ? -4.5 : -2.5;
                  ball.vx = -Math.max(6.5, spikeSpeed * 0.85);
                  ball.vy = neededVy;
                }
              } else {
                // ── Normal Playable Bump / Set ──
                arcadeAudio.playBounce();
                ball.isSpiked = false;
                spawnParticles(ball.x, ball.y, isPlayer ? "#06b6d4" : "#ec4899", 5);

                const bumpSpeed = Math.min(8.8, Math.hypot(ball.vx, ball.vy) * 0.85 + 3.2);
                ball.vx = normalX * bumpSpeed + s.vx * 0.35;
                ball.vy = Math.min(-5.2, normalY * bumpSpeed);

                // Ensure forward momentum toward the net
                if (isPlayer && ball.vx < 1.8) ball.vx = 2.8;
                if (!isPlayer && ball.vx > -1.8) ball.vx = -2.8;
              }

              // Place ball outside dome without pushing into ground
              ball.x = s.x + normalX * (s.radius + ball.radius + 1);
              ball.y = Math.min(court.groundY - ball.radius - 2, s.y + normalY * (s.radius + ball.radius + 1));
            }
          };

          checkSlimeHit(player, true);
          checkSlimeHit(ai, false);

          // ── Floor Landing / Point Scored ──
          if (ball.y + ball.radius >= court.groundY) {
            arcadeAudio.playWhistle();
            addScreenShake(4);
            spawnParticles(ball.x, court.groundY, "#facc15", 14);

            if (ball.x < court.netX) {
              // Point for AI
              setAiScore((prev) => {
                const next = prev + 1;
                if (next >= 5) {
                  setWinner("ai");
                  setIsPlaying(false);
                } else {
                  resetRally("ai");
                }
                return next;
              });
            } else {
              // Point for Player
              setPlayerScore((prev) => {
                const next = prev + 1;
                setHighScore((prevHigh) => {
                  if (next > prevHigh) {
                    try {
                      localStorage.setItem("ai_arcade_volley_highscore", String(next));
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
                  resetRally("player");
                }
                return next;
              });
            }
          }
        }
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

      // Solid background fill (instant, no gradient allocation)
      ctx.fillStyle = "#070c18";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Court ground
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, court.groundY, canvas.width, canvas.height - court.groundY);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(0, court.groundY, canvas.width, 2.5);

      // Shadows
      const drawShadow = (x: number, y: number, r: number) => {
        const dist = court.groundY - y;
        const scale = Math.max(0.3, 1 - dist / 160);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(x, court.groundY + 3, r * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      drawShadow(player.x, player.y, player.radius);
      drawShadow(ai.x, ai.y, ai.radius);
      drawShadow(ball.x, ball.y, ball.radius);

      // Net
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(netLeft, netTopY, court.netW, court.netH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      for (let y = netTopY; y < court.groundY; y += 8) {
        ctx.beginPath();
        ctx.moveTo(netLeft, y);
        ctx.lineTo(netRight, y);
        ctx.stroke();
      }

      // Slimes
      const drawSlime = (s: Slime, color: string, eyeOffsetX: number) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        // Eye
        const eyeX = s.x + eyeOffsetX;
        const eyeY = s.y - 10;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Pupil tracking ball
        const angle = Math.atan2(ball.y - eyeY, ball.x - eyeX);
        ctx.fillStyle = "#09090b";
        ctx.beginPath();
        ctx.arc(eyeX + Math.cos(angle) * 1.8, eyeY + Math.sin(angle) * 1.8, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      drawSlime(player, "#06b6d4", 7);
      drawSlime(ai, "#ec4899", -7);

      // Ball Trail
      for (let i = 0; i < state.trail.length; i++) {
        const pt = state.trail[i];
        if (pt.active) {
          ctx.fillStyle = ball.isSpiked ? "rgba(245, 158, 11, 0.3)" : "rgba(56, 189, 248, 0.25)";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ball.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Ball
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rotation);
      ctx.shadowColor = ball.isSpiked ? "#f59e0b" : "#facc15";
      ctx.shadowBlur = 8;
      ctx.fillStyle = ball.isSpiked ? "#f59e0b" : "#facc15";
      ctx.beginPath();
      ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Seam
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, ball.radius, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-ball.radius, 0);
      ctx.lineTo(ball.radius, 0);
      ctx.stroke();
      ctx.restore();

      // Particles
      for (const p of state.particlePool) {
        if (p.active) {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
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
  }, [isPlaying, winner, resetRally]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* HUD Header */}
      <div className="flex items-center justify-between w-full px-2 mb-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-cyan-400 font-bold">YOU:</span>
            <span className="font-extrabold text-white text-sm">{playerScore}</span>
          </div>
          <span className="text-zinc-500 font-bold">VS</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-pink-400 font-bold">AI:</span>
            <span className="font-extrabold text-white text-sm">{aiScore}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 font-mono text-[var(--muted)] text-[11px]">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span>WINS: {highScore}</span>
        </div>
      </div>

      {/* Canvas Court */}
      <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20 shadow-xl bg-black/70 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={310}
          className="block aspect-[36/31] max-w-[340px] sm:max-w-[360px]"
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
                    <Trophy className="w-6 h-6 text-pink-400" />
                  )}
                </div>
                <p className={`font-bold text-lg mb-1 tracking-wider ${winner === "player" ? "text-cyan-400" : "text-pink-400"}`}>
                  {winner === "player" ? "MATCH WON! 🏆" : "CYBER BOT WON!"}
                </p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{playerScore} - {aiScore}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-xs shadow-md shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rematch</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 text-cyan-400 fill-cyan-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Arcade Volleyball 1v1</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[240px] mb-4">
                  <b>A / D</b> to Move · <b>W / Space</b> to Jump & Spike. Clear the net to outplay the Cyber AI!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Serve & Play
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* On-screen controls for mobile/trackpad */}
      <div className="flex items-center justify-between w-full max-w-[340px] mt-3 sm:hidden gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onTouchStart={() => (stateRef.current.keys.left = true)}
            onTouchEnd={() => (stateRef.current.keys.left = false)}
            onTouchCancel={() => (stateRef.current.keys.left = false)}
            onMouseDown={() => (stateRef.current.keys.left = true)}
            onMouseUp={() => (stateRef.current.keys.left = false)}
            onMouseLeave={() => (stateRef.current.keys.left = false)}
            className="w-12 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white text-sm font-bold flex items-center justify-center cursor-pointer select-none active:scale-95"
          >
            ◀
          </button>
          <button
            onTouchStart={() => (stateRef.current.keys.right = true)}
            onTouchEnd={() => (stateRef.current.keys.right = false)}
            onTouchCancel={() => (stateRef.current.keys.right = false)}
            onMouseDown={() => (stateRef.current.keys.right = true)}
            onMouseUp={() => (stateRef.current.keys.right = false)}
            onMouseLeave={() => (stateRef.current.keys.right = false)}
            className="w-12 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white text-sm font-bold flex items-center justify-center cursor-pointer select-none active:scale-95"
          >
            ▶
          </button>
        </div>
        <button
          onClick={handleJump}
          className="px-6 h-10 rounded-xl bg-cyan-500 text-black text-xs font-bold shadow-md active:scale-95 flex items-center justify-center"
        >
          JUMP ⤒
        </button>
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Controls: <b>A / D / Arrows</b> to Move · <b>W / Space</b> to Jump & Spike
      </p>
    </div>
  );
}

export default React.memo(ArcadeVolleyball);
