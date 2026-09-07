import { fetchJson } from "./client";
import { GraphData } from "../types";

export async function exploreGraph(types?: string, maxNodes: number = 120): Promise<GraphData> {
  const params = new URLSearchParams();
  if (types) params.append("types", types);
  params.append("max_nodes", maxNodes.toString());

  return fetchJson<GraphData>(`/rag/v2/graph/explore?${params.toString()}`);
}

export async function getNodeNeighborhood(nodeId: string, radius: number = 1): Promise<any> {
  return fetchJson(`/rag/v2/graph/neighborhood/${encodeURIComponent(nodeId)}?radius=${radius}`);
}

export async function findEntityPath(sourceId: string, targetId: string): Promise<{
  source: string;
  target: string;
  path: string[];
  length: number;
}> {
  return fetchJson(`/rag/v2/graph/path?source_id=${encodeURIComponent(sourceId)}&target_id=${encodeURIComponent(targetId)}`);
}

export async function indexCodeIntoGraph(code: string, filename: string): Promise<any> {
  return fetchJson("/rag/v2/graph/index-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, filename }),
  });
}

export async function indexTextIntoGraph(text: string, sourceDoc: string): Promise<any> {
  return fetchJson("/rag/v2/graph/index-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source_doc: sourceDoc }),
  });
}
