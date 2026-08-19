import { Conversation } from "../types";

const API_BASE_URL = "http://127.0.0.1:8000";

export async function getConversations(): Promise<Conversation[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/conversations`, {
      cache: 'no-store'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("Failed to load conversations", err);
  }
  return [];
}

export async function createConversation(title: string = "New Conversation"): Promise<Conversation> {
  const res = await fetch(`${API_BASE_URL}/conversations`, { method: "POST" });
  if (res.ok) {
    const data = await res.json();
    return {
      id: data.conversation_id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  throw new Error("Failed to create conversation");
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${API_BASE_URL}/conversations/${id}`, { method: "DELETE" });
}
