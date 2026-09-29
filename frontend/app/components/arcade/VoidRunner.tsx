"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Sparkles, Shield, Zap } from "lucide-react";
import { arcadeAudio } from "./arcadeAudio";

interface Asteroid {
  x: number;
  y: number;
  radius: number;
  speed: number;
  angle: number;
  spin: number;
  vertices: number[];
  scoredNearMiss: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
}

interface EnergyOrb {
  x: number;
  y: number;
  radius: number;
  speed: number;
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

function VoidRunner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasShield, setHasShield] = useState(false);
  const [nearMissAlert, setNearMissAlert] = useState(false);
  const nearMissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (nearMissTimerRef.current) clearTimeout(nearMissTimerRef.current);
    };
  }, []);

  const stateRef = useRef({
    ship: {
      x: 180,
      y: 300,
      vx: 0,
      targetX: 180,
      w: 20,
      h: 26,
      speed: 9.5,
      tilt: 0,
      shieldTimer: 0,
    },
    keys: { left: false, right: false },
    stars: [] as Star[],
    asteroids: [] as Asteroid[],
    energyOrbs: [] as EnergyOrb[],
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
    gameTime: 0,
    baseSpeed: 6.0,
    screenShake: 0,
    lastTime: 0,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_runner_highscore");
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
        pool[i].color = color;
        pool[i].size = Math.random() * 2.5 + 1.5;
        pool[i].active = true;
        spawned++;
      }
    }
  };

  const initStars = () => {
    const stars: Star[] = [];
    for (let i = 0; i < 45; i++) {
      stars.push({
        x: Math.random() * 360,
        y: Math.random() * 340,
        size: Math.random() * 1.5 + 0.6,
        speed: Math.random() * 3 + 2.5,
      });
    }
    stateRef.current.stars = stars;
  };

  const startGame = useCallback(() => {
    initStars();
    stateRef.current.ship = {
      x: 180,
      y: 300,
      vx: 0,
      targetX: 180,
      w: 20,
      h: 26,
      speed: 9.5,
      tilt: 0,
      shieldTimer: 0,
    };
    stateRef.current.asteroids = [];
    stateRef.current.energyOrbs = [];
    stateRef.current.gameTime = 0;
    stateRef.current.baseSpeed = 6.0;
    stateRef.current.screenShake = 0;
    setHasShield(false);
    setNearMissAlert(false);
    setScore(0);
    setIsGameOver(false);
    setIsPlaying(true);
    arcadeAudio.playReadyChime();
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const scaleX = canvas.width / rect.width;
    const clientX = e.clientX - rect.left;
    stateRef.current.ship.targetX = Math.max(16, Math.min(canvas.width - 16, clientX * scaleX));
  };

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

    initStars();
    stateRef.current.lastTime = performance.now();

    const render = (time: number) => {
      const state = stateRef.current;
      const rawDt = (time - state.lastTime) / 1000;
      state.lastTime = time;
      const dtFactor = Math.min(2.0, Math.max(0.5, rawDt * 60));

      const { ship, keys, stars, asteroids, energyOrbs } = state;

      if (isPlaying && !isGameOver) {
        state.gameTime += dtFactor;
        state.baseSpeed = 6.0 + Math.min(7.0, state.gameTime * 0.003);

        // Ship Handling
        let targetVx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        if (keys.left || keys.right) {
          ship.vx += (targetVx * ship.speed - ship.vx) * 0.45 * dtFactor;
          ship.x += ship.vx * dtFactor;
        } else {
          const dx = ship.targetX - ship.x;
          ship.vx += (Math.sign(dx) * Math.min(ship.speed, Math.abs(dx) * 0.4) - ship.vx) * 0.5 * dtFactor;
          ship.x += ship.vx * dtFactor;
        }

        ship.x = Math.max(16, Math.min(canvas.width - 16, ship.x));
        ship.tilt = -ship.vx * 0.038;

        // Thruster particles
        spawnParticles(ship.x - 4, ship.y + 11, "#38bdf8", 1, 0.4);
        spawnParticles(ship.x + 4, ship.y + 11, "#06b6d4", 1, 0.4);

        if (ship.shieldTimer > 0) {
          ship.shieldTimer -= dtFactor;
          if (ship.shieldTimer <= 0) setHasShield(false);
        }

        if (Math.floor(state.gameTime) % 6 === 0) {
          setScore((prev) => {
            const next = prev + 1;
            setHighScore((prevHigh) => {
              if (next > prevHigh) {
                try {
                  localStorage.setItem("ai_arcade_runner_highscore", String(next));
                } catch {}
                return next;
              }
              return prevHigh;
            });
            return next;
          });
        }

        // Spawn Asteroids
        if (Math.random() < (0.042 + state.gameTime * 0.000035) * dtFactor) {
          const verts = [];
          for (let v = 0; v < 7; v++) {
            verts.push(0.8 + Math.random() * 0.4);
          }
          asteroids.push({
            x: Math.random() * (canvas.width - 40) + 20,
            y: -30,
            radius: Math.random() * 11 + 10,
            speed: state.baseSpeed + Math.random() * 2.2,
            angle: 0,
            spin: (Math.random() - 0.5) * 0.05,
            vertices: verts,
            scoredNearMiss: false,
          });
        }

        // Spawn Energy Orbs
        if (Math.random() < 0.012 * dtFactor) {
          energyOrbs.push({
            x: Math.random() * (canvas.width - 40) + 20,
            y: -20,
            radius: 6,
            speed: state.baseSpeed * 0.85,
          });
        }

        // Move Orbs
        for (let i = energyOrbs.length - 1; i >= 0; i--) {
          const orb = energyOrbs[i];
          orb.y += orb.speed * dtFactor;

          const dist = Math.hypot(ship.x - orb.x, ship.y - orb.y);
          if (dist < ship.w / 2 + orb.radius + 5) {
            arcadeAudio.playPowerup();
            ship.shieldTimer = 220;
            setHasShield(true);
            setScore((s) => s + 75);
            addScreenShake(2);
            spawnParticles(orb.x, orb.y, "#a855f7", 12, 1.2);
            energyOrbs.splice(i, 1);
            continue;
          }

          if (orb.y > canvas.height + 20) energyOrbs.splice(i, 1);
        }

        // Move Asteroids
        for (let i = asteroids.length - 1; i >= 0; i--) {
          const a = asteroids[i];
          a.y += a.speed * dtFactor;
          a.angle += a.spin * dtFactor;

          const dist = Math.hypot(ship.x - a.x, ship.y - a.y);
          const effectiveRadius = a.radius * 0.82; // Tight, accurate hitbox

          // Collision
          if (dist < effectiveRadius + 8) {
            if (ship.shieldTimer > 0) {
              arcadeAudio.playSpike();
              addScreenShake(4);
              spawnParticles(a.x, a.y, "#a855f7", 14, 1.3);
              asteroids.splice(i, 1);
              continue;
            } else {
              arcadeAudio.playCrash();
              addScreenShake(8);
              spawnParticles(ship.x, ship.y, "#ef4444", 24, 1.8);
              setIsGameOver(true);
              setIsPlaying(false);
              return;
            }
          }

          // Single-Fire Near Miss (+40 pts)
          if (!a.scoredNearMiss && dist < effectiveRadius + 22 && a.y > ship.y - 12 && a.y < ship.y + 12) {
            a.scoredNearMiss = true;
            arcadeAudio.playTurbo();
            setNearMissAlert(true);
            if (nearMissTimerRef.current) clearTimeout(nearMissTimerRef.current);
            nearMissTimerRef.current = setTimeout(() => setNearMissAlert(false), 450);
            setScore((s) => s + 40);
            spawnParticles(a.x, a.y, "#facc15", 6, 0.7);
          }

          if (a.y > canvas.height + 35) asteroids.splice(i, 1);
        }
      }

      // Move Warp Starfield
      for (const star of stars) {
        star.y += (star.speed + (isPlaying ? state.baseSpeed * 1.4 : 1)) * dtFactor;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
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
          (Math.random() - 0.5) * state.screenShake * 2.5,
          (Math.random() - 0.5) * state.screenShake * 2.5
        );
      }

      // Void Background
      ctx.fillStyle = "#050811";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Warp Speed Stars
      const warpMult = isPlaying ? Math.min(18, state.baseSpeed * 2.0) : 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1.2;
      for (const s of stars) {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y + warpMult);
        ctx.stroke();
      }

      // Draw Energy Orbs
      for (const orb of energyOrbs) {
        ctx.fillStyle = "#c084fc";
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Asteroids
      for (const a of asteroids) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);

        ctx.fillStyle = "#27272a";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        const numVerts = a.vertices.length;
        for (let v = 0; v < numVerts; v++) {
          const theta = (v / numVerts) * Math.PI * 2;
          const rad = a.radius * a.vertices[v];
          const vx = Math.cos(theta) * rad;
          const vy = Math.sin(theta) * rad;
          if (v === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#3f3f46";
        ctx.beginPath();
        ctx.arc(a.radius * 0.25, a.radius * 0.2, a.radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Spaceship
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.tilt);

      if (ship.shieldTimer > 0) {
        ctx.strokeStyle = "rgba(168, 85, 247, 0.7)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ship.w + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hull
      ctx.fillStyle = "#06b6d4";
      ctx.beginPath();
      ctx.moveTo(0, -ship.h / 2);
      ctx.lineTo(ship.w / 2, ship.h / 2);
      ctx.lineTo(0, ship.h / 2 - 4);
      ctx.lineTo(-ship.w / 2, ship.h / 2);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, -2, 2.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Particles
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
  }, [isPlaying, isGameOver]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* HUD Header */}
      <div className="flex items-center justify-between w-full px-2 mb-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-indigo-400 font-bold">WARP DIST:</span>
            <span className="font-extrabold text-white text-sm">{score}</span>
          </div>
          {hasShield && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold border border-purple-500/30">
              <Shield className="w-3 h-3 text-purple-400 fill-purple-400" />
              <span>SHIELD</span>
            </div>
          )}
          {nearMissAlert && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold border border-yellow-500/30">
              <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span>NEAR MISS +40!</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 font-mono text-[var(--muted)] text-[11px]">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span>BEST: {highScore}</span>
        </div>
      </div>

      {/* Canvas Warp Void */}
      <div className="relative rounded-2xl overflow-hidden border border-indigo-500/25 shadow-2xl bg-black/80 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={330}
          onPointerMove={handlePointerMove}
          className="block aspect-[12/11] max-w-[340px] sm:max-w-[360px] cursor-none touch-none"
        />

        {/* Start / Game Over Overlay */}
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            {isGameOver ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-red-400" />
                </div>
                <p className="font-bold text-lg mb-1 tracking-wider text-red-400">
                  HULL BREACHED!
                </p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Final Warp Distance: <span className="text-white font-bold">{score}</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Launch Next Vessel</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 text-indigo-400 fill-indigo-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Void Runner Hyperspace</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[240px] mb-4">
                  Move mouse or A / D to steer. Graze close for <b>Near Miss</b> bonuses, collect purple <b>Shield Orbs</b>!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Engage Warp Drive
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Controls: <b>Mouse</b> or <b>A / D / Arrows</b> to Steer · Graze asteroids for Near-Miss combos
      </p>
    </div>
  );
}

export default React.memo(VoidRunner);
