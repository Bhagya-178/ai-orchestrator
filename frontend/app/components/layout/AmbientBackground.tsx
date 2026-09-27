"use client";

import React from "react";
import Image from "next/image";

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* ── Dark Mode Ambient Graphic Layer ── */}
      <div className="hidden dark:block absolute inset-0 opacity-50 transition-opacity duration-700">
        <Image
          src="/ambient-dark.jpg"
          alt="Dark Mode Obsidian Liquid Glass"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center filter saturate-125 contrast-110"
        />
      </div>

      {/* ── Light Mode Ambient Graphic Layer ── */}
      <div className="dark:hidden absolute inset-0 opacity-60 transition-opacity duration-700">
        <Image
          src="/ambient-light.jpg"
          alt="Light Mode Prismatic Liquid Glass"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center filter saturate-110 contrast-105"
        />
      </div>

      {/* ── Radial Vignette & Depth Mask ── */}
      <div 
        className="absolute inset-0 opacity-80 dark:opacity-95"
        style={{
          background: "radial-gradient(ellipse 90% 70% at 50% 30%, transparent 20%, var(--background) 90%)",
        }}
      />

      {/* ── Dark Mode Ambient Chromatic Glow Orbs ── */}
      <div 
        className="hidden dark:block absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] rounded-full filter blur-[120px] opacity-20 animate-pulse pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.4) 0%, rgba(99, 102, 241, 0.2) 60%, transparent 80%)",
          animationDuration: "9s",
        }}
      />

      <div 
        className="hidden dark:block absolute -bottom-[20%] -right-[10%] w-[65vw] h-[65vw] rounded-full filter blur-[140px] opacity-25 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 80%)",
        }}
      />

      {/* ── Subtle Micro-Grain & Optical Caustics Texture Overlay ── */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.025] dark:opacity-[0.045] mix-blend-overlay pointer-events-none">
        <filter id="glass-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#glass-grain)" />
      </svg>
    </div>
  );
}
