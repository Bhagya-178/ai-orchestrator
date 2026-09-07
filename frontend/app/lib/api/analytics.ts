import { fetchJson } from "./client";
import { AnalyticsOverview, ModelAnalytics, SystemTelemetry } from "../types";

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return fetchJson<AnalyticsOverview>("/analytics/overview");
}

export async function getModelAnalytics(): Promise<ModelAnalytics[]> {
  return fetchJson<ModelAnalytics[]>("/analytics/models");
}

export async function getSystemTelemetry(): Promise<SystemTelemetry> {
  return fetchJson<SystemTelemetry>("/analytics/system");
}
