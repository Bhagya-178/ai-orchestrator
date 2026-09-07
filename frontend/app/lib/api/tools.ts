import { fetchJson } from "./client";
import { ToolSummary, ToolStepEvent } from "../types";

export async function listTools(): Promise<ToolSummary[]> {
  return fetchJson<ToolSummary[]>("/tools");
}

export async function executeTool(toolName: string, args: Record<string, any>): Promise<any> {
  return fetchJson("/tools/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_name: toolName, arguments: args }),
  });
}

export async function streamAgent(
  prompt: string,
  onStep: (event: ToolStepEvent) => void,
  options?: { model?: string; enabledTools?: string[]; signal?: AbortSignal }
): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("ai_orchestrator_access_token") : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  const response = await fetch(`${baseUrl}/tools/agent/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      prompt,
      model: options?.model,
      enabled_tools: options?.enabledTools,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Agent stream failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.slice(6));
          onStep(parsed);
        } catch {
          // Fragmented json
        }
      }
    }
  }
}
