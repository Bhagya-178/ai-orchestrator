import { fetchJson } from "./client";
import { Workspace, AuditLog } from "../types";

export async function listWorkspaces(): Promise<Workspace[]> {
  return fetchJson<Workspace[]>("/workspaces");
}

export async function createWorkspace(data: { name: string; description?: string }): Promise<Workspace> {
  return fetchJson<Workspace>("/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  return fetchJson<Workspace>(`/workspaces/${workspaceId}`);
}

export async function addWorkspaceMember(
  workspaceId: string,
  data: { email: string; role: "admin" | "member" | "viewer" }
): Promise<any> {
  return fetchJson(`/workspaces/${workspaceId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getWorkspaceAuditLogs(workspaceId: string, limit = 50): Promise<AuditLog[]> {
  return fetchJson<AuditLog[]>(`/workspaces/${workspaceId}/audit-logs?limit=${limit}`);
}
