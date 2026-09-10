"""
Curated Multi-Agent DAG Workflow Templates.

Provides ready-to-execute workflows with optimal agent collaboration patterns.
"""

from app.agents.engine import WorkflowDefinition, WorkflowNode

TEMPLATES: list[WorkflowDefinition] = [
    WorkflowDefinition(
        id="fullstack_feature",
        name="Full-Stack Production Feature",
        description="Deconstructs a user story, develops backend and frontend concurrently, performs security audit, and synthesizes final artifact.",
        nodes=[
            WorkflowNode(
                id="architect_plan",
                name="Architecture & API Specification",
                role="planner",
                task="Analyze the user requirement: '{{input}}'. Produce an architectural breakdown, data schemas, API contracts, and edge cases.",
                depends_on=[],
            ),
            WorkflowNode(
                id="backend_implementation",
                name="Backend Engine & DB Models",
                role="coder",
                task="Based on the specification:\n{{architect_plan.output}}\nWrite the FastAPI routes, SQLAlchemy models, and service logic.",
                depends_on=["architect_plan"],
            ),
            WorkflowNode(
                id="frontend_implementation",
                name="Next.js React UI & Client",
                role="coder",
                task="Based on the specification:\n{{architect_plan.output}}\nWrite the React TypeScript component, state management, and API client integration.",
                depends_on=["architect_plan"],
            ),
            WorkflowNode(
                id="security_qa_review",
                name="Security & Edge Case Audit",
                role="reviewer",
                task="Audit both backend and frontend implementations for SQLi, XSS, race conditions, and error handling:\nBackend:\n{{backend_implementation.output}}\n\nFrontend:\n{{frontend_implementation.output}}",
                depends_on=["backend_implementation", "frontend_implementation"],
            ),
            WorkflowNode(
                id="final_delivery_synthesis",
                name="Synthesis & Release Package",
                role="critic",
                task="Synthesize the complete feature deliverable into a unified documentation and release artifact:\nReviewer Notes:\n{{security_qa_review.output}}",
                depends_on=["security_qa_review"],
            ),
        ],
    ),
    WorkflowDefinition(
        id="deep_research",
        name="Deep Grounded Research & Fact-Check",
        description="Explores a technical or scientific topic from multiple angles, cross-references citations, and formats an executive brief.",
        nodes=[
            WorkflowNode(
                id="research_plan",
                name="Hypothesis & Scope Formulation",
                role="planner",
                task="Formulate key hypotheses, research sub-questions, and verification criteria for: '{{input}}'.",
                depends_on=[],
            ),
            WorkflowNode(
                id="evidence_gathering",
                name="Empirical Evidence & Literature",
                role="researcher",
                task="Gather empirical findings, data points, and documented benchmarks for:\n{{research_plan.output}}",
                depends_on=["research_plan"],
            ),
            WorkflowNode(
                id="counter_argument_analysis",
                name="Counter-Evidence & Edge Cases",
                role="researcher",
                task="Actively search for counter-arguments, failure modes, and dissenting data regarding:\n{{research_plan.output}}",
                depends_on=["research_plan"],
            ),
            WorkflowNode(
                id="rigor_audit",
                name="Factual Consistency Audit",
                role="reviewer",
                task="Cross-reference the evidence and counter-arguments. Flag any weak claims, logical leaps, or ungrounded statistics:\nEvidence:\n{{evidence_gathering.output}}\n\nCounter-Evidence:\n{{counter_argument_analysis.output}}",
                depends_on=["evidence_gathering", "counter_argument_analysis"],
            ),
            WorkflowNode(
                id="executive_whitepaper",
                name="Executive Whitepaper Synthesis",
                role="critic",
                task="Synthesize all findings into a structured, authoritative executive whitepaper with citations and actionable recommendations.",
                depends_on=["rigor_audit"],
            ),
        ],
    ),
    WorkflowDefinition(
        id="security_hardening",
        name="Security Vulnerability Audit & Hardening",
        description="Analyzes code or architecture for vulnerabilities, develops verified defensive patches, and validates regression resistance.",
        nodes=[
            WorkflowNode(
                id="threat_model",
                name="Threat Modeling & Attack Surfaces",
                role="planner",
                task="Identify all threat vectors, trust boundaries, and exposed attack surfaces for: '{{input}}'.",
                depends_on=[],
            ),
            WorkflowNode(
                id="vulnerability_scan",
                name="Static & Dynamic Vulnerability Audit",
                role="reviewer",
                task="Inspect code and configuration against OWASP Top 10, CWE standards, and memory safety rules:\n{{threat_model.output}}",
                depends_on=["threat_model"],
            ),
            WorkflowNode(
                id="remediation_patch",
                name="Hardened Defensive Patch Implementation",
                role="coder",
                task="Implement bulletproof patches, input sanitizers, parameterized queries, and defensive guards for the discovered vulnerabilities:\n{{vulnerability_scan.output}}",
                depends_on=["vulnerability_scan"],
            ),
            WorkflowNode(
                id="compliance_verification",
                name="Compliance & Resilience Scoring",
                role="critic",
                task="Evaluate the patches against zero-trust criteria and score the hardened codebase for deployment readiness:\n{{remediation_patch.output}}",
                depends_on=["remediation_patch"],
            ),
        ],
    ),
]

TEMPLATE_MAP: dict[str, WorkflowDefinition] = {t.id: t for t in TEMPLATES}

# Shorthand aliases used by frontend selector and chat shortcuts
TEMPLATE_MAP["fullstack"] = TEMPLATE_MAP["fullstack_feature"]
TEMPLATE_MAP["factcheck"] = TEMPLATE_MAP["deep_research"]
TEMPLATE_MAP["research"] = TEMPLATE_MAP["deep_research"]
TEMPLATE_MAP["vulnerability"] = TEMPLATE_MAP["security_hardening"]
TEMPLATE_MAP["security"] = TEMPLATE_MAP["security_hardening"]
