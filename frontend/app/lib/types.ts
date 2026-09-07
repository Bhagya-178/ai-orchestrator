export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";

export interface UploadedDocument {
  id: string;
  filename: string;
  fileSize: number;
  contentType: string;
  status: DocumentStatus;
  createdAt?: string;
}

export interface SourceCitation {
  label: string;
  page?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  latencyMs?: number;
  sources?: SourceCitation[];
  attachedDocument?: UploadedDocument;
  toolSteps?: ToolStepEvent[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  intent_override?: string;
  effort_level?: string;
  is_pinned?: boolean;
  system_prompt?: string;
}

export interface ConversationExportData {
  id: string;
  title: string;
  markdown: string;
  json_data: any;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  is_active: boolean;
  custom_instructions: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Artifact {
  id: string;
  title: string;
  type: "html" | "svg" | "react" | "mermaid" | "code" | "markdown";
  language: string;
  content: string;
}

export interface ChatMetrics {
  total_requests: number;
  average_latency_ms: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  average_tokens_per_second: number;
}

export interface MetricsResponse {
  session_id: string;
  metrics: ChatMetrics;
}

// --- Agent Tools & ReAct ---
export interface ToolSummary {
  name: string;
  description: string;
  risk_level: "safe" | "moderate" | "sensitive";
  timeout_seconds: number;
  parameters: Record<string, any>;
}

export interface ToolStepEvent {
  type: "thought" | "tool_start" | "tool_result" | "token" | "done" | "error";
  content?: string;
  tool?: string;
  input?: Record<string, any>;
  result?: any;
  elapsed_ms?: number;
  total_steps?: number;
  tools_used?: string[];
  message?: string;
}

// --- Model Context Protocol (MCP) ---
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface McpServerStatus {
  id: string;
  name: string;
  transport: string;
  connected: boolean;
  tools_count: number;
  tools: McpTool[];
  latency_ms?: number;
  error?: string;
}

// --- Prompt Engineering Studio ---
export interface PromptVariable {
  name: string;
  default: string | null;
  required: boolean;
}

export interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  system_prompt: string;
  user_template: string;
  variables: PromptVariable[];
  tags: string[];
  version: string;
  is_public: boolean;
  author_id?: string;
  created_at: string;
}

// --- Model Arena ---
export interface ArenaMetrics {
  model: string;
  real_model?: string;
  token_count: number;
  duration_ms: number;
  ttft_ms: number;
  tokens_per_second: number;
}

export interface ArenaBattleEvent {
  side?: "A" | "B";
  type: "token" | "metrics" | "error" | "done";
  token?: string;
  metrics?: ArenaMetrics;
  error?: string;
}

export interface LeaderboardEntry {
  model: string;
  battles: number;
  wins: number;
  losses: number;
  ties: number;
  win_rate: number;
}

// --- Multi-Tenant Workspaces & Audit Logs ---
export interface WorkspaceMember {
  user_id: string;
  email: string;
  full_name: string;
  role: "owner" | "admin" | "member" | "viewer";
  joined_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  owner_id: string;
  members?: WorkspaceMember[];
  created_at: string;
}

export interface AuditLog {
  id: number;
  workspace_id?: string;
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, any>;
  created_at: string;
}

// --- Analytics & Telemetry ---
export interface AnalyticsOverview {
  total_requests: number;
  total_tokens: number;
  tokens_in: number;
  tokens_out: number;
  total_messages: number;
  avg_latency_ms: number;
  estimated_cost_usd: number;
}

export interface ModelAnalytics {
  model: string;
  request_count: number;
  total_tokens: number;
  tokens_in: number;
  tokens_out: number;
  estimated_cost_usd: number;
}

export interface SystemTelemetry {
  cpu_percent: number;
  memory_total_gb: number;
  memory_used_gb: number;
  memory_percent: number;
  process_rss_mb: number;
  db_pool: {
    size: number;
    checkedin: number;
    checkedout: number;
    overflow: number;
  };
  timestamp: string;
}

// --- Hybrid RAG 2.0 ---
export interface KnowledgeCollection {
  id: string;
  name: string;
  description: string;
  color: string;
  document_ids: string[];
  created_at: string;
}

export interface HybridSearchResult {
  chunk_id: string;
  rrf_score: number;
  dense_rank?: number;
  sparse_rank?: number;
  text: string;
  metadata: Record<string, any>;
}

// --- Multi-Agent Workflows ---
export interface WorkflowNodeDef {
  id: string;
  name: string;
  role: "planner" | "researcher" | "coder" | "reviewer" | "critic";
  task?: string;
  depends_on: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes_count: number;
  nodes: WorkflowNodeDef[];
}

export interface WorkflowEvent {
  type: "workflow_start" | "wave_start" | "node_start" | "node_complete" | "node_error" | "workflow_complete" | "workflow_error";
  workflow_id?: string;
  workflow_name?: string;
  wave_index?: number;
  node_ids?: string[];
  node_id?: string;
  name?: string;
  role?: string;
  output?: string;
  duration_ms?: number;
  total_duration_ms?: number;
  error?: string;
  final_output?: string;
  all_outputs?: Record<string, string>;
}

// --- Knowledge Graph ---
export interface GraphNode {
  id: string;
  label: string;
  entity_type: "class" | "function" | "module" | "concept" | "api" | "technology";
  attributes: Record<string, any>;
  centrality: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface GraphData {
  total_graph_nodes: number;
  returned_nodes: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// --- Developer Platform: API Keys & Webhooks ---
export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface CreateApiKeyResult extends ApiKeyItem {
  raw_key: string;
}

export interface WebhookItem {
  id: string;
  url: string;
  secret: string;
  events: string[];
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface WebhookDeliveryItem {
  id: number;
  event_type: string;
  response_status?: number;
  response_body?: string;
  duration_ms: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

// --- LLM Evals & Benchmarks ---
export interface BenchmarkInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  test_case_count: number;
}

export interface EvalRunSummary {
  id: string;
  dataset_name: string;
  model_name: string;
  judge_model: string;
  total_test_cases: number;
  passed_cases: number;
  summary_scores: {
    pass_rate?: number;
    avg_faithfulness?: number;
    avg_relevance?: number;
    avg_hallucination?: number;
  };
  duration_seconds: number;
  created_at: string;
}

export interface EvalTestCaseResult {
  test_case_id: string;
  prompt: string;
  candidate_response: string;
  ground_truth: string;
  verdict: {
    faithfulness: number;
    relevance: number;
    hallucination_score: number;
    rubric_passed: number;
    total_rubric: number;
    passed: boolean;
    reasoning: string;
  };
}

export interface EvalRunDetail extends EvalRunSummary {
  detailed_results: EvalTestCaseResult[];
}

// --- Canvas Studio 2.0 ---
export type CanvasTab = "preview" | "code" | "console" | "diff";

export interface ConsoleMessage {
  id: string;
  type: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: string;
}



