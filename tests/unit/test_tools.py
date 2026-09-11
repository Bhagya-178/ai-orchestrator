"""Unit tests for tool registry, calculator, datetime, and tool schemas (Tests 181 - 190)."""
import asyncio
from datetime import datetime
from app.tools.registry import tool_registry

def test_181_tool_registry_contains_calculator():
    assert tool_registry.get("calculator") is not None

def test_182_tool_registry_contains_datetime():
    assert tool_registry.get("datetime") is not None

def test_183_tool_registry_contains_math():
    assert tool_registry.get("advanced_math") is not None

def test_184_tool_registry_schema_export():
    calc = tool_registry.get("calculator")
    schema = calc.to_schema()
    assert "type" in schema and "function" in schema and schema["function"]["name"] == "calculator"

def test_185_tool_calculator_execution_success():
    calc = tool_registry.get("calculator")
    res = asyncio.run(calc.execute(expression="12 * 12"))
    assert res.get("success") is True and res.get("result") == 144

def test_186_tool_datetime_execution_success():
    dt = tool_registry.get("datetime")
    res = asyncio.run(dt.execute())
    assert res.get("success") is True and str(datetime.now().year) in str(res.get("result"))

def test_187_tool_unknown_name_returns_none():
    assert tool_registry.get("nonexistent_tool_xyz") is None

def test_188_tool_risk_level_metadata():
    summaries = tool_registry.get_summaries()
    risk_levels = {s["name"]: s.get("risk_level") for s in summaries}
    assert "calculator" in risk_levels and risk_levels["calculator"] in ("safe", "standard", "moderate", "sensitive")

def test_189_tool_summary_keys():
    s0 = tool_registry.get_summaries()[0]
    assert "name" in s0 and "description" in s0 and "parameters" in s0

def test_190_tool_dynamic_lifecycle():
    calc = tool_registry.get("calculator")
    tool_registry.unregister("calculator")
    unregistered_ok = tool_registry.get("calculator") is None
    tool_registry.register(calc)
    reregistered_ok = tool_registry.get("calculator") is not None
    assert unregistered_ok and reregistered_ok
