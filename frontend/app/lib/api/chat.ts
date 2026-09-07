import { fetchApi } from "./client";
import { ChatMessage, ToolStepEvent } from "../types";

export async function streamChat(
  message: string,
  sessionId: string,
  onChunk: (text: string) => void,
  onMetadata: (metadata: unknown) => void,
  useRag: boolean = true,
  intentOverride: string = "auto",
  effortLevel: string = "medium",
  signal?: AbortSignal,
  onToolStep?: (step: ToolStepEvent) => void
): Promise<void> {
  const response = await fetchApi("chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      message, 
      session_id: sessionId, 
      use_rag: useRag,
      intent_override: intentOverride === "auto" ? null : intentOverride,
      effort_level: effortLevel
    }),
    signal,
  });

  if (!response.body) {
    throw new Error("Response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let buffer = "";

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith("data: ")) {
          const dataStr = line.replace("data: ", "").trim();
          if (dataStr === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === "token") {
              onChunk(parsed.token);
            } else if (parsed.type === "tool_result" || parsed.type === "tool_start" || parsed.type === "thought") {
              onToolStep?.(parsed as ToolStepEvent);
            } else if (parsed.type === "done") {
              onMetadata(parsed);
            }
          } catch (err) {
            console.error("Error parsing JSON chunk:", err, line);
          }
        }
      }
    }
  }
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    const res = await fetchApi(`chat/${sessionId}/messages`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn("Could not load chat messages (backend starting up or unreachable):", err);
    return [];
  }
}

export async function getRecentPrompts(): Promise<string[]> {
  try {
    const res = await fetchApi("chat/recent-prompts");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
