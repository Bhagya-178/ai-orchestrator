import { fetchJson } from "./client";
import {
  ApiKeyItem,
  CreateApiKeyResult,
  WebhookItem,
  WebhookDeliveryItem,
} from "../types";

export async function getAvailableScopes(): Promise<string[]> {
  const data = await fetchJson<{ scopes: string[] }>("/auth/api-keys/scopes");
  return data.scopes;
}

export async function listApiKeys(): Promise<ApiKeyItem[]> {
  return fetchJson<ApiKeyItem[]>("/auth/api-keys");
}

export async function createApiKey(payload: {
  name: string;
  scopes: string[];
  prefix?: string;
  expires_in_days?: number;
}): Promise<CreateApiKeyResult> {
  return fetchJson<CreateApiKeyResult>("/auth/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await fetchJson(`/auth/api-keys/${keyId}`, {
    method: "DELETE",
  });
}

export async function getSupportedWebhookEvents(): Promise<string[]> {
  const data = await fetchJson<{ events: string[] }>("/webhooks/events");
  return data.events;
}

export async function listWebhooks(): Promise<WebhookItem[]> {
  return fetchJson<WebhookItem[]>("/webhooks");
}

export async function createWebhook(payload: {
  url: string;
  events: string[];
  description?: string;
}): Promise<WebhookItem> {
  return fetchJson<WebhookItem>("/webhooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  await fetchJson(`/webhooks/${webhookId}`, {
    method: "DELETE",
  });
}

export async function testWebhook(webhookId: string): Promise<any> {
  return fetchJson(`/webhooks/${webhookId}/test`, {
    method: "POST",
  });
}

export async function getWebhookDeliveries(webhookId: string): Promise<WebhookDeliveryItem[]> {
  return fetchJson<WebhookDeliveryItem[]>(`/webhooks/${webhookId}/deliveries`);
}
