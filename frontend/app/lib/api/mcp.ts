import { fetchApi, fetchJson } from "./client";
import { McpServerStatus } from "../types";

export async function listMcpServers(): Promise<McpServerStatus[]> {
  return fetchJson<McpServerStatus[]>("/mcp/servers");
}

export async function addMcpServer(data: {
  name: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
}): Promise<McpServerStatus> {
  return fetchJson<McpServerStatus>("/mcp/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function removeMcpServer(serverId: string): Promise<void> {
  await fetchApi(`/mcp/servers/${serverId}`, {
    method: "DELETE",
  });
}

export async function reconnectMcpServer(serverId: string): Promise<{ connected: boolean }> {
  return fetchJson<{ connected: boolean }>(`/mcp/servers/${serverId}/reconnect`, {
    method: "POST",
  });
}

export async function callMcpTool(serverId: string, toolName: string, args: Record<string, any>): Promise<any> {
  return fetchJson("/mcp/tools/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ server_id: serverId, tool_name: toolName, arguments: args }),
  });
}
