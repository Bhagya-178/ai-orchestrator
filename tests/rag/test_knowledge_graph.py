"""Knowledge graph, network topology, PageRank centrality, and AST extraction tests (Tests 091 - 110)."""
import ast
from app.services.rag_v2.graph import KnowledgeGraph, EntityNode, RelationshipEdge

def test_091_graph_node_addition():
    kg = KnowledgeGraph()
    kg.clear()
    n1 = EntityNode(id="ServiceA", label="ServiceA", entity_type="class")
    kg.add_node(n1)
    assert "ServiceA" in kg.nodes

def test_092_graph_node_duplicate_id_update():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="ServiceA", label="ServiceA", entity_type="class"))
    kg.add_node(EntityNode(id="ServiceA", label="ServiceA_Updated", entity_type="class"))
    assert kg.nodes["ServiceA"].label == "ServiceA_Updated"

def test_093_graph_relationship_edge_addition():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="ServiceA", label="ServiceA", entity_type="class"))
    kg.add_node(EntityNode(id="DatabaseB", label="DatabaseB", entity_type="datastore"))
    kg.add_edge(RelationshipEdge(source="ServiceA", target="DatabaseB", relation="calls"))
    assert len(kg.edges) == 1

def test_094_graph_neighbors_query():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="ServiceA", label="ServiceA", entity_type="class"))
    kg.add_node(EntityNode(id="DatabaseB", label="DatabaseB", entity_type="datastore"))
    kg.add_edge(RelationshipEdge(source="ServiceA", target="DatabaseB", relation="calls"))
    assert "DatabaseB" in kg.get_neighbors("ServiceA")

def test_095_graph_outgoing_edges():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="ServiceA", label="ServiceA", entity_type="class"))
    kg.add_node(EntityNode(id="DatabaseB", label="DatabaseB", entity_type="datastore"))
    kg.add_edge(RelationshipEdge(source="ServiceA", target="DatabaseB", relation="calls"))
    out_edges = kg.get_outgoing_edges("ServiceA")
    assert len(out_edges) == 1 and out_edges[0].target == "DatabaseB"

def test_096_graph_incoming_edges():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="ServiceA", label="ServiceA", entity_type="class"))
    kg.add_node(EntityNode(id="DatabaseB", label="DatabaseB", entity_type="datastore"))
    kg.add_edge(RelationshipEdge(source="ServiceA", target="DatabaseB", relation="calls"))
    in_edges = kg.get_incoming_edges("DatabaseB")
    assert len(in_edges) == 1 and in_edges[0].source == "ServiceA"

def test_097_graph_serialization_dict():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="ServiceA", label="ServiceA", entity_type="class"))
    kg.add_node(EntityNode(id="DatabaseB", label="DatabaseB", entity_type="datastore"))
    kg.add_edge(RelationshipEdge(source="ServiceA", target="DatabaseB", relation="calls"))
    data = kg.to_dict()
    assert "nodes" in data and "edges" in data and len(data["nodes"]) == 2

def test_098_graph_clear():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="A", label="A", entity_type="c"))
    kg.clear()
    assert len(kg.nodes) == 0 and len(kg.edges) == 0

def test_099_graph_isolated_nodes():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="Isolated", label="Isolated", entity_type="file"))
    assert len(kg.get_neighbors("Isolated")) == 0

def test_100_graph_edge_types_filtering():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="A", label="A", entity_type="c"))
    kg.add_node(EntityNode(id="B", label="B", entity_type="c"))
    kg.add_node(EntityNode(id="C", label="C", entity_type="c"))
    kg.add_edge(RelationshipEdge(source="A", target="B", relation="inherits"))
    kg.add_edge(RelationshipEdge(source="A", target="C", relation="imports"))
    inherits_edges = [e for e in kg.edges if e.relation == "inherits"]
    assert len(inherits_edges) == 1 and inherits_edges[0].relation == "inherits"

def test_101_graph_degree_centrality():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="Center", label="Center", entity_type="class"))
    for i in range(1, 4):
        nid = f"Leaf{i}"
        kg.add_node(EntityNode(id=nid, label=nid, entity_type="function"))
        kg.add_edge(RelationshipEdge(source=nid, target="Center", relation="calls"))
    deg = kg.compute_degree_centrality()
    assert deg["Center"] > deg["Leaf1"]

def test_102_graph_pagerank_computation():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="Center", label="Center", entity_type="class"))
    for i in range(1, 4):
        nid = f"Leaf{i}"
        kg.add_node(EntityNode(id=nid, label=nid, entity_type="function"))
        kg.add_edge(RelationshipEdge(source=nid, target="Center", relation="calls"))
    pr = kg.compute_pagerank()
    assert pr["Center"] > pr["Leaf1"] and kg.nodes["Center"].centrality == 1.0

def test_103_graph_bfs_shortest_path_direct():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="Center", label="Center", entity_type="class"))
    kg.add_node(EntityNode(id="Leaf1", label="Leaf1", entity_type="function"))
    kg.add_edge(RelationshipEdge(source="Leaf1", target="Center", relation="calls"))
    assert kg.find_shortest_path("Leaf1", "Center") == ["Leaf1", "Center"]

def test_104_graph_bfs_shortest_path_multihop():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="Center", label="Center", entity_type="class"))
    kg.add_node(EntityNode(id="Leaf1", label="Leaf1", entity_type="function"))
    kg.add_node(EntityNode(id="Leaf2", label="Leaf2", entity_type="function"))
    kg.add_edge(RelationshipEdge(source="Leaf1", target="Center", relation="calls"))
    kg.add_edge(RelationshipEdge(source="Center", target="Leaf2", relation="calls"))
    path_hop = kg.find_shortest_path("Leaf1", "Leaf2")
    assert "Center" in path_hop

def test_105_graph_bfs_unreachable_returns_empty():
    kg = KnowledgeGraph()
    kg.clear()
    kg.add_node(EntityNode(id="Leaf1", label="Leaf1", entity_type="function"))
    kg.add_node(EntityNode(id="Unreachable", label="Unreachable", entity_type="class"))
    assert kg.find_shortest_path("Leaf1", "Unreachable") == []

def test_106_graph_ast_extract_class_definitions():
    sample = """class BaseService:
    pass
class ChatService(BaseService):
    pass"""
    parsed = ast.parse(sample)
    classes = [n.name for n in ast.walk(parsed) if isinstance(n, ast.ClassDef)]
    assert "BaseService" in classes and "ChatService" in classes

def test_107_graph_ast_extract_function_definitions():
    sample = """def process_message(text):
    return text.strip()"""
    parsed = ast.parse(sample)
    functions = [n.name for n in ast.walk(parsed) if isinstance(n, ast.FunctionDef)]
    assert "process_message" in functions

def test_108_graph_ast_extract_inheritance():
    sample = """class Base:
    pass
class Derived(Base):
    pass"""
    parsed = ast.parse(sample)
    chat_node = next(n for n in ast.walk(parsed) if isinstance(n, ast.ClassDef) and n.name == "Derived")
    bases = [b.id for b in chat_node.bases if isinstance(b, ast.Name)]
    assert "Base" in bases

def test_109_graph_ast_extract_imports():
    import_code = "import json\nfrom math import sqrt\n"
    imp_parsed = ast.parse(import_code)
    imports = []
    for n in ast.walk(imp_parsed):
        if isinstance(n, ast.Import):
            imports.extend(alias.name for alias in n.names)
        elif isinstance(n, ast.ImportFrom):
            imports.append(n.module)
    assert "json" in imports and "math" in imports

def test_110_graph_ast_syntax_error_graceful():
    try:
        ast.parse("def broken_code(:")
        parsed_ok = True
    except SyntaxError:
        parsed_ok = False
    assert parsed_ok is False
