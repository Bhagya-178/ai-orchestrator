"use client";

import { useMemo } from "react";
import { Plus, Minus, ArrowLeftRight } from "lucide-react";

interface ArtifactDiffViewerProps {
  originalText: string;
  modifiedText: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLine?: number;
  newLine?: number;
}

export default function ArtifactDiffViewer({ originalText, modifiedText }: ArtifactDiffViewerProps) {
  const diffLines = useMemo(() => {
    const orig = originalText.split("\n");
    const mod = modifiedText.split("\n");
    const lines: DiffLine[] = [];

    let oIdx = 0;
    let mIdx = 0;

    while (oIdx < orig.length || mIdx < mod.length) {
      if (oIdx < orig.length && mIdx < mod.length) {
        if (orig[oIdx] === mod[mIdx]) {
          lines.push({
            type: "unchanged",
            content: orig[oIdx],
            oldLine: oIdx + 1,
            newLine: mIdx + 1,
          });
          oIdx++;
          mIdx++;
        } else {
          // Check if modified line exists further down in original
          lines.push({
            type: "removed",
            content: orig[oIdx],
            oldLine: oIdx + 1,
          });
          lines.push({
            type: "added",
            content: mod[mIdx],
            newLine: mIdx + 1,
          });
          oIdx++;
          mIdx++;
        }
      } else if (oIdx < orig.length) {
        lines.push({
          type: "removed",
          content: orig[oIdx],
          oldLine: oIdx + 1,
        });
        oIdx++;
      } else if (mIdx < mod.length) {
        lines.push({
          type: "added",
          content: mod[mIdx],
          newLine: mIdx + 1,
        });
        mIdx++;
      }
    }

    return lines;
  }, [originalText, modifiedText]);

  const addedCount = diffLines.filter((l) => l.type === "added").length;
  const removedCount = diffLines.filter((l) => l.type === "removed").length;

  return (
    <div className="flex flex-col h-full bg-[var(--background)] font-mono text-xs overflow-hidden">
      {/* Diff Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-3.5 h-3.5 text-purple-500" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">Revision Diff</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center text-emerald-600 dark:text-emerald-400">
            <Plus className="w-3 h-3 mr-0.5" /> {addedCount} additions
          </span>
          <span className="flex items-center text-red-600 dark:text-red-400">
            <Minus className="w-3 h-3 mr-0.5" /> {removedCount} deletions
          </span>
        </div>
      </div>

      {/* Diff Line List */}
      <div className="flex-1 overflow-auto p-2">
        {diffLines.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            No differences detected
          </div>
        ) : (
          diffLines.map((line, idx) => (
            <div
              key={idx}
              className={`flex items-start font-mono leading-5 py-0.5 px-2 rounded ${
                line.type === "added"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : line.type === "removed"
                  ? "bg-red-500/10 text-red-700 dark:text-red-300"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {/* Line Numbers */}
              <span className="w-8 select-none text-right pr-2 text-gray-400 text-[10px]">
                {line.oldLine || ""}
              </span>
              <span className="w-8 select-none text-right pr-3 text-gray-400 text-[10px]">
                {line.newLine || ""}
              </span>

              {/* Marker */}
              <span className="w-4 select-none font-bold">
                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
              </span>

              {/* Code content */}
              <span className="flex-1 whitespace-pre-wrap break-all">{line.content}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
