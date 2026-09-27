"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Sparkles } from "lucide-react";
import { arcadeAudio } from "./arcadeAudio";

interface Asteroid {
  x: number;
  y: number;
  radius: number;
  speed: number;
  angle: number;
  spin: number;
}

interface Stardust {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
}

export default function VoidRunner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const stateRef = useRef({
    ship: { x: 180, y: 310, w: 20, h: 26, speed: 7 },
    keys: { left: false, right: false, up: false, down: false },
    stars: [] as Star[],
    asteroids: [] as Asteroid[],
    stardusts: [] as Stardust[],
    gameTime: 0,
    baseSpeed: 3.5,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_runner_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const initStars = () => {
    const stars: Star[] = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * 360,
        y: Math.random() * 360,
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 3 + 1,
      });
    }
    stateRef.current.stars = stars;
  };

  const startGame = useCallback(() => {
    initStars();
    stateRef.current.ship = { x: 180, y: 310, w: 20, h: 26, speed: 7 };
    stateRef.current.asteroids = [];
    stateRef.current.stardusts = [];
    stateRef.current.gameTime = 0;
    stateRef.current.baseSpeed = 3.5;
    setScore(0);
    setIsGameOver(false);
    setIsPlaying(true);
  }, []);

  // Pointer drag for ship
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const clientX = e.clientX - rect.left;
    stateRef.current.ship.x = Math.max(15, Math.min(canvas.width - 15, clientX * scaleX));
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

  // 60FPS Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    initStars();

    const render = () => {
      const { ship, keys, stars, asteroids, stardusts } = stateRef.current;

      if (isPlaying && !isGameOver) {
        stateRef.current.gameTime += 1;
        stateRef.current.baseSpeed = 3.5 + Math.min(4.5, stateRef.current.gameTime * 0.002);

        // Move ship
        if (keys.left) ship.x = Math.max(15, ship.x - ship.speed);
        if (keys.right) ship.x = Math.min(canvas.width - 15, ship.x + ship.speed);

        // Score increments with survival time
        if (stateRef.current.gameTime % 10 === 0) {
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

        // Spawn asteroids
        if (Math.random() < 0.035 + stateRef.current.gameTime * 0.00003) {
          asteroids.push({
            x: Math.random() * (canvas.width - 30) + 15,
            y: -25,
            radius: Math.random() * 12 + 10,
            speed: stateRef.current.baseSpeed + Math.random() * 2,
            angle: 0,
            spin: (Math.random() - 0.5) * 0.05,
          });
        }

        // Spawn stardust crystals
        if (Math.random() < 0.02) {
          stardusts.push({
            x: Math.random() * (canvas.width - 30) + 15,
            y: -15,
            radius: 5,
            speed: stateRef.current.baseSpeed * 0.9,
          });
        }

        // Move asteroids & collision
        for (let i = asteroids.length - 1; i >= 0; i--) {
          const a = asteroids[i];
          a.y += a.speed;
          a.angle += a.spin;

          // Check ship collision
          const dx = ship.x - a.x;
          const dy = ship.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist < a.radius + 8) {
            arcadeAudio.playCrash();
            setIsGameOver(true);
            setIsPlaying(false);
            break;
          }

          if (a.y > canvas.height + 30) {
            asteroids.splice(i, 1);
          }
        }

        // Move stardust & collection
        for (let i = stardusts.length - 1; i >= 0; i--) {
          const s = stardusts[i];
          s.y += s.speed;

          const dx = ship.x - s.x;
          const dy = ship.y - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist < s.radius + 12) {
            arcadeAudio.playPoint();
            setScore((prev) => {
              const next = prev + 25;
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
            stardusts.splice(i, 1);
            continue;
          }

          if (s.y > canvas.height + 20) {
            stardusts.splice(i, 1);
          }
        }
      }

      // Render
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Starfield warp
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      stars.forEach((star) => {
        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Stardust crystals
      stardusts.forEach((s) => {
        ctx.save();
        ctx.fillStyle = "#facc15";
        ctx.shadowColor = "#facc15";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Asteroids
      asteroids.forEach((a) => {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);
        ctx.fillStyle = "#64748b";
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, a.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // Starship
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.fillStyle = "#818cf8";
      ctx.shadowColor = "#818cf8";
      ctx.shadowBlur = 12;

      // Triangle ship body
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(10, 10);
      ctx.lineTo(0, 5);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();

      // Thruster flame
      if (isPlaying && !isGameOver) {
        ctx.fillStyle = Math.random() > 0.5 ? "#38bdf8" : "#f43f5e";
        ctx.beginPath();
        ctx.moveTo(-4, 7);
        ctx.lineTo(0, 16 + Math.random() * 5);
        ctx.lineTo(4, 7);
        ctx.closePath();
        ctx.fill();
      }
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
            <span className="text-[var(--muted)]">SECTOR DISTANCE:</span>
            <span className="font-bold text-indigo-400 text-sm">{score}m</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-amber-400 text-[11px]">
            <Sparkles className="w-3 h-3 fill-current" />
            <span>SPEED: {stateRef.current.baseSpeed.toFixed(1)}x</span>
          </div>
        </div>

        <div className="flex items-center gap-1 font-mono text-[var(--muted)] text-[11px]">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span>BEST: {highScore}m</span>
        </div>
      </div>

      {/* Canvas Board */}
      <div className="relative rounded-2xl overflow-hidden border border-indigo-500/20 shadow-lg bg-black/70 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          onPointerMove={handlePointerMove}
          className="block aspect-square max-w-[340px] sm:max-w-[360px] cursor-ew-resize touch-none"
        />

        {/* Start / End Overlay */}
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            {isGameOver ? (
              <>
                <p className="text-rose-400 font-bold text-lg mb-1 tracking-wider">HULL BREACH</p>
                <p className="text-[var(--muted)] text-xs mb-4">
                  Flight Distance: <span className="text-white font-bold">{score}m</span>
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-medium text-xs shadow-md shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-Engage Thrusters</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 text-indigo-400 fill-indigo-400 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Void Runner</h4>
                <p className="text-[11px] text-[var(--muted)] max-w-[220px] mb-4">
                  Dodge meteorites and gather stardust crystals. Survive the deep sector!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Engage Engines
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Tip: Drag mouse or use Left / Right arrows
      </p>
    </div>
  );
}
