"use client";

import React, { useState, useRef } from "react";
import { Volume2, VolumeX, Loader2, Pause, Play } from "lucide-react";
import { fetchApi } from "@/app/lib/api/client";

interface SpeechPlayerProps {
  text: string;
}

export default function SpeechPlayer({ text }: SpeechPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleToggle = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (audioRef.current && audioRef.current.src) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetchApi("/audio/synthesize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.slice(0, 1500) }),
      });

      if (!res.ok) throw new Error("Synthesis failed");

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Speech play error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors"
      title={isPlaying ? "Pause Read Aloud" : "Read Aloud"}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isPlaying ? (
        <Pause className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 fill-current" />
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
