"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, Trophy, Award } from "lucide-react";
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

export default function ArcadeVolleyball() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);

  const stateRef = useRef({
    court: { groundY: 310, netX: 180, netW: 6, netH: 65 },
    player: { x: 80, y: 310, vx: 0, vy: 0, radius: 24, speed: 4.8, isJumping: false } as Slime,
    ai: { x: 280, y: 310, vx: 0, vy: 0, radius: 24, speed: 4.2, isJumping: false } as Slime,
    ball: { x: 90, y: 160, vx: 2, vy: -1, radius: 9, rotation: 0 },
    keys: { left: false, right: false, jump: false },
    gravity: 0.32,
    ballGravity: 0.20,
    pointScoredPause: 0,
    server: "player" as "player" | "ai",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_arcade_volley_highscore");
      if (saved) setHighScore(parseInt(saved, 10));
    } catch {}
  }, []);

  const resetRally = useCallback((serverWinner: "player" | "ai") => {
    const { player, ai, ball, court } = stateRef.current;
    player.x = 80;
    player.y = court.groundY;
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;

    ai.x = 280;
    ai.y = court.groundY;
    ai.vx = 0;
    ai.vy = 0;
    ai.isJumping = false;

    stateRef.current.server = serverWinner;
    if (serverWinner === "player") {
      ball.x = 80;
      ball.y = 170;
      ball.vx = 1.5;
      ball.vy = -3;
    } else {
      ball.x = 280;
      ball.y = 170;
      ball.vx = -1.5;
      ball.vy = -3;
    }
    stateRef.current.pointScoredPause = 35; // ~0.6s pause
  }, []);

  const startGame = useCallback(() => {
    setPlayerScore(0);
    setAiScore(0);
    setWinner(null);
    setIsPlaying(true);
    resetRally("player");
    arcadeAudio.playWhistle();
  }, [resetRally]);

  // Touch / Onscreen button controls
  const handleMoveInput = (dir: -1 | 0 | 1) => {
    stateRef.current.keys.left = dir === -1;
    stateRef.current.keys.right = dir === 1;
  };

  const handleJumpInput = () => {
    const p = stateRef.current.player;
    if (!p.isJumping) {
      p.vy = -7.4;
      p.isJumping = true;
      arcadeAudio.playJump();
    }
  };

  // Keyboard navigation
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
      const state = stateRef.current;
      const { player, ai, ball, court, keys, gravity, ballGravity } = state;
      const netTopY = court.groundY - court.netH;
      const netLeft = court.netX - court.netW / 2;
      const netRight = court.netX + court.netW / 2;

      if (isPlaying && !winner) {
        if (state.pointScoredPause > 0) {
          state.pointScoredPause -= 1;
        } else {
          // ── Update Player ──
          if (keys.left) player.x = Math.max(player.radius + 5, player.x - player.speed);
          if (keys.right) player.x = Math.min(netLeft - player.radius, player.x + player.speed);

          player.vy += gravity;
          player.y += player.vy;
          if (player.y >= court.groundY) {
            player.y = court.groundY;
            player.vy = 0;
            player.isJumping = false;
          }

          // ── AI Bot Strategy ──
          const aiTargetX = ball.x > court.netX ? ball.x : 280;
          const aiDist = aiTargetX - ai.x;
          if (Math.abs(aiDist) > 5) {
            ai.x += Math.sign(aiDist) * Math.min(ai.speed, Math.abs(aiDist));
          }
          ai.x = Math.max(netRight + ai.radius, Math.min(canvas.width - ai.radius - 5, ai.x));

          // AI Jump decision when ball is near and dropping
          if (ball.x > court.netX && ball.x > ai.x - 30 && ball.x < ai.x + 30 && ball.y < court.groundY - 30 && !ai.isJumping && ball.vy > 0) {
            ai.vy = -6.8;
            ai.isJumping = true;
          }

          ai.vy += gravity;
          ai.y += ai.vy;
          if (ai.y >= court.groundY) {
            ai.y = court.groundY;
            ai.vy = 0;
            ai.isJumping = false;
          }

          // ── Update Ball Physics ──
          ball.vy += ballGravity;
          ball.x += ball.vx;
          ball.y += ball.vy;
          ball.rotation += ball.vx * 0.05;

          // Wall bounces
          if (ball.x - ball.radius <= 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx) * 0.9;
            arcadeAudio.playBounce();
          } else if (ball.x + ball.radius >= canvas.width) {
            ball.x = canvas.width - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 0.9;
            arcadeAudio.playBounce();
          }

          // Ceiling bounce
          if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy);
            arcadeAudio.playBounce();
          }

          // ── Net Collision ──
          if (ball.y + ball.radius >= netTopY && ball.x + ball.radius >= netLeft && ball.x - ball.radius <= netRight) {
            if (ball.y < netTopY + 5) {
              ball.y = netTopY - ball.radius;
              ball.vy = -Math.abs(ball.vy) * 0.85;
            } else if (ball.x < court.netX) {
              ball.x = netLeft - ball.radius;
              ball.vx = -Math.abs(ball.vx) * 0.8;
            } else {
              ball.x = netRight + ball.radius;
              ball.vx = Math.abs(ball.vx) * 0.8;
            }
            arcadeAudio.playBounce();
          }

          // ── Player Collision (Slime semi-circle dome) ──
          const checkSlimeHit = (s: Slime, isPlayerSlime: boolean) => {
            const dx = ball.x - s.x;
            const dy = ball.y - s.y;
            const dist = Math.hypot(dx, dy);

            if (dist < s.radius + ball.radius && ball.y <= s.y) {
              arcadeAudio.playSpike();
              // Normal reflection angle from dome
              const angle = Math.atan2(dy, dx);
              const speed = Math.min(7.5, Math.hypot(ball.vx, ball.vy) + 1.2);

              ball.vx = Math.cos(angle) * speed;
              ball.vy = Math.min(-3.5, Math.sin(angle) * speed);

              // Additional forward momentum
              if (isPlayerSlime && ball.vx < 1) ball.vx = 2.5;
              if (!isPlayerSlime && ball.vx > -1) ball.vx = -2.5;
            }
          };

          checkSlimeHit(player, true);
          checkSlimeHit(ai, false);

          // ── Floor Landing / Point Scored ──
          if (ball.y + ball.radius >= court.groundY) {
            arcadeAudio.playWhistle();
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

      // ── Draw Graphics ──
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Sky background gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, "#080c16");
      skyGrad.addColorStop(1, "#0d1527");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ground Floor
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, court.groundY, canvas.width, canvas.height - court.groundY);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(0, court.groundY, canvas.width, 2);

      // Net
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(netLeft, netTopY, court.netW, court.netH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      for (let y = netTopY; y < court.groundY; y += 8) {
        ctx.beginPath();
        ctx.moveTo(netLeft, y);
        ctx.lineTo(netRight, y);
        ctx.stroke();
      }

      // Draw Slime Helper
      const drawSlime = (s: Slime, color: string, eyeOffsetX: number) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        // Eye white
        const eyeX = s.x + eyeOffsetX;
        const eyeY = s.y - 10;
        ctx.fillStyle = "#ffffff";
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

      // Draw Player Slime (Cyan)
      drawSlime(player, "#06b6d4", 8);

      // Draw AI Slime (Magenta)
      drawSlime(ai, "#ec4899", -8);

      // Draw Volleyball
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rotation);
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ball seams
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, ball.radius, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-ball.radius, 0);
      ctx.lineTo(ball.radius, 0);
      ctx.stroke();
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
          height={340}
          className="block aspect-[18/17] max-w-[340px] sm:max-w-[360px]"
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
                <p className="text-[11px] text-[var(--muted)] max-w-[220px] mb-4">
                  A / D to move, W or Space to Jump. Spike the ball over the net to defeat the Cyber Bot!
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
      <div className="flex items-center justify-between w-full max-w-[340px] mt-3 sm:hidden">
        <div className="flex items-center gap-2">
          <button
            onTouchStart={() => handleMoveInput(-1)}
            onTouchEnd={() => handleMoveInput(0)}
            onMouseDown={() => handleMoveInput(-1)}
            onMouseUp={() => handleMoveInput(0)}
            className="w-12 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white text-sm font-bold flex items-center justify-center"
          >
            ◀
          </button>
          <button
            onTouchStart={() => handleMoveInput(1)}
            onTouchEnd={() => handleMoveInput(0)}
            onMouseDown={() => handleMoveInput(1)}
            onMouseUp={() => handleMoveInput(0)}
            className="w-12 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white text-sm font-bold flex items-center justify-center"
          >
            ▶
          </button>
        </div>
        <button
          onClick={handleJumpInput}
          className="px-6 h-10 rounded-xl bg-cyan-500 text-black text-xs font-bold shadow-md active:scale-95 flex items-center justify-center"
        >
          JUMP ⤒
        </button>
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-2 hidden sm:block">
        Controls: A / D or Arrows to Move · W, Up or Space to Jump
      </p>
    </div>
  );
}
