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

export async function getAvailableModels(): Promise<string[]> {
  try {
    const data = await fetchJson<{ models?: string[] }>("/models");
    return data.models || ["qwen2.5:1.5b", "qwen3:8b"];
  } catch {
    return ["qwen2.5:1.5b", "qwen3:8b"];
  }
}
