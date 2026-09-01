import { fetchApi } from "./client";

export async function getHealth(): Promise<boolean> {
  try {
    const res = await fetchApi("health", {
      signal: AbortSignal.timeout(5000)
    });
    return res.ok;
  } catch (error) {
    return false;
  }
}
