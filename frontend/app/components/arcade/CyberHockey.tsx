"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Award, Zap } from "lucide-react";
import { arcadeAudio } from "./arcadeAudio";

interface Striker {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  speed: number;
}

interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  isSuperCharged: boolean;
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

export default function CyberHockey() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);

  const stateRef = useRef({
    table: { w: 360, h: 320, goalY1: 105, goalY2: 215 },
    player: {
      x: 65,
      y: 160,
      lastX: 65,
      lastY: 160,
      vx: 0,
      vy: 0,
      radius: 19,
      color: "#38bdf8",
      speed: 8.5,
    } as Striker,
    ai: {
      x: 295,
      y: 160,
      lastX: 295,
      lastY: 160,
      vx: 0,
      vy: 0,
      radius: 19,
      color: "#a855f7",
      speed: 7.2,
    } as Striker,
    puck: {
      x: 180,
      y: 160,
      vx: 5.5,
      vy: 2.0,
      radius: 10,
      speed: 6.0,
      isSuperCharged: false,
    } as Puck,
    keys: { up: false, down: false, left: false, right: false, boost: false },
    scorePause: 0,
    trails: [] as { x: number; y: number; alpha: number; color: string }[],
    particles: [] as Particle[],
    screenShake: 0,
    lastTime: 0,
    railFlash: 0,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_hockey_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const addScreenShake = (amount: number) => {
    stateRef.current.screenShake = Math.max(stateRef.current.screenShake, amount);
  };

  const spawnParticles = (x: number, y: number, color: string, count = 8, speedMult = 1) => {
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

  const resetPuck = useCallback((towards: "player" | "ai") => {
    const { puck, player, ai } = stateRef.current;
    player.x = 65;
    player.y = 160;
    player.lastX = 65;
    player.lastY = 160;
    player.vx = 0;
    player.vy = 0;

    ai.x = 295;
    ai.y = 160;
    ai.lastX = 295;
    ai.lastY = 160;
    ai.vx = 0;
    ai.vy = 0;

    puck.x = 180;
    puck.y = 160;
    puck.vx = towards === "player" ? -5.5 : 5.5;
    puck.vy = (Math.random() - 0.5) * 4.5;
    puck.isSuperCharged = false;

    stateRef.current.trails = [];
    stateRef.current.scorePause = 25; // ~0.4s fast pause
  }, []);

  const startGame = useCallback(() => {
    setPlayerScore(0);
    setAiScore(0);
    setWinner(null);
    setIsPlaying(true);
    stateRef.current.particles = [];
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
    player.lastX = player.x;
    player.lastY = player.y;

    // Constrain player to their half of the table
    player.x = Math.max(player.radius + 6, Math.min(table.w / 2 - player.radius - 8, targetX));
    player.y = Math.max(player.radius + 6, Math.min(table.h - player.radius - 6, targetY));

    player.vx = player.x - player.lastX;
    player.vy = player.y - player.lastY;
  };

  const handlePowerStrike = () => {
    const { player, table } = stateRef.current;
    // Thrust forward towards center
    player.vx = 12.0;
    player.x = Math.min(table.w / 2 - player.radius - 8, player.x + 25);
    arcadeAudio.playTurbo();
    spawnParticles(player.x, player.y, "#38bdf8", 8, 1.2);
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
      if (e.code === "Space" || e.key === "Shift") handlePowerStrike();
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

      const { player, ai, puck, table, keys } = state;

      if (isPlaying && !winner) {
        if (state.scorePause > 0) {
          state.scorePause -= dtFactor;
        } else {
          // Keyboard player movement with responsive acceleration
          player.lastX = player.x;
          player.lastY = player.y;

          let targetVx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
          let targetVy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
          if (targetVx !== 0 && targetVy !== 0) {
            targetVx *= 0.707;
            targetVy *= 0.707;
          }

          player.vx += (targetVx * player.speed - player.vx) * 0.45 * dtFactor;
          player.vy += (targetVy * player.speed - player.vy) * 0.45 * dtFactor;

          player.x += player.vx * dtFactor;
          player.y += player.vy * dtFactor;

          player.x = Math.max(player.radius + 6, Math.min(table.w / 2 - player.radius - 8, player.x));
          player.y = Math.max(player.radius + 6, Math.min(table.h - player.radius - 6, player.y));

          // ── Fast Aggressive Cyber AI Striker ──
          ai.lastX = ai.x;
          ai.lastY = ai.y;

          let aiTargetY = puck.y;
          let aiTargetX = 295;

          // If puck is on AI side, AI actively hunts and charges into the puck
          if (puck.x > table.w / 2 + 10) {
            aiTargetX = Math.min(table.w - ai.radius - 10, puck.x + 8);
            aiTargetY = puck.y;
          } else {
            // Guard goal center with slight tracking
            aiTargetX = 300;
            aiTargetY = 160 + (puck.y - 160) * 0.55;
          }

          const dy = aiTargetY - ai.y;
          const dx = aiTargetX - ai.x;
          ai.vx += (Math.sign(dx) * Math.min(ai.speed, Math.abs(dx)) - ai.vx) * 0.35 * dtFactor;
          ai.vy += (Math.sign(dy) * Math.min(ai.speed, Math.abs(dy)) - ai.vy) * 0.35 * dtFactor;

          ai.x += ai.vx * dtFactor;
          ai.y += ai.vy * dtFactor;

          ai.x = Math.max(table.w / 2 + ai.radius + 8, Math.min(table.w - ai.radius - 6, ai.x));
          ai.y = Math.max(ai.radius + 6, Math.min(table.h - ai.radius - 6, ai.y));

          // ── Move Puck with Air Table Physics ──
          puck.x += puck.vx * dtFactor;
          puck.y += puck.vy * dtFactor;

          // Low air table friction
          puck.vx *= Math.pow(0.994, dtFactor);
          puck.vy *= Math.pow(0.994, dtFactor);

          // Trail points
          state.trails.push({
            x: puck.x,
            y: puck.y,
            alpha: 0.8,
            color: puck.isSuperCharged ? "#f59e0b" : "#38bdf8",
          });
          if (state.trails.length > 12) state.trails.shift();

          // Top and Bottom Rail Bounces
          if (puck.y - puck.radius <= 0) {
            puck.y = puck.radius;
            puck.vy = Math.abs(puck.vy) * 0.96;
            arcadeAudio.playBounce();
            state.railFlash = 5;
            spawnParticles(puck.x, 0, "#38bdf8", 6);
          } else if (puck.y + puck.radius >= table.h) {
            puck.y = table.h - puck.radius;
            puck.vy = -Math.abs(puck.vy) * 0.96;
            arcadeAudio.playBounce();
            state.railFlash = 5;
            spawnParticles(puck.x, table.h, "#38bdf8", 6);
          }

          // Left Wall / Goal Check (Player Goal)
          if (puck.x - puck.radius <= 0) {
            if (puck.y >= table.goalY1 && puck.y <= table.goalY2) {
              // Goal for AI!
              arcadeAudio.playWhistle();
              addScreenShake(7);
              spawnParticles(0, puck.y, "#ec4899", 20, 1.4);

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
              puck.vx = Math.abs(puck.vx) * 0.94;
              arcadeAudio.playBounce();
              spawnParticles(0, puck.y, "#38bdf8", 6);
            }
          }

          // Right Wall / Goal Check (AI Goal)
          if (puck.x + puck.radius >= table.w) {
            if (puck.y >= table.goalY1 && puck.y <= table.goalY2) {
              // Goal for Player!
              arcadeAudio.playSpike();
              addScreenShake(8);
              spawnParticles(table.w, puck.y, "#38bdf8", 24, 1.5);

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
              puck.vx = -Math.abs(puck.vx) * 0.94;
              arcadeAudio.playBounce();
              spawnParticles(table.w, puck.y, "#ec4899", 6);
            }
          }

          // ── Real Kinetic Momentum Striker Collision ──
          const handleStrikerHit = (s: Striker, isPlayer: boolean) => {
            const cdx = puck.x - s.x;
            const cdy = puck.y - s.y;
            const dist = Math.hypot(cdx, cdy);

            if (dist < s.radius + puck.radius) {
              const angle = Math.atan2(cdy, cdx);

              // Calculate striker swing velocity
              const swingSpeed = Math.hypot(s.vx, s.vy);
              const isSmash = swingSpeed > 5.0 || (isPlayer && s.vx > 4);

              let hitSpeed = Math.hypot(puck.vx, puck.vy) * 0.75 + swingSpeed * 1.35 + 4.5;
              hitSpeed = Math.min(18.5, Math.max(7.0, hitSpeed));

              puck.vx = Math.cos(angle) * hitSpeed;
              puck.vy = Math.sin(angle) * hitSpeed;

              // Transfer direct striker swing direction vector
              puck.vx += s.vx * 0.45;
              puck.vy += s.vy * 0.45;

              // Ensure forward exit momentum
              if (isPlayer && puck.vx < 3.5) puck.vx = 4.5;
              if (!isPlayer && puck.vx > -3.5) puck.vx = -4.5;

              // Push puck outside striker immediately to prevent sticky overlaps
              puck.x = s.x + Math.cos(angle) * (s.radius + puck.radius + 2);
              puck.y = s.y + Math.sin(angle) * (s.radius + puck.radius + 2);

              if (isSmash || hitSpeed > 13.0) {
                puck.isSuperCharged = true;
                arcadeAudio.playSpike();
                addScreenShake(5);
                spawnParticles(puck.x, puck.y, "#f59e0b", 12, 1.3);
              } else {
                puck.isSuperCharged = false;
                arcadeAudio.playBounce();
                spawnParticles(puck.x, puck.y, s.color, 6);
              }
            }
          };

          handleStrikerHit(player, true);
          handleStrikerHit(ai, false);
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

      // Update Screen Shake & Rail Flash
      if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - 0.4 * dtFactor);
      if (state.railFlash > 0) state.railFlash = Math.max(0, state.railFlash - 0.3 * dtFactor);

      // ── Draw Graphics ──
      ctx.save();
      if (state.screenShake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * state.screenShake * 2.5,
          (Math.random() - 0.5) * state.screenShake * 2.5
        );
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cyber Rink Table Surface
      const surfaceGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      surfaceGrad.addColorStop(0, "#080c16");
      surfaceGrad.addColorStop(0.5, "#0b1120");
      surfaceGrad.addColorStop(1, "#080c16");
      ctx.fillStyle = surfaceGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cyber Rink Centerline & Face-Off Circle
      ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 45, 0, Math.PI * 2);
      ctx.stroke();

      // Goal Creases
      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
      ctx.beginPath();
      ctx.arc(0, canvas.height / 2, 55, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(168, 85, 247, 0.35)";
      ctx.beginPath();
      ctx.arc(canvas.width, canvas.height / 2, 55, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.stroke();

      // Rails with dynamic flash
      const railGlow = state.railFlash > 0 ? "rgba(56, 189, 248, 0.9)" : "rgba(56, 189, 248, 0.35)";
      ctx.strokeStyle = railGlow;
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

      // Goal Opening Visuals
      ctx.fillStyle = "rgba(236, 72, 153, 0.25)";
      ctx.fillRect(0, table.goalY1, 6, table.goalY2 - table.goalY1);
      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.fillRect(canvas.width - 6, table.goalY1, 6, table.goalY2 - table.goalY1);

      // Puck Trail
      for (let i = 0; i < state.trails.length; i++) {
        const pt = state.trails[i];
        const alpha = (i / state.trails.length) * 0.55;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, puck.radius * (i / state.trails.length), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Draw Strikers
      const drawStriker = (s: Striker, isPlayer: boolean) => {
        ctx.save();
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 15;

        // Outer Ring
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner Core Knob
        ctx.fillStyle = "#09090b";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      drawStriker(player, true);
      drawStriker(ai, false);

      // Draw Puck
      ctx.save();
      ctx.shadowColor = puck.isSuperCharged ? "#f59e0b" : "#38bdf8";
      ctx.shadowBlur = puck.isSuperCharged ? 20 : 12;
      ctx.fillStyle = puck.isSuperCharged ? "#f59e0b" : "#f8fafc";
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
      ctx.fill();

      // Puck cyber pattern
      ctx.strokeStyle = puck.isSuperCharged ? "#78350f" : "#0284c7";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
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
      <div className="relative rounded-2xl overflow-hidden border border-sky-500/25 shadow-2xl bg-black/80 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={320}
          onPointerMove={handlePointerMove}
          className="block aspect-[9/8] max-w-[340px] sm:max-w-[360px] cursor-none touch-none"
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
                  {winner === "player" ? "VICTORY! 🏆" : "CYBER BOT SCORED!"}
                </p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Score: <span className="text-white font-bold">{playerScore} - {aiScore}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-medium text-xs shadow-md shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Face-Off Again</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 text-sky-400 fill-sky-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Neon Air Hockey 1v1</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[240px] mb-4">
                  Move mouse or WASD to control striker. Swing forward or press Space to <b>SMASH</b> the puck at high velocity!
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

      {/* On-screen control for touch */}
      <div className="flex items-center justify-between w-full max-w-[340px] mt-3 sm:hidden">
        <span className="text-[10px] text-zinc-400">Drag finger on table to strike</span>
        <button
          onClick={handlePowerStrike}
          className="px-5 h-9 rounded-xl bg-sky-500 text-black text-xs font-bold shadow-md active:scale-95 flex items-center gap-1"
        >
          <Zap className="w-3.5 h-3.5 fill-black" />
          <span>POWER SMASH</span>
        </button>
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Controls: <b>Mouse</b> or <b>WASD / Arrows</b> to Strike · <b>Space / Shift</b> Power Smash
      </p>
    </div>
  );
}
