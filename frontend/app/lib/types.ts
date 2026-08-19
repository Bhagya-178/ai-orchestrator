export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";

export interface UploadedDocument {
  id: string;
  filename: string;
  fileSize: number;
  contentType: string;
  status: DocumentStatus;
  createdAt?: string;
}

export interface SourceCitation {
  label: string;
  page?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  latencyMs?: number;
  sources?: SourceCitation[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
