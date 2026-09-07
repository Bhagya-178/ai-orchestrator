"use client";

import React, { useState, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInputButton({ onTranscribed, disabled }: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (disabled || isRecording || isTranscribing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/wav" });
        await sendAudioForTranscription(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Microphone access is required to use voice input.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioForTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("ai_orchestrator_access_token") : null;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

    const formData = new FormData();
    formData.append("file", blob, "voice_input.wav");

    try {
      const res = await fetch(`${baseUrl}/audio/transcribe`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          onTranscribed(data.text);
        }
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div>
      {isRecording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-md transition-all flex items-center gap-1.5 text-xs font-medium"
          title="Stop Recording"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span className="text-[11px] pr-1">Recording...</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled || isTranscribing}
          onClick={startRecording}
          className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors disabled:opacity-40"
          title="Voice Speech Input"
        >
          {isTranscribing ? (
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
