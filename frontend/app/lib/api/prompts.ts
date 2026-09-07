import { fetchApi, fetchJson } from "./client";
import { PromptTemplate } from "../types";

export async function listPromptTemplates(params?: { category?: string; search?: string }): Promise<PromptTemplate[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return fetchJson<PromptTemplate[]>(`/prompts${qs ? `?${qs}` : ""}`);
}

export async function getPromptTemplate(templateId: string): Promise<PromptTemplate> {
  return fetchJson<PromptTemplate>(`/prompts/${templateId}`);
}

export async function createPromptTemplate(data: {
  title: string;
  category?: string;
  description?: string;
  system_prompt?: string;
  user_template: string;
  tags?: string[];
  is_public?: boolean;
}): Promise<PromptTemplate> {
  return fetchJson<PromptTemplate>("/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function renderPromptTemplate(
  templateId: string,
  variables: Record<string, any>
): Promise<{ template_id: string; system_prompt: string; rendered_prompt: string }> {
  return fetchJson<{ template_id: string; system_prompt: string; rendered_prompt: string }>(
    `/prompts/${templateId}/render`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables }),
    }
  );
}

export async function deletePromptTemplate(templateId: string): Promise<void> {
  await fetchApi(`/prompts/${templateId}`, {
    method: "DELETE",
  });
}
