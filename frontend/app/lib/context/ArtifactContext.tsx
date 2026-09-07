"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { Artifact } from "../types";

interface ArtifactContextType {
  activeArtifact: Artifact | null;
  isCanvasOpen: boolean;
  viewMode: "preview" | "code";
  openArtifact: (artifact: Artifact, mode?: "preview" | "code") => void;
  closeCanvas: () => void;
  setViewMode: (mode: "preview" | "code") => void;
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined);

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const openArtifact = useCallback((artifact: Artifact, mode: "preview" | "code" = "preview") => {
    setActiveArtifact(artifact);
    // If artifact type cannot be rendered as live preview (e.g. pure python), default to code
    if (artifact.type === "code" || artifact.type === "react") {
      setViewMode(mode === "preview" && artifact.type === "code" ? "code" : mode);
    } else {
      setViewMode(mode);
    }
    setIsCanvasOpen(true);
  }, []);

  const closeCanvas = useCallback(() => {
    setIsCanvasOpen(false);
  }, []);

  return (
    <ArtifactContext.Provider
      value={{
        activeArtifact,
        isCanvasOpen,
        viewMode,
        openArtifact,
        closeCanvas,
        setViewMode,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifact(): ArtifactContextType {
  const context = useContext(ArtifactContext);
  if (!context) {
    throw new Error("useArtifact must be used within an ArtifactProvider");
  }
  return context;
}
