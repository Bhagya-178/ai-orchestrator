import { fetchJson } from "./client";
import { KnowledgeCollection, HybridSearchResult } from "../types";

export async function performHybridSearch(data: {
  query: string;
  limit?: number;
  collection_id?: string;
  session_id?: string;
}): Promise<{ query: string; total_hits: number; results: HybridSearchResult[] }> {
  return fetchJson<{ query: string; total_hits: number; results: HybridSearchResult[] }>(
    "/rag/v2/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
}

export async function listKnowledgeCollections(): Promise<KnowledgeCollection[]> {
  return fetchJson<KnowledgeCollection[]>("/rag/v2/collections");
}

export async function createKnowledgeCollection(data: {
  name: string;
  description?: string;
  color?: string;
}): Promise<KnowledgeCollection> {
  return fetchJson<KnowledgeCollection>("/rag/v2/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function inspectDocumentChunks(documentId: string): Promise<{
  document_id: string;
  total_chunks: number;
  chunks: any[];
}> {
  return fetchJson<{
    document_id: string;
    total_chunks: number;
    chunks: any[];
  }>(`/rag/v2/documents/${documentId}/chunks`);
}
