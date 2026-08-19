"use client";

import { X, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { UploadedDocument } from "@/app/lib/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentAttachment({ 
  document, 
  onRemove 
}: { 
  document: UploadedDocument, 
  onRemove: () => void 
}) {
  return (
    <div className="flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/10 w-fit pr-3">
      <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#2C2C2C] rounded-md border border-[var(--border)] shadow-sm">
        <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1 max-w-[200px]">
          {document.filename}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatFileSize(document.fileSize)}</span>
          <span>·</span>
          {document.status === "uploading" || document.status === "processing" ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </span>
          )}
        </div>
      </div>
      <button 
        onClick={onRemove}
        className="ml-2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
