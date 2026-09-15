"""
Specialized Agent Roles for Multi-Agent Collaboration.

Defines role personalities, system directives, allowed tool sets, and execution logic:
- PlannerAgent: Strategic decomposition and dependency planning
- ResearcherAgent: Evidence retrieval, document search, and web scraping
- CoderAgent: Production code generation, syntax correctness, and modular design
- ReviewerAgent: Code auditing, security vulnerability assessment, and quality check
- CriticAgent: Conflict synthesis, validation against requirements, and scoring
"""

import asyncio
import json
import logging
import re
import time
from collections.abc import Awaitable, Callable
from typing import Any, Optional
from app.ollama_client import ollama
from app.tools.registry import tool_registry

logger = logging.getLogger(__name__)

# Global GPU Lock: Guarantees that across all workflows, loops, and agents,
# strictly ONE agent model inference executes on the GPU at any single moment.
# Prevents GPU concurrency thrashing, CUDA Out-Of-Memory errors, and VRAM context collision.
_agent_gpu_lock = asyncio.Lock()


class AgentRole:
    """Definition and execution runtime for an autonomous agent role."""

    def __init__(
        self,
        id: str,
        title: str,
        description: str,
        system_prompt: str,
        allowed_tools: list[str],
        default_model: str = "qwen2.5-coder:7b",
        temperature: float = 0.2,
    ):
        self.id = id
        self.title = title
        self.description = description
        self.system_prompt = system_prompt
        self.allowed_tools = allowed_tools
        self.default_model = default_model
        self.temperature = temperature

    async def execute(
        self,
        task: str,
        context: Optional[dict[str, Any]] = None,
        model_override: Optional[str] = None,
        max_tokens: Optional[int] = None,
        event_callback: Optional[Callable[[dict[str, Any]], Awaitable[None]]] = None,
    ) -> str:
        """
        Execute a prompt under this agent role's persona, context, and external tools.
        Uses full context window (num_ctx: 16384) and full generation capacity (num_predict: 8192)
        so code and tools are never cut off prematurely.
        """
        context_block = ""
        if context:
            context_block = "\n\n### Prior Context & Upstream Outputs:\n"
            for k, v in context.items():
                context_block += f"\n--- [{k}] ---\n{str(v).strip()}\n"

        tool_block = ""
        available_tools = []
        if self.allowed_tools:
            for t_name in self.allowed_tools:
                t = tool_registry.get(t_name)
                if t:
                    available_tools.append(t)

        if available_tools:
            tool_lines = []
            for t in available_tools:
                props = t.parameters_schema.get("properties", {})
                props_summary = ", ".join(f"{k}: {v.get('type', 'any')}" for k, v in props.items())
                tool_lines.append(f"- {t.name}({props_summary}): {t.description}")
            tool_block = (
                "\n\n### Available Tools:\n"
                + "\n".join(tool_lines)
                + "\n\n### Strict Tool Execution Guidelines:\n"
                "- ONLY call a tool if strictly necessary (e.g. evaluating a calculation or running code).\n"
                "- NEVER invent file names or call file_system to search for non-existent specifications (e.g. 'user_requirements.txt' or 'architecture_design.txt'). If architecting or implementing a feature, generate the complete solution from first principles.\n"
                "- When using tools, format strictly as:\n"
                "Action: <tool_name>\n"
                "Action Input: <valid_json_dict>\n"
                "Wait for Observation before continuing. Otherwise, provide your complete response directly without calling tools."
            )

        current_prompt = f"{self.system_prompt}{tool_block}\n{context_block}\n\n### Current Task:\n{task}"
        if model_override and not model_override.startswith("workflow:"):
            target_model = model_override
        else:
            target_model = self.default_model

        try:
            gen_options: dict[str, Any] = {
                "temperature": self.temperature,
                "num_ctx": 16384,
                "num_predict": max_tokens if max_tokens else 8192,
            }

            max_tool_iters = 2 if available_tools else 1
            final_response = ""

            for it in range(max_tool_iters):
                async with _agent_gpu_lock:
                    response = await ollama.generate(
                        prompt=current_prompt,
                        model=target_model,
                        options=gen_options,
                    )
                if isinstance(response, dict):
                    response = response.get("response", "")
                response_text = str(response).strip()
                final_response = response_text

                if not available_tools:
                    break

                # Check if an Action was requested
                action_match = re.search(r"Action:\s*([a-zA-Z0-9_\-]+)", response_text)
                action_input_match = re.search(r"Action Input:\s*(\{.*?\}|\[.*?\]|[^\n]+)", response_text, re.DOTALL)

                if not action_match:
                    break

                raw_tool = action_match.group(1).strip()
                tool_obj = tool_registry.get(raw_tool)
                if not tool_obj or raw_tool not in self.allowed_tools:
                    clean = response_text.split("Action:")[0].strip()
                    final_response = clean if clean else response_text
                    break

                raw_args = action_input_match.group(1).strip() if action_input_match else "{}"
                if "```" in raw_args:
                    raw_args = re.sub(r"```(?:json)?|```", "", raw_args).strip()
                try:
                    tool_args = json.loads(raw_args)
                except Exception:
                    if raw_tool in ("calculator", "math_tool"):
                        tool_args = {"expression": raw_args.strip("\"'")}
                    elif raw_tool in ("code_runner", "python_runner"):
                        tool_args = {"code": raw_args.strip("\"'")}
                    elif raw_tool in ("web_search", "web_scraper"):
                        tool_args = {"query": raw_args.strip("\"'")}
                    elif raw_tool == "file_system":
                        tool_args = {"action": "list_dir", "path": raw_args.strip("\"'")}
                    else:
                        tool_args = {}

                t0 = time.perf_counter()
                if event_callback:
                    try:
                        await event_callback({
                            "type": "tool_start",
                            "tool": raw_tool,
                            "input": tool_args,
                        })
                    except Exception as cb_err:
                        logger.debug(f"Event callback tool_start error: {cb_err}")

                try:
                    tool_res = await tool_obj.execute(**tool_args)
                except Exception as tool_err:
                    tool_res = f"Tool execution failed: {tool_err}"
                dur_ms = round((time.perf_counter() - t0) * 1000, 2)

                if event_callback:
                    try:
                        await event_callback({
                            "type": "tool_result",
                            "tool": raw_tool,
                            "result": tool_res,
                            "elapsed_ms": dur_ms,
                        })
                    except Exception as cb_err:
                        logger.debug(f"Event callback tool_result error: {cb_err}")

                obs_str = str(tool_res)
                if "not found" in obs_str.lower() or "error" in obs_str.lower():
                    obs_str += "\n[SYSTEM DIRECTIVE: The file or target was not found. Do NOT search for other files or call file_system. Directly produce the complete technical deliverable.]"

                if it == max_tool_iters - 1:
                    # Final tool iteration reached: force model to produce final answer without emitting more actions
                    current_prompt += f"\n\n{response_text}\n\nObservation: {obs_str}\n\nProduce your COMPLETE production deliverable now. Do NOT output any Action or tool calls:"
                    async with _agent_gpu_lock:
                        final_res = await ollama.generate(
                            prompt=current_prompt,
                            model=target_model,
                            options=gen_options,
                        )
                        if isinstance(final_res, dict):
                            final_res = final_res.get("response", "")
                        final_response = str(final_res).strip()
                    break
                else:
                    current_prompt += f"\n\n{response_text}\n\nObservation: {obs_str}\n\nDeliverable after tool observation:"

            # Clean any dangling unexecuted Action if present
            if "Action:" in final_response:
                clean = final_response.split("Action:")[0].strip()
                if len(clean) > 80:
                    final_response = clean

            return final_response
        except Exception as ex:
            logger.error(f"Error executing agent role {self.id}: {ex}")
            return f"[{self.title} Execution Fallback]: Unable to complete turn ({ex}). Task: {task[:80]}"


ROLE_PLANNER = AgentRole(
    id="planner",
    title="Strategic Systems Architect",
    description="Deconstructs complex systems into production-grade architectures, data schemas, and API contracts.",
    system_prompt=(
        "You are an elite Enterprise Systems Architect (equivalent to a Principal Architect at Google/Anthropic).\n"
        "Your objective is to design comprehensive, production-grade systems architectures from first principles.\n\n"
        "### REASONING & OUTPUT PROTOCOL:\n"
        "1. Always begin with a structured `<thinking>` block analyzing:\n"
        "   - Core domain entities, relationships, cardinality, and state transitions.\n"
        "   - Concurrency, idempotency, data integrity, and caching strategies.\n"
        "   - Security trust boundaries, authentication (JWT/OAuth2), and authorization (RBAC).\n"
        "   - Potential failure modes, bottlenecks, and mitigations.\n"
        "2. Deliver a polished, publication-quality Architecture Document with:\n"
        "   - System Topology & Data Flow diagram (ASCII or clear component map).\n"
        "   - Relational / Document Database Schema with complete tables, foreign keys, and indexes.\n"
        "   - Strict REST / GraphQL API contracts (HTTP verbs, paths, request/response models).\n"
        "   - Frontend State & Component Hierarchy.\n"
        "   - Edge Cases & Resilience Strategy (rate limiting, retry policies, transaction rollbacks).\n\n"
        "### STRICT NEGATIVE CONSTRAINTS:\n"
        "- NEVER invent or search for imaginary local files (e.g. 'user_requirements.txt'). Design the full system directly from the user's objective.\n"
        "- NEVER provide shallow tutorial outlines. Provide deep, enterprise-ready specifications."
    ),
    allowed_tools=["datetime"],
    default_model="qwen2.5-coder:7b",
    temperature=0.2,
)

ROLE_RESEARCHER = AgentRole(
    id="researcher",
    title="Deep Researcher",
    description="Conducts grounded retrieval across documents, web, and technical indexes.",
    system_prompt=(
        "You are an expert Research Analyst. Your job is to gather accurate facts, citations, "
        "and empirical details. Verify every assertion against provided context or external references. "
        "Highlight uncertainties and cite specific sources clearly.\n"
        "CRITICAL: Do NOT invent file paths. Use web_search or web_scraper for real-world research."
    ),
    allowed_tools=["web_search", "web_scraper"],
    default_model="qwen2.5-coder:7b",
    temperature=0.2,
)

ROLE_CODER = AgentRole(
    id="coder",
    title="Production Software Engineer",
    description="Implements robust, idiomatic, typed, and secure production code without placeholders or shortcuts.",
    system_prompt=(
        "You are a Senior Principal Software Engineer (level of a frontier coding model like Claude 3.5 Sonnet).\n"
        "You write production-grade, self-contained, enterprise-ready software. You NEVER write toy code, placeholders, or broken tutorials.\n\n"
        "### REASONING & EXECUTION PROTOCOL:\n"
        "Before writing code, conduct a concise `<thinking>` analysis:\n"
        "1. Architectural Alignment: How do the models, schemas, and endpoints connect?\n"
        "2. Security & Invariants: Password hashing, token validation, input sanitization, and SQL injection prevention.\n"
        "3. React Lifecycle (if frontend): Ensure all network mutations are bound to explicit form submit handlers.\n\n"
        "### MANDATORY PRODUCTION STANDARDS:\n"
        "**For Python / FastAPI:**\n"
        "- Modern Async First: Use SQLAlchemy 2.0 Async (`AsyncSession`, `select()`, `await db.execute()`). NEVER use synchronous blocking `db.query()` in async routes.\n"
        "- Real Cryptography: ALWAYS use `passlib.context.CryptContext(schemes=['bcrypt'])` or `argon2` for password hashing. NEVER use fake hashes (e.g. `password + 'fake'`) or plain text.\n"
        "- Auth & Identity: ALWAYS inject identity via FastAPI dependency injection (`Depends(get_current_user)`). NEVER hardcode user IDs (e.g. `user_id = 1`).\n"
        "- Pydantic v2 Schemas: Explicit typing, validation rules, field definitions, and `model_config = ConfigDict(from_attributes=True)`.\n"
        "- Complete Manifest: Provide a complete `requirements.txt` with pinned versions for all imported libraries.\n\n"
        "**For React / TypeScript:**\n"
        "- Modern React 18+ / Next.js: Use functional components, explicit TypeScript interfaces, and `createRoot`.\n"
        "- Zero Keystroke API Spam: NEVER place mutating requests (`POST`, `PUT`, `DELETE`) inside a `useEffect` dependency array where user typing triggers repeated calls! ALL mutations MUST be triggered by explicit form `onSubmit` or button `onClick` event handlers.\n"
        "- Complete Manifest: Provide a valid `package.json` with ALL imported libraries (e.g. `axios`, `lucide-react`) listed in `dependencies`.\n"
        "- Resilient UI: Include loading spinners, error alerts, disabled button states during network requests, and input resets.\n\n"
        "### STRICT NEGATIVE CONSTRAINTS:\n"
        "- NEVER output placeholders like `// TODO`, `# Add logic here`, or `pass`.\n"
        "- NEVER look for files on disk (like 'architecture_design.txt') unless the user explicitly provided an existing path."
    ),
    allowed_tools=["code_runner", "math_tool"],
    default_model="qwen2.5-coder:7b",
    temperature=0.1,
)

ROLE_REVIEWER = AgentRole(
    id="reviewer",
    title="Staff Security & QA Auditor",
    description="Conducts rigorous OWASP, CWE, concurrency, and architecture audits with concrete line-level remediation.",
    system_prompt=(
        "You are a Staff Security Auditor and QA Architect (level of a top-tier cybersecurity specialist).\n"
        "Your mission is to rigorously audit code and architecture for vulnerabilities, anti-patterns, and reliability hazards.\n\n"
        "### AUDIT CHECKLIST:\n"
        "1. Security & OWASP Top 10: Check for broken authentication, hardcoded IDs, weak hashing, injection (SQLi/XSS/Command), IDOR, and sensitive data leakage.\n"
        "2. Concurrency & Race Conditions: Database transaction isolation, inventory overselling, atomic locking, and session integrity.\n"
        "3. React Anti-Patterns: Event handler binding, dependency arrays causing API loops, memory leaks, and missing dependencies.\n"
        "4. Resilience & Error Handling: HTTP status codes, defensive guards, input validation, and graceful degradation.\n\n"
        "Output an authoritative Security & Quality Clearance Report with: Vulnerability Severity (Critical/High/Medium/Low), Exact Root Cause, and Complete Code Remediation Diff/Snippet."
    ),
    allowed_tools=["code_runner", "sql_tool"],
    default_model="qwen2.5-coder:7b",
    temperature=0.1,
)

ROLE_CRITIC = AgentRole(
    id="critic",
    title="Executive Release Architect",
    description="Synthesizes multi-agent outputs into a unified, production-ready release package and deployment guide.",
    system_prompt=(
        "You are an Executive Technology Evaluator and Release Architect.\n"
        "Your job is to synthesize upstream multi-agent deliverables (Architecture Plan, Backend Code, Frontend Code, Security Audit) into a cohesive, production-ready Release Package.\n\n"
        "### DELIVERABLE FORMAT:\n"
        "1. Executive Summary & Verification Matrix (Completeness 1-10, Security 1-10, Production Readiness 1-10).\n"
        "2. Unified Architecture & Data Flow Overview.\n"
        "3. Production Deployment & Setup Checklist (Docker commands, environment variables, DB migrations).\n"
        "4. Critical Production Caveats & Next Steps.\n\n"
        "Do NOT repeat raw code blocks verbatim if they are already presented in prior agent sections. Focus on integration, coordination, validation, and production runbooks."
    ),
    allowed_tools=[],
    default_model="qwen2.5-coder:7b",
    temperature=0.2,
)

AGENT_REGISTRY: dict[str, AgentRole] = {
    "planner": ROLE_PLANNER,
    "researcher": ROLE_RESEARCHER,
    "coder": ROLE_CODER,
    "reviewer": ROLE_REVIEWER,
    "critic": ROLE_CRITIC,
}
