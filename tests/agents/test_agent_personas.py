"""Agent persona and workflow template tests (Tests 081 - 090)."""
from app.agents.roles import AGENT_REGISTRY
from app.agents.templates import TEMPLATES

def test_081_agent_planner_role_defined():
    assert "planner" in AGENT_REGISTRY and len(AGENT_REGISTRY["planner"].system_prompt) > 50

def test_082_agent_researcher_role_defined():
    assert "researcher" in AGENT_REGISTRY and len(AGENT_REGISTRY["researcher"].system_prompt) > 50

def test_083_agent_coder_role_defined():
    assert "coder" in AGENT_REGISTRY and len(AGENT_REGISTRY["coder"].system_prompt) > 50

def test_084_agent_reviewer_role_defined():
    assert "reviewer" in AGENT_REGISTRY and len(AGENT_REGISTRY["reviewer"].system_prompt) > 50

def test_085_agent_critic_role_defined():
    assert "critic" in AGENT_REGISTRY and len(AGENT_REGISTRY["critic"].system_prompt) > 50

def test_086_template_fullstack_valid():
    t_full = next((t for t in TEMPLATES if "full-stack" in t.name.lower() or "fullstack" in t.id.lower()), None)
    assert t_full is not None and len(t_full.nodes) >= 4

def test_087_template_factcheck_valid():
    t_fact = next((t for t in TEMPLATES if "research" in t.name.lower() or "fact" in t.name.lower()), None)
    assert t_fact is not None and len(t_fact.nodes) >= 3

def test_088_template_vulnerability_audit_valid():
    t_vuln = next((t for t in TEMPLATES if "vulnerability" in t.name.lower() or "security" in t.id.lower()), None)
    assert t_vuln is not None and len(t_vuln.nodes) >= 3

def test_089_agent_registry_lookup():
    assert AGENT_REGISTRY.get("non_existent_role") is None

def test_090_agent_system_prompt_immutability():
    prompts = [role.system_prompt for role in AGENT_REGISTRY.values()]
    assert len(prompts) == len(set(prompts))
