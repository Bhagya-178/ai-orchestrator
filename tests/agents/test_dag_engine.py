"""Agent engine tests for topological sort, cycle detection, parallel waves, and scalability (Tests 071 - 080)."""
import time
from app.agents.engine import WorkflowNode, detect_cycles_and_toposort

def test_071_dag_linear_toposort():
    nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="plan"),
        WorkflowNode(id="B", name="Node B", role="coder", task="code", depends_on=["A"]),
        WorkflowNode(id="C", name="Node C", role="reviewer", task="review", depends_on=["B"]),
    ]
    waves = detect_cycles_and_toposort(nodes)
    assert len(waves) == 3 and waves[0] == ["A"] and waves[1] == ["B"] and waves[2] == ["C"]

def test_072_dag_parallel_wave_execution():
    nodes = [
        WorkflowNode(id="A1", name="Node A1", role="researcher", task="research 1"),
        WorkflowNode(id="A2", name="Node A2", role="researcher", task="research 2"),
        WorkflowNode(id="B", name="Node B", role="critic", task="synthesize", depends_on=["A1", "A2"]),
    ]
    waves = detect_cycles_and_toposort(nodes)
    assert len(waves) == 2 and set(waves[0]) == {"A1", "A2"} and waves[1] == ["B"]

def test_073_dag_cycle_detection_simple():
    nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="p", depends_on=["B"]),
        WorkflowNode(id="B", name="Node B", role="coder", task="c", depends_on=["A"]),
    ]
    try:
        detect_cycles_and_toposort(nodes)
        detected = False
    except ValueError:
        detected = True
    assert detected is True

def test_074_dag_cycle_detection_indirect():
    nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="p", depends_on=["C"]),
        WorkflowNode(id="B", name="Node B", role="coder", task="c", depends_on=["A"]),
        WorkflowNode(id="C", name="Node C", role="reviewer", task="r", depends_on=["B"]),
    ]
    try:
        detect_cycles_and_toposort(nodes)
        detected = False
    except ValueError:
        detected = True
    assert detected is True

def test_075_dag_self_referential_cycle():
    nodes = [WorkflowNode(id="A", name="Node A", role="planner", task="p", depends_on=["A"])]
    try:
        detect_cycles_and_toposort(nodes)
        detected = False
    except ValueError:
        detected = True
    assert detected is True

def test_076_dag_disconnected_components():
    nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="p"),
        WorkflowNode(id="B", name="Node B", role="coder", task="c", depends_on=["A"]),
        WorkflowNode(id="X", name="Node X", role="researcher", task="r"),
        WorkflowNode(id="Y", name="Node Y", role="critic", task="cr", depends_on=["X"]),
    ]
    waves = detect_cycles_and_toposort(nodes)
    assert len(waves) == 2 and set(waves[0]) == {"A", "X"}

def test_077_dag_missing_dependency_validation():
    nodes = [WorkflowNode(id="A", name="Node A", role="planner", task="p", depends_on=["NON_EXISTENT"])]
    try:
        detect_cycles_and_toposort(nodes)
        detected = False
    except ValueError:
        detected = True
    assert detected is True

def test_078_dag_diamond_dependency():
    nodes = [
        WorkflowNode(id="Root", name="Root", role="planner", task="r"),
        WorkflowNode(id="Left", name="Left", role="researcher", task="l", depends_on=["Root"]),
        WorkflowNode(id="Right", name="Right", role="coder", task="rt", depends_on=["Root"]),
        WorkflowNode(id="Sink", name="Sink", role="reviewer", task="s", depends_on=["Left", "Right"]),
    ]
    waves = detect_cycles_and_toposort(nodes)
    assert len(waves) == 3 and waves[0] == ["Root"] and set(waves[1]) == {"Left", "Right"} and waves[2] == ["Sink"]

def test_079_dag_single_node_execution():
    nodes = [WorkflowNode(id="Solo", name="Solo", role="planner", task="solo")]
    waves = detect_cycles_and_toposort(nodes)
    assert len(waves) == 1 and waves[0] == ["Solo"]

def test_080_dag_large_graph_scalability():
    chain_nodes = [WorkflowNode(id=f"N_{i}", name=f"Node {i}", role="coder", task=f"step {i}", depends_on=[f"N_{i-1}"] if i > 0 else []) for i in range(20)]
    t0 = time.perf_counter()
    waves = detect_cycles_and_toposort(chain_nodes)
    t_elapsed = (time.perf_counter() - t0) * 1000
    assert len(waves) == 20 and t_elapsed < 15.0
