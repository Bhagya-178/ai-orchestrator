import { fetchJson, fetchApi } from "./client";
import { WorkflowTemplate, WorkflowEvent } from "../types";

export interface AgentRoleInfo {
  id: string;
  title: string;
  description: string;
  allowed_tools: string[];
  default_model: string;
}

export async function getAgentRoles(): Promise<AgentRoleInfo[]> {
  return fetchJson<AgentRoleInfo[]>("/agents/roles");
}

export async function getAgentTemplates(): Promise<WorkflowTemplate[]> {
  return fetchJson<WorkflowTemplate[]>("/agents/templates");
}

export async function chatWithRole(
  role: string,
  prompt: string,
  context?: Record<string, any>,
  model?: string
): Promise<{ role: string; title: string; response: string }> {
  const res = await fetchApi("/agents/roles/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, prompt, context, model }),
  });
  if (!res.ok) {
    throw new Error(`Failed to chat with agent role: ${res.statusText}`);
  }
  return res.json();
}

export async function streamWorkflow(
  payload: {
    template_id?: string;
    custom_workflow?: any;
    input: string;
    model_override?: string;
  },
  onEvent: (event: WorkflowEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetchApi("/agents/workflows/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Workflow execution failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body reader available");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const chunk of lines) {
      const trimmed = chunk.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          const eventData: WorkflowEvent = JSON.parse(trimmed.slice(6));
          onEvent(eventData);
        } catch (e) {
          console.error("Error parsing workflow SSE event:", e);
        }
      }
    }
  }
}
