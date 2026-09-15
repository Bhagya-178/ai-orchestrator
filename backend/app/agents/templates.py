"""
Curated Multi-Agent DAG Workflow Templates.

Provides ready-to-execute workflows with optimal agent collaboration patterns.
"""

from app.agents.engine import WorkflowDefinition, WorkflowNode

TEMPLATES: list[WorkflowDefinition] = [
    WorkflowDefinition(
        id="fullstack_feature",
        name="Full-Stack Production Feature",
        description="Sequential single-agent pipeline using qwen2.5-coder:7b: architecture plan -> backend -> frontend -> QA audit -> final synthesis package.",
        nodes=[
            WorkflowNode(
                id="architect_plan",
                name="Architecture & Implementation Plan",
                role="planner",
                task=(
                    "Analyze the user requirement: '{{input}}'. Produce an end-to-end enterprise architecture specification:\n"
                    "1) System topology & data flow diagram (ASCII component map).\n"
                    "2) Relational / document database models with primary keys, indexes, foreign keys, and relations.\n"
                    "3) REST API endpoints with HTTP verbs, request/response schemas, and auth requirements.\n"
                    "4) Frontend state flow and component hierarchy.\n"
                    "5) Concurrency, transaction rollback, and edge-case mitigations.\n"
                    "Directly design the complete system from first principles. Do NOT call file tools or search for local files."
                ),
                depends_on=[],
                model="qwen2.5-coder:7b",
            ),
            WorkflowNode(
                id="backend_implementation",
                name="Backend Engine & DB Models",
                role="coder",
                task=(
                    "Implement the complete, production-grade backend engine for the architecture specification:\n"
                    "{{architect_plan.output}}\n\n"
                    "Mandatory Standards (Claude 3.5 Sonnet Standard):\n"
                    "- Modern Async FastAPI + SQLAlchemy 2.0 (AsyncSession, select, await execute). NO synchronous blocking db.query() in async routes.\n"
                    "- Real Security: Use passlib.context.CryptContext(schemes=['bcrypt']) for password hashing. Real JWT auth dependency (get_current_user). NO fake hashes or hardcoded user IDs (e.g. user_id=1).\n"
                    "- Full CRUD with relational models, Pydantic v2 schemas (from_attributes=True), and defensive error handling (HTTPException).\n"
                    "- Complete requirements.txt with all required packages and pinned versions.\n"
                    "Provide complete, copy-paste ready code without truncation."
                ),
                depends_on=["architect_plan"],
                model="qwen2.5-coder:7b",
            ),
            WorkflowNode(
                id="frontend_implementation",
                name="Next.js React UI & Client",
                role="coder",
                task=(
                    "Implement the production-ready React TypeScript frontend matching the backend API and architecture:\n"
                    "Backend API & Schemas:\n{{backend_implementation.output}}\n\n"
                    "Mandatory Standards (Claude 3.5 Sonnet Standard):\n"
                    "- Modern React 18+ (Vite or Next.js App Router style, clean TypeScript interfaces).\n"
                    "- Zero Keystroke API Spam: ALL mutations (POST/PUT/DELETE) MUST be bound to explicit form onSubmit or button onClick event handlers. NEVER trigger network requests inside useEffect dependency arrays!\n"
                    "- Complete package.json with ALL imported dependencies listed (e.g., axios/lucide-react if used).\n"
                    "- Resilient UI: Loading spinners, error alerts, disabled button states during network requests, and input resets.\n"
                    "Provide complete, copy-paste ready code without truncation."
                ),
                depends_on=["backend_implementation"],
                model="qwen2.5-coder:7b",
            ),
            WorkflowNode(
                id="security_qa_review",
                name="Security & Edge Case Audit",
                role="reviewer",
                task=(
                    "Audit both backend and frontend implementations for security vulnerabilities, race conditions, and React anti-patterns:\n"
                    "Backend Code:\n{{backend_implementation.output}}\n\n"
                    "Frontend Code:\n{{frontend_implementation.output}}\n\n"
                    "Review Checklist:\n"
                    "1. Authentication, password hashing, and token extraction (flag any fake hashes or hardcoded user IDs).\n"
                    "2. Concurrency, race conditions, and SQL injection prevention.\n"
                    "3. React state & lifecycle: Verify no mutating API calls exist in useEffect dependency arrays.\n"
                    "4. Dependency manifests: Verify package.json and requirements.txt include all imported libraries.\n"
                    "Output an authoritative Security & Quality Clearance Report with exact code remediation snippets if issues exist."
                ),
                depends_on=["frontend_implementation"],
                model="qwen2.5-coder:7b",
            ),
            WorkflowNode(
                id="final_delivery_synthesis",
                name="Synthesis & Release Package",
                role="critic",
                task=(
                    "Synthesize the complete feature deliverable into a unified release package and production deployment runbook:\n"
                    "Architecture Plan:\n{{architect_plan.output}}\n\n"
                    "Security Audit:\n{{security_qa_review.output}}\n\n"
                    "Format as an Executive Release Package: Verification Matrix, Architecture Overview, Docker & Database Setup Commands, and Production Runbook."
                ),
                depends_on=["security_qa_review"],
                model="qwen2.5-coder:7b",
            ),
        ],
    ),
    WorkflowDefinition(
        id="deep_research",
        name="Deep Grounded Research & Fact-Check",
        description="Sequential exploration of a technical or scientific topic, cross-referencing citations and formatting an executive brief.",
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
                task="Actively search for counter-arguments, failure modes, and dissenting data regarding:\n{{evidence_gathering.output}}",
                depends_on=["evidence_gathering"],
            ),
            WorkflowNode(
                id="rigor_audit",
                name="Factual Consistency Audit",
                role="reviewer",
                task="Cross-reference the evidence and counter-arguments. Flag any weak claims, logical leaps, or ungrounded statistics:\nEvidence:\n{{evidence_gathering.output}}\n\nCounter-Evidence:\n{{counter_argument_analysis.output}}",
                depends_on=["counter_argument_analysis"],
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
                model="qwen2.5-coder:7b",
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
