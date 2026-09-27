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
  isDiving: boolean;
  diveTimer: number;
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
}

export default function ArcadeVolleyball() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);

  const stateRef = useRef({
    court: { groundY: 300, netX: 180, netW: 6, netH: 70 },
    player: {
      x: 80,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 25,
      speed: 7.2,
      isJumping: false,
      isDiving: false,
      diveTimer: 0,
    } as Slime,
    ai: {
      x: 280,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 25,
      speed: 6.2,
      isJumping: false,
      isDiving: false,
      diveTimer: 0,
    } as Slime,
    ball: {
      x: 90,
      y: 140,
      vx: 3.5,
      vy: -2,
      radius: 9,
      rotation: 0,
      isSpiked: false,
    },
    keys: { left: false, right: false, jump: false, dive: false },
    gravity: 0.50,
    ballGravity: 0.42,
    pointScoredPause: 0,
    server: "player" as "player" | "ai",
    particles: [] as Particle[],
    trail: [] as { x: number; y: number; color: string; alpha: number }[],
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

  const spawnParticles = (x: number, y: number, color: string, count = 10, speedMult = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 4 + 2) * speedMult;
      stateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: Math.random() * 0.4 + 0.3,
        color,
        size: Math.random() * 3 + 2,
      });
    }
  };

  const resetRally = useCallback((serverWinner: "player" | "ai") => {
    const { player, ai, ball, court } = stateRef.current;
    player.x = 80;
    player.y = court.groundY;
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;
    player.isDiving = false;
    player.diveTimer = 0;

    ai.x = 280;
    ai.y = court.groundY;
    ai.vx = 0;
    ai.vy = 0;
    ai.isJumping = false;
    ai.isDiving = false;
    ai.diveTimer = 0;

    ball.isSpiked = false;
    stateRef.current.trail = [];
    stateRef.current.server = serverWinner;

    if (serverWinner === "player") {
      ball.x = 80;
      ball.y = 150;
      ball.vx = 3.2;
      ball.vy = -6;
    } else {
      ball.x = 280;
      ball.y = 150;
      ball.vx = -3.2;
      ball.vy = -6;
    }
    stateRef.current.pointScoredPause = 25; // ~0.4s pause for fast game flow
  }, []);

  const startGame = useCallback(() => {
    setPlayerScore(0);
    setAiScore(0);
    setWinner(null);
    setIsPlaying(true);
    stateRef.current.particles = [];
    resetRally("player");
    arcadeAudio.playWhistle();
  }, [resetRally]);

  const handleJumpInput = () => {
    const p = stateRef.current.player;
    if (!p.isJumping) {
      p.vy = -10.5;
      p.isJumping = true;
      arcadeAudio.playJump();
      spawnParticles(p.x, p.y, "#38bdf8", 6, 0.6);
    }
  };

  const handleDiveInput = () => {
    const p = stateRef.current.player;
    if (!p.isDiving && p.diveTimer <= 0) {
      p.isDiving = true;
      p.diveTimer = 18;
      const dir = stateRef.current.keys.right ? 1 : stateRef.current.keys.left ? -1 : 1;
      p.vx = dir * 11.5;
      arcadeAudio.playTurbo();
      spawnParticles(p.x, p.y, "#06b6d4", 8, 1);
    }
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
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.code === "Space") {
        handleJumpInput();
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S" || e.key === "Shift") {
        handleDiveInput();
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

  // Main 60-120 FPS Physics & Render Loop
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
      // Normalize dt to 60fps unit factor (1.0 at 60fps)
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
          if (player.isDiving) {
            player.x += player.vx * dtFactor;
            player.vx *= 0.90;
            player.diveTimer -= dtFactor;
            if (player.diveTimer <= 0) {
              player.isDiving = false;
            }
          } else {
            const targetVx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
            player.vx += (targetVx * player.speed - player.vx) * 0.35 * dtFactor;
            player.x += player.vx * dtFactor;
          }

          player.x = Math.max(player.radius + 6, Math.min(netLeft - player.radius - 2, player.x));

          player.vy += gravity * dtFactor;
          player.y += player.vy * dtFactor;
          if (player.y >= court.groundY) {
            player.y = court.groundY;
            player.vy = 0;
            player.isJumping = false;
          }

          // ── Fast Predictive AI Bot ──
          let aiTargetX = 280;
          if (ball.x > court.netX - 20) {
            // Predict ball landing position via trajectory
            const timeToGround = Math.max(0.1, (court.groundY - ball.y) / Math.max(2, ball.vy + 3));
            aiTargetX = ball.x + ball.vx * Math.min(15, timeToGround);
          }

          const aiDist = aiTargetX - ai.x;
          if (Math.abs(aiDist) > 3) {
            const aiDir = Math.sign(aiDist);
            ai.vx += (aiDir * ai.speed - ai.vx) * 0.3 * dtFactor;
            ai.x += ai.vx * dtFactor;
          } else {
            ai.vx *= 0.8;
          }

          ai.x = Math.max(netRight + ai.radius + 2, Math.min(canvas.width - ai.radius - 6, ai.x));

          // AI Jump & Spike Decision
          const ballNearAI = ball.x > court.netX + 20 && Math.abs(ball.x - ai.x) < 35;
          if (ballNearAI && ball.y < court.groundY - 50 && !ai.isJumping && ball.vy > -1) {
            ai.vy = -10.0;
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

          // Trail points
          state.trail.push({
            x: ball.x,
            y: ball.y,
            color: ball.isSpiked ? "#f59e0b" : "#38bdf8",
            alpha: 0.8,
          });
          if (state.trail.length > 10) state.trail.shift();

          // Wall Bounces
          if (ball.x - ball.radius <= 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx) * 0.92;
            arcadeAudio.playBounce();
            spawnParticles(ball.x, ball.y, "#38bdf8", 5);
          } else if (ball.x + ball.radius >= canvas.width) {
            ball.x = canvas.width - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 0.92;
            arcadeAudio.playBounce();
            spawnParticles(ball.x, ball.y, "#ec4899", 5);
          }

          // Ceiling Bounce
          if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy) * 0.85;
            arcadeAudio.playBounce();
          }

          // Net Collision
          if (ball.y + ball.radius >= netTopY && ball.x + ball.radius >= netLeft && ball.x - ball.radius <= netRight) {
            if (ball.y < netTopY + 8) {
              ball.y = netTopY - ball.radius;
              ball.vy = -Math.abs(ball.vy) * 0.8;
            } else if (ball.x < court.netX) {
              ball.x = netLeft - ball.radius;
              ball.vx = -Math.abs(ball.vx) * 0.75;
            } else {
              ball.x = netRight + ball.radius;
              ball.vx = Math.abs(ball.vx) * 0.75;
            }
            ball.isSpiked = false;
            arcadeAudio.playBounce();
            spawnParticles(court.netX, netTopY, "#ffffff", 6);
          }

          // ── Slime Dome Collision & Dynamic Spikes ──
          const checkSlimeHit = (s: Slime, isPlayer: boolean) => {
            const dx = ball.x - s.x;
            const dy = ball.y - s.y;
            const dist = Math.hypot(dx, dy);

            if (dist < s.radius + ball.radius && ball.y <= s.y + 4) {
              const angle = Math.atan2(dy, dx);
              const isHighSpike = s.isJumping && s.y < court.groundY - 35 && ball.y < netTopY + 25;

              if (isHighSpike) {
                // Explosive Spike Smash!
                arcadeAudio.playSpike();
                ball.isSpiked = true;
                addScreenShake(6);
                spawnParticles(ball.x, ball.y, "#f59e0b", 16, 1.4);

                const spikeSpeed = 13.5;
                if (isPlayer) {
                  ball.vx = Math.cos(Math.PI * 0.22) * spikeSpeed;
                  ball.vy = Math.sin(Math.PI * 0.22) * spikeSpeed;
                } else {
                  ball.vx = -Math.cos(Math.PI * 0.22) * spikeSpeed;
                  ball.vy = Math.sin(Math.PI * 0.22) * spikeSpeed;
                }
              } else {
                // Snappy Pop / Bump
                arcadeAudio.playBounce();
                ball.isSpiked = false;
                spawnParticles(ball.x, ball.y, isPlayer ? "#06b6d4" : "#ec4899", 7);

                const hitSpeed = Math.min(11.0, Math.hypot(ball.vx, ball.vy) * 0.95 + 3.0);
                ball.vx = Math.cos(angle) * hitSpeed;
                ball.vy = Math.min(-6.5, Math.sin(angle) * hitSpeed);

                // Add forward momentum based on slime movement
                ball.vx += s.vx * 0.45;
                if (isPlayer && ball.vx < 2) ball.vx = 3.5;
                if (!isPlayer && ball.vx > -2) ball.vx = -3.5;
              }

              // Push ball out of collision zone
              ball.x = s.x + Math.cos(angle) * (s.radius + ball.radius + 2);
              ball.y = s.y + Math.sin(angle) * (s.radius + ball.radius + 2);
            }
          };

          checkSlimeHit(player, true);
          checkSlimeHit(ai, false);

          // ── Point Scored ──
          if (ball.y + ball.radius >= court.groundY) {
            arcadeAudio.playWhistle();
            addScreenShake(5);
            spawnParticles(ball.x, court.groundY, "#facc15", 20, 1.2);

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

      // Update particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * dtFactor;
        p.y += p.vy * dtFactor;
        p.life -= 0.035 * dtFactor;
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      // Update Screen Shake
      if (state.screenShake > 0) {
        state.screenShake = Math.max(0, state.screenShake - 0.4 * dtFactor);
      }

      // ── Draw Graphics ──
      ctx.save();
      if (state.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * state.screenShake * 2.5;
        const shakeY = (Math.random() - 0.5) * state.screenShake * 2.5;
        ctx.translate(shakeX, shakeY);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sky.addColorStop(0, "#060913");
      sky.addColorStop(1, "#0f172a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cyber court grid background lines
      ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 30; x < canvas.width; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, court.groundY);
        ctx.stroke();
      }

      // Ground Floor
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, court.groundY, canvas.width, canvas.height - court.groundY);
      ctx.fillStyle = "#38bdf8";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 8;
      ctx.fillRect(0, court.groundY, canvas.width, 2.5);
      ctx.shadowBlur = 0;

      // Slime Court Shadows
      const drawShadow = (x: number, y: number, r: number) => {
        const distFromFloor = court.groundY - y;
        const shadowScale = Math.max(0.3, 1 - distFromFloor / 180);
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.ellipse(x, court.groundY + 3, r * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      drawShadow(player.x, player.y, player.radius);
      drawShadow(ai.x, ai.y, ai.radius);
      drawShadow(ball.x, ball.y, ball.radius);

      // Net
      ctx.fillStyle = "#f8fafc";
      ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
      ctx.shadowBlur = 6;
      ctx.fillRect(netLeft, netTopY, court.netW, court.netH);
      ctx.shadowBlur = 0;

      // Net cross-hatch
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      for (let y = netTopY; y < court.groundY; y += 7) {
        ctx.beginPath();
        ctx.moveTo(netLeft, y);
        ctx.lineTo(netRight, y);
        ctx.stroke();
      }

      // Draw Slimes
      const drawSlime = (s: Slime, color: string, eyeOffsetX: number, isDiving: boolean) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        if (isDiving) {
          ctx.ellipse(s.x, s.y - 4, s.radius * 1.3, s.radius * 0.65, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(s.x, s.y, s.radius, Math.PI, 0);
        }
        ctx.closePath();
        ctx.fill();

        // Eye white
        const eyeX = s.x + eyeOffsetX;
        const eyeY = s.y - (isDiving ? 6 : 10);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Pupil tracking ball
        const angle = Math.atan2(ball.y - eyeY, ball.x - eyeX);
        const pupilX = eyeX + Math.cos(angle) * 2;
        const pupilY = eyeY + Math.sin(angle) * 2;
        ctx.fillStyle = "#09090b";
        ctx.beginPath();
        ctx.arc(pupilX, pupilY, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      drawSlime(player, "#06b6d4", 8, player.isDiving);
      drawSlime(ai, "#ec4899", -8, ai.isDiving);

      // Draw Ball Trail
      for (let i = 0; i < state.trail.length; i++) {
        const pt = state.trail[i];
        const alpha = (i / state.trail.length) * 0.45;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ball.radius * (i / state.trail.length), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Draw Volleyball
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rotation);
      ctx.shadowColor = ball.isSpiked ? "#f59e0b" : "#facc15";
      ctx.shadowBlur = ball.isSpiked ? 18 : 10;
      ctx.fillStyle = ball.isSpiked ? "#f59e0b" : "#facc15";
      ctx.beginPath();
      ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ball seams
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, ball.radius, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-ball.radius, 0);
      ctx.lineTo(ball.radius, 0);
      ctx.stroke();
      ctx.restore();

      // Draw Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
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
          height={330}
          className="block aspect-[12/11] max-w-[340px] sm:max-w-[360px]"
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
                  A / D to Move · Space to Jump · Jump + Ball at Apex to <b>SPIKE SMASH</b>! S or Down to <b>Dive</b>.
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
            className="w-11 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white text-sm font-bold flex items-center justify-center"
          >
            ◀
          </button>
          <button
            onTouchStart={() => (stateRef.current.keys.right = true)}
            onTouchEnd={() => (stateRef.current.keys.right = false)}
            className="w-11 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white text-sm font-bold flex items-center justify-center"
          >
            ▶
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDiveInput}
            className="px-3 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 text-xs font-bold active:scale-95 flex items-center justify-center"
          >
            DIVE
          </button>
          <button
            onClick={handleJumpInput}
            className="px-4 h-10 rounded-xl bg-cyan-500 text-black text-xs font-bold shadow-md active:scale-95 flex items-center justify-center"
          >
            JUMP ⤒
          </button>
        </div>
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Controls: <b>A / D</b> Move · <b>W / Space</b> Jump & Spike · <b>S / Shift</b> Dive Slide
      </p>
    </div>
  );
}
