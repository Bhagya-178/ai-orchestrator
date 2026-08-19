import { Conversation } from "../types";

// Mock data initially
const mockConversations: Conversation[] = [
  { id: "1", title: "Explain FastAPI dependency injection", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "2", title: "What is RAG?", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "3", title: "Debug Python API", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "4", title: "Explain PostgreSQL indexing", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "5", title: "Qdrant vector search", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export async function getConversations(): Promise<Conversation[]> {
  // return fetch('http://localhost:8000/conversations').then(res => res.json());
  return new Promise(resolve => setTimeout(() => resolve([...mockConversations]), 500));
}

export async function createConversation(title: string = "New Conversation"): Promise<Conversation> {
  const newConv: Conversation = {
    id: Math.random().toString(36).substring(7),
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  mockConversations.unshift(newConv);
  return new Promise(resolve => setTimeout(() => resolve(newConv), 500));
}
