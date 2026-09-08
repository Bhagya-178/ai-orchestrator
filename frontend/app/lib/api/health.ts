import { fetchApi, fetchJson } from "./client";

export async function getHealth(): Promise<boolean> {
  try {
    const res = await fetchApi("/health", {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ?? true;
  } catch {
    return false;
  }
}

export interface ModelDetail {
  name: string;
  size?: number;
  family?: string;
  parameter_size?: string;
  quantization_level?: string;
  capabilities?: string[];
  modified_at?: string;
}

export async function getAvailableModels(): Promise<string[]> {
  try {
    const data = await fetchJson<{ models?: string[] }>("/models");
    if (data && Array.isArray(data.models) && data.models.length > 0) {
      return data.models;
    }
    return ["qwen3:8b", "deepseek-r1:8b", "qwen2.5-coder:7b", "gemma4:e4b", "qwen2.5:1.5b"];
  } catch {
    return ["qwen3:8b", "deepseek-r1:8b", "qwen2.5-coder:7b", "gemma4:e4b", "qwen2.5:1.5b"];
  }
}

export async function getModelDetails(): Promise<ModelDetail[]> {
  try {
    const data = await fetchJson<{ models: ModelDetail[] }>("/models/details");
    return data.models || [];
  } catch {
    return [];
  }
}
