import { fetchJson } from "./client";

export interface CustomModel {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  api_base?: string;
  is_active: boolean;
  masked_key: string;
  created_at?: string;
}

export interface CreateCustomModelPayload {
  name: string;
  provider: string;
  model_id: string;
  api_key: string;
  api_base?: string;
  is_active?: boolean;
}

export interface UpdateCustomModelPayload {
  name?: string;
  provider?: string;
  model_id?: string;
  api_key?: string;
  api_base?: string;
  is_active?: boolean;
}

export interface TestConnectionPayload {
  provider: string;
  model_id: string;
  api_key?: string;
  api_base?: string;
  saved_model_id?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  latency_ms?: number;
  message?: string;
  error?: string;
}

export async function listCustomModels(): Promise<CustomModel[]> {
  try {
    const res = await fetchJson<{ models: CustomModel[] }>("/api/custom-models");
    return res?.models || [];
  } catch (err) {
    console.warn("Failed to load custom models:", err);
    return [];
  }
}

export async function createCustomModel(payload: CreateCustomModelPayload): Promise<CustomModel> {
  return await fetchJson<CustomModel>("/api/custom-models", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomModel(
  id: string,
  payload: UpdateCustomModelPayload
): Promise<CustomModel> {
  return await fetchJson<CustomModel>(`/api/custom-models/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCustomModel(id: string): Promise<{ status: string; id: string }> {
  return await fetchJson<{ status: string; id: string }>(`/api/custom-models/${id}`, {
    method: "DELETE",
  });
}

export async function testCustomModel(
  payload: TestConnectionPayload
): Promise<TestConnectionResponse> {
  return await fetchJson<TestConnectionResponse>("/api/custom-models/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
