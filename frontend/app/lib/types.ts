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
  attachedDocument?: UploadedDocument;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMetrics {
  total_requests: number;
  average_latency_ms: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  average_tokens_per_second: number;
}

export interface MetricsResponse {
  session_id: string;
  metrics: ChatMetrics;
}
