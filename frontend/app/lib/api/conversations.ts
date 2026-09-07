import { Conversation } from "../types";
import { fetchApi } from "./client";

export async function getConversations(): Promise<Conversation[]> {
  try {
    const res = await fetchApi("conversations");
    return await res.json();
  } catch (err) {
    console.warn("Backend not reachable or still starting:", err);
    return [];
  }
}

export async function createConversation(title: string = "New Conversation"): Promise<Conversation> {
  const res = await fetchApi("conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  return {
    id: data.conversation_id,
    title: data.title || title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function deleteConversation(sessionId: string): Promise<void> {
  await fetchApi(`conversations/${sessionId}`, {
    method: "DELETE",
  });
}

export async function getConversation(sessionId: string): Promise<Conversation | null> {
  try {
    const res = await fetchApi(`conversations/${sessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch conversation details:", err);
    return null;
  }
}

export async function updateConversationSettings(
  sessionId: string,
  settings: {
    intent_override?: string;
    effort_level?: string;
    title?: string;
    is_pinned?: boolean;
    system_prompt?: string;
  }
): Promise<Conversation | null> {
  try {
    const res = await fetchApi(`conversations/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Failed to update conversation settings:", err);
    return null;
  }
}

export async function exportConversation(sessionId: string) {
  try {
    const res = await fetchApi(`conversations/${sessionId}/export`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Failed to export conversation:", err);
    return null;
  }
}

export async function getConversationMetrics(sessionId: string) {
  const res = await fetchApi(`conversations/${sessionId}/metrics`);
  return res.json();
}
