import { fetchJson } from "./client";
import { BenchmarkInfo, EvalRunSummary, EvalRunDetail } from "../types";

export async function listBenchmarks(): Promise<BenchmarkInfo[]> {
  return fetchJson<BenchmarkInfo[]>("/evals/benchmarks");
}

export async function runBenchmark(
  datasetId: string,
  targetModel: string = "qwen2.5:1.5b",
  judgeModel: string = "qwen3:8b"
): Promise<EvalRunDetail> {
  return fetchJson<EvalRunDetail>("/evals/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: datasetId,
      target_model: targetModel,
      judge_model: judgeModel,
    }),
  });
}

export async function listEvalHistory(): Promise<EvalRunSummary[]> {
  return fetchJson<EvalRunSummary[]>("/evals/history");
}

export async function getEvalDetail(runId: string): Promise<EvalRunDetail> {
  return fetchJson<EvalRunDetail>(`/evals/history/${encodeURIComponent(runId)}`);
}
