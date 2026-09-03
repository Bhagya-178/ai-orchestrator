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
  const res = await fetchApi("conversations", { method: "POST" });
  const data = await res.json();
  return {
    id: data.conversation_id,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function deleteConversation(sessionId: string): Promise<void> {
  await fetchApi(`conversations/${sessionId}`, {
    method: "DELETE",
  });
}

export async function getConversationMetrics(sessionId: string) {
  const res = await fetchApi(`conversations/${sessionId}/metrics`);
  return res.json();
}
