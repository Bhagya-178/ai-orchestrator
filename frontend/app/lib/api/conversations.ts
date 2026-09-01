import { Conversation } from "../types";
import { fetchApi } from "./client";

export async function getConversations(): Promise<Conversation[]> {
  const res = await fetchApi("conversations");
  return res.json();
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

export async function deleteConversation(id: string): Promise<void> {
  await fetchApi(`conversations/${id}`, { method: "DELETE" });
}
