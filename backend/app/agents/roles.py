"""
Specialized Agent Roles for Multi-Agent Collaboration.

Defines role personalities, system directives, allowed tool sets, and execution logic:
- PlannerAgent: Strategic decomposition and dependency planning
- ResearcherAgent: Evidence retrieval, document search, and web scraping
- CoderAgent: Production code generation, syntax correctness, and modular design
- ReviewerAgent: Code auditing, security vulnerability assessment, and quality check
- CriticAgent: Conflict synthesis, validation against requirements, and scoring
"""

from typing import Any, Optional
import logging
from app.ollama_client import ollama

logger = logging.getLogger(__name__)


class AgentRole:
    """Definition and execution runtime for an autonomous agent role."""

    def __init__(
        self,
        id: str,
        title: str,
        description: str,
        system_prompt: str,
        allowed_tools: list[str],
        default_model: str = "qwen2.5:1.5b",
        temperature: float = 0.3,
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
    ) -> str:
        """Execute a prompt under this agent role's persona and context."""
        context_block = ""
        if context:
            context_block = "\n\n### Prior Context & Upstream Outputs:\n"
            for k, v in context.items():
                context_block += f"\n--- [{k}] ---\n{str(v).strip()}\n"

        prompt = f"{self.system_prompt}\n{context_block}\n\n### Current Task:\n{task}"
        if model_override and not model_override.startswith("workflow:"):
            target_model = model_override
        else:
            target_model = self.default_model

        try:
            gen_options: dict[str, Any] = {"temperature": self.temperature}
            if max_tokens:
                gen_options["num_predict"] = max_tokens

            response = await ollama.generate(
                prompt=prompt,
                model=target_model,
                options=gen_options,
            )
            if isinstance(response, dict):
                response = response.get("response", "")
            return str(response).strip()
        except Exception as ex:
            logger.error(f"Error executing agent role {self.id}: {ex}")
            return f"[{self.title} Execution Fallback]: Unable to complete turn ({ex}). Task: {task[:80]}"


ROLE_PLANNER = AgentRole(
    id="planner",
    title="Strategic Planner",
    description="Deconstructs complex objectives into discrete, dependency-ordered tasks.",
    system_prompt=(
        "You are an elite Lead Architect and Systems Planner. Your objective is to deconstruct "
        "complex technical or research problems into clear, sequential and parallel phases. "
        "Output structured plans with milestones, inputs, outputs, edge cases, and risk factors."
    ),
    allowed_tools=["file_system", "datetime"],
    default_model="qwen3:8b",
    temperature=0.2,
)

ROLE_RESEARCHER = AgentRole(
    id="researcher",
    title="Deep Researcher",
    description="Conducts grounded retrieval across documents, web, and technical indexes.",
    system_prompt=(
        "You are an expert Research Analyst. Your job is to gather accurate facts, citations, "
        "and empirical details. Verify every assertion against provided context or external references. "
        "Highlight uncertainties and cite specific sources clearly."
    ),
    allowed_tools=["web_search", "web_scraper", "file_system"],
    default_model="qwen2.5:1.5b",
    temperature=0.2,
)

ROLE_CODER = AgentRole(
    id="coder",
    title="Production Coder",
    description="Implements robust, strongly typed code, tests, and configuration files.",
    system_prompt=(
        "You are a Senior Principal Software Engineer. Write clean, idiomatic, robust, and strongly "
        "typed code following production standards. Always include error handling, defensive guards, "
        "and clear docstrings. Ensure zero compilation warnings."
    ),
    allowed_tools=["code_runner", "file_system", "math_tool"],
    default_model="qwen3:8b",
    temperature=0.1,
)

ROLE_REVIEWER = AgentRole(
    id="reviewer",
    title="Security & Quality Reviewer",
    description="Audits code, architecture, and logic for vulnerabilities, performance, and style.",
    system_prompt=(
        "You are a Staff Security Auditor and QA Architect. Scrutinize the input code and architecture "
        "for security vulnerabilities (SQLi, path traversal, CSRF, authentication bypass, data leaks), "
        "race conditions, memory leaks, and performance bottlenecks. Provide actionable fix recommendations."
    ),
    allowed_tools=["sql_tool", "file_system"],
    default_model="qwen3:8b",
    temperature=0.1,
)

ROLE_CRITIC = AgentRole(
    id="critic",
    title="Synthesis Critic",
    description="Synthesizes diverse agent outputs into cohesive final deliverables with scoring.",
    system_prompt=(
        "You are an Executive Technology Evaluator and Critic. Your goal is to synthesize the work of "
        "planners, researchers, and coders into a polished final deliverable. Score the result on "
        "Completeness (1-10), Correctness (1-10), and Robustness (1-10). Identify any remaining caveats."
    ),
    allowed_tools=[],
    default_model="qwen3:8b",
    temperature=0.2,
)

AGENT_REGISTRY: dict[str, AgentRole] = {
    "planner": ROLE_PLANNER,
    "researcher": ROLE_RESEARCHER,
    "coder": ROLE_CODER,
    "reviewer": ROLE_REVIEWER,
    "critic": ROLE_CRITIC,
}
