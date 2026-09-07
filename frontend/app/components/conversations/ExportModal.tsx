"use client";

import { useState } from "react";
import { X, FileText, Download, Check, Copy, Code } from "lucide-react";
import { ConversationExportData } from "@/app/lib/types";

interface ExportModalProps {
  exportData: ConversationExportData | null;
  onClose: () => void;
}

export default function ExportModal({ exportData, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!exportData) return null;

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    const slug = exportData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(exportData.markdown, `${slug}.md`, "text/markdown;charset=utf-8");
  };

  const handleDownloadJson = () => {
    const slug = exportData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const jsonStr = JSON.stringify(exportData.json_data, null, 2);
    downloadFile(jsonStr, `${slug}.json`, "application/json;charset=utf-8");
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(exportData.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Export Conversation</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[280px]">{exportData.title}</p>
          </div>
        </div>

        <div className="space-y-2.5 my-4">
          <button
            onClick={handleDownloadMarkdown}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Markdown Document (.md)</div>
                <div className="text-xs text-gray-400">Formatted text suitable for Obsidian, Notion, or GitHub</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
          </button>

          <button
            onClick={handleDownloadJson}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <Code className="w-5 h-5 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">JSON Data (.json)</div>
                <div className="text-xs text-gray-400">Full conversation metadata, timestamps, and messages</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
          </button>

          <button
            onClick={handleCopyMarkdown}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />}
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Copy Markdown</div>
                <div className="text-xs text-gray-400">Copy formatted conversation to clipboard</div>
              </div>
            </div>
            {copied && <span className="text-xs text-green-600 font-medium">Copied!</span>}
          </button>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={onClose}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 py-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
