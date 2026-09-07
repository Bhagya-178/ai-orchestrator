import { fetchJson, fetchApi } from "./client";
import { ArenaBattleEvent, LeaderboardEntry } from "../types";

export async function getArenaLeaderboard(): Promise<LeaderboardEntry[]> {
  return fetchJson<LeaderboardEntry[]>("/arena/leaderboard");
}

export async function recordArenaVote(data: {
  prompt: string;
  model_a: string;
  model_b: string;
  winner: "A" | "B" | "tie" | "both_bad";
}): Promise<any> {
  return fetchJson("/arena/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function streamArenaBattle(
  data: {
    prompt: string;
    model_a: string;
    model_b: string;
    system_prompt?: string;
    blind?: boolean;
  },
  onEvent: (event: ArenaBattleEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetchApi("/arena/battle/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal,
  });

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.slice(6));
          onEvent(parsed);
        } catch {
          // Fragment
        }
      }
    }
  }
}
