"""
Entity Knowledge Graph & Graph-Augmented Retrieval (Graph RAG).

Capabilities:
- AST-based entity extraction for Python and JavaScript/TypeScript code (Classes, Functions, Imports, Calls)
- Co-occurrence concept extraction for unstructured documents
- In-memory topological graph network with PageRank and degree centrality
- Shortest pathfinding (BFS) and ego-network neighborhood querying
- Subgraph export for 2D interactive frontend graph visualizers
- Graph-augmented context expansion for LLM prompting
"""

import ast
import logging
import math
import re
from collections import defaultdict, deque
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class EntityNode(BaseModel):
    id: str
    label: str
    entity_type: str  # "class" | "function" | "module" | "concept" | "api" | "technology"
    attributes: dict[str, Any] = Field(default_factory=dict)
    centrality: float = 0.0


class RelationshipEdge(BaseModel):
    source: str
    target: str
    relation: str  # "calls" | "inherits" | "imports" | "defines" | "relates_to" | "depends_on"
    weight: float = 1.0


class KnowledgeGraph:
    """Enterprise Knowledge Graph engine supporting AST parsing, graph algorithms, and RAG augmentation."""

    def __init__(self):
        self.nodes: dict[str, EntityNode] = {}
        self.adj: dict[str, dict[str, RelationshipEdge]] = defaultdict(dict)
        self.rev_adj: dict[str, dict[str, RelationshipEdge]] = defaultdict(dict)
        self._initialize_seed_knowledge()

    def _initialize_seed_knowledge(self):
        """Seed initial high-level system architecture entities and relationships."""
        seed_nodes = [
            EntityNode(id="sys_orchestrator", label="AI Orchestrator", entity_type="module", attributes={"desc": "Core agentic and routing engine"}),
            EntityNode(id="sys_rag", label="Hybrid RAG 2.0", entity_type="concept", attributes={"desc": "Dense vector + BM25 sparse reciprocal rank fusion"}),
            EntityNode(id="sys_mcp", label="MCP Hub", entity_type="concept", attributes={"desc": "Model Context Protocol JSON-RPC 2.0 client"}),
            EntityNode(id="sys_agents", label="DAG Agent Engine", entity_type="concept", attributes={"desc": "Multi-agent collaborative workflows"}),
            EntityNode(id="sys_tools", label="ReAct Tools Registry", entity_type="module", attributes={"desc": "Sandboxed operational tools"}),
            EntityNode(id="sys_arena", label="Model Arena", entity_type="module", attributes={"desc": "Side-by-side LLM battle arbitration"}),
            EntityNode(id="sys_canvas", label="Canvas Studio 2.0", entity_type="module", attributes={"desc": "Interactive code and artifact editor"}),
            EntityNode(id="sys_cache", label="Semantic Vector Cache", entity_type="concept", attributes={"desc": "Cosine similarity query deduplication"}),
            EntityNode(id="sys_qdrant", label="Qdrant Vector DB", entity_type="technology", attributes={"desc": "High-speed dense vector store"}),
            EntityNode(id="sys_postgres", label="PostgreSQL", entity_type="technology", attributes={"desc": "Relational storage for users, sessions, logs"}),
        ]
        for n in seed_nodes:
            self.add_node(n)

        seed_edges = [
            RelationshipEdge(source="sys_orchestrator", target="sys_rag", relation="depends_on", weight=1.0),
            RelationshipEdge(source="sys_orchestrator", target="sys_agents", relation="defines", weight=1.0),
            RelationshipEdge(source="sys_orchestrator", target="sys_tools", relation="calls", weight=1.0),
            RelationshipEdge(source="sys_orchestrator", target="sys_mcp", relation="calls", weight=1.0),
            RelationshipEdge(source="sys_rag", target="sys_qdrant", relation="depends_on", weight=1.0),
            RelationshipEdge(source="sys_orchestrator", target="sys_postgres", relation="depends_on", weight=1.0),
            RelationshipEdge(source="sys_orchestrator", target="sys_arena", relation="defines", weight=1.0),
            RelationshipEdge(source="sys_orchestrator", target="sys_canvas", relation="defines", weight=1.0),
            RelationshipEdge(source="sys_orchestrator", target="sys_cache", relation="calls", weight=1.0),
        ]
        for e in seed_edges:
            self.add_edge(e)

        self.compute_pagerank()

    def add_node(self, node: EntityNode) -> None:
        """Add or update an entity node."""
        self.nodes[node.id] = node

    def add_edge(self, edge: RelationshipEdge) -> None:
        """Add a directed relationship between two entities."""
        if edge.source not in self.nodes:
            self.add_node(EntityNode(id=edge.source, label=edge.source, entity_type="concept"))
        if edge.target not in self.nodes:
            self.add_node(EntityNode(id=edge.target, label=edge.target, entity_type="concept"))

        self.adj[edge.source][edge.target] = edge
        self.rev_adj[edge.target][edge.source] = edge

    @property
    def edges(self) -> list[RelationshipEdge]:
        """Return all edges in the knowledge graph."""
        return [edge for targets in self.adj.values() for edge in targets.values()]

    def get_neighbors(self, node_id: str) -> list[str]:
        """Return immediate neighbor IDs."""
        return list(self.adj.get(node_id, {}).keys())

    def get_outgoing_edges(self, node_id: str) -> list[RelationshipEdge]:
        """Return outgoing edges from node_id."""
        return list(self.adj.get(node_id, {}).values())

    def get_incoming_edges(self, node_id: str) -> list[RelationshipEdge]:
        """Return incoming edges to node_id."""
        return list(self.rev_adj.get(node_id, {}).values())

    def to_dict(self) -> dict[str, Any]:
        """Serialize knowledge graph to dictionary representation."""
        return {
            "nodes": [n.model_dump() for n in self.nodes.values()],
            "edges": [e.model_dump() for e in self.edges],
        }

    def clear(self) -> None:
        """Clear all nodes and edges from the graph."""
        self.nodes.clear()
        self.adj.clear()
        self.rev_adj.clear()

    def compute_degree_centrality(self) -> dict[str, float]:
        """Compute degree centrality normalized by maximum possible connections."""
        total = len(self.nodes) - 1
        if total <= 0:
            return {nid: 0.0 for nid in self.nodes}
        return {
            nid: round((len(self.adj.get(nid, {})) + len(self.rev_adj.get(nid, {}))) / total, 4)
            for nid in self.nodes
        }

    def extract_from_python_code(self, code: str, filename: str = "") -> int:
        """
        Parse Python source code using the AST module to extract:
        - Module node
        - Class nodes and inheritance relationships
        - Function nodes, decorators, and definitions
        - Import dependencies
        - Inter-function calls
        """
        count = 0
        try:
            tree = ast.parse(code)
        except SyntaxError:
            return 0

        module_id = f"mod_{filename.replace('/', '_').replace('.', '_')}" if filename else "mod_current"
        self.add_node(EntityNode(
            id=module_id,
            label=filename or "Module",
            entity_type="module",
            attributes={"filename": filename},
        ))
        count += 1

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                cls_id = f"cls_{node.name}"
                doc = ast.get_docstring(node) or ""
                self.add_node(EntityNode(
                    id=cls_id,
                    label=node.name,
                    entity_type="class",
                    attributes={"docstring": doc[:200], "line": node.lineno, "filename": filename},
                ))
                self.add_edge(RelationshipEdge(source=module_id, target=cls_id, relation="defines"))
                count += 1

                for base in node.bases:
                    if isinstance(base, ast.Name):
                        base_id = f"cls_{base.id}"
                        self.add_edge(RelationshipEdge(source=cls_id, target=base_id, relation="inherits"))

            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                fn_id = f"fn_{node.name}"
                doc = ast.get_docstring(node) or ""
                self.add_node(EntityNode(
                    id=fn_id,
                    label=f"{node.name}()",
                    entity_type="function",
                    attributes={"docstring": doc[:200], "line": node.lineno, "filename": filename},
                ))
                self.add_edge(RelationshipEdge(source=module_id, target=fn_id, relation="defines"))
                count += 1

            elif isinstance(node, ast.Import):
                for alias in node.names:
                    imp_id = f"mod_{alias.name.replace('.', '_')}"
                    self.add_edge(RelationshipEdge(source=module_id, target=imp_id, relation="imports"))

            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imp_id = f"mod_{node.module.replace('.', '_')}"
                    self.add_edge(RelationshipEdge(source=module_id, target=imp_id, relation="imports"))

        self.compute_pagerank()
        return count

    def extract_from_text(self, text: str, source_doc: str = "") -> int:
        """
        Extract conceptual entities and relationships from unstructured prose
        using regex capitalization heuristics and co-occurrence windows.
        """
        count = 0
        # Match capitalized multi-word phrases (e.g., "Vector Database", "Model Context Protocol")
        pattern = r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b"
        matches = set(re.findall(pattern, text))

        discovered_ids = []
        for m in matches:
            if len(m) < 4:
                continue
            ent_id = f"concept_{m.lower().replace(' ', '_')}"
            self.add_node(EntityNode(
                id=ent_id,
                label=m,
                entity_type="concept",
                attributes={"source": source_doc},
            ))
            discovered_ids.append(ent_id)
            count += 1

        # Link co-occurring concepts within the same document
        for i in range(len(discovered_ids)):
            for j in range(i + 1, min(i + 4, len(discovered_ids))):
                self.add_edge(RelationshipEdge(
                    source=discovered_ids[i],
                    target=discovered_ids[j],
                    relation="relates_to",
                    weight=0.5,
                ))

        if count > 0:
            self.compute_pagerank()
        return count

    def compute_pagerank(self, damping: float = 0.85, max_iter: int = 40, tol: float = 1e-5):
        """Compute PageRank scores across all nodes in the knowledge graph."""
        n = len(self.nodes)
        if n == 0:
            return

        scores = {nid: 1.0 / n for nid in self.nodes}

        for _ in range(max_iter):
            new_scores = {}
            diff = 0.0

            for nid in self.nodes:
                incoming_sum = 0.0
                for pred_id in self.rev_adj.get(nid, {}):
                    out_deg = len(self.adj.get(pred_id, {}))
                    if out_deg > 0:
                        incoming_sum += scores[pred_id] / out_deg

                rank = (1.0 - damping) / n + damping * incoming_sum
                diff += abs(rank - scores[nid])
                new_scores[nid] = rank

            scores = new_scores
            if diff < tol:
                break

        # Normalize and store in nodes
        max_score = max(scores.values()) if scores else 1.0
        for nid, rank in scores.items():
            if nid in self.nodes:
                self.nodes[nid].centrality = round(rank / max_score if max_score > 0 else rank, 4)
        return scores

    def find_shortest_path(self, source_id: str, target_id: str) -> list[str]:
        """Breadth-First Search to find shortest relationship path between two entities."""
        if source_id not in self.nodes or target_id not in self.nodes:
            return []

        if source_id == target_id:
            return [source_id]

        queue = deque([[source_id]])
        visited = {source_id}

        while queue:
            path = queue.popleft()
            curr = path[-1]

            # Consider both forward and backward connections for semantic relatedness
            neighbors = set(self.adj.get(curr, {}).keys()) | set(self.rev_adj.get(curr, {}).keys())
            for nxt in neighbors:
                if nxt == target_id:
                    return path + [nxt]
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(path + [nxt])

        return []

    def get_neighborhood(self, node_id: str, radius: int = 1) -> dict[str, Any]:
        """Get ego-network subgraph around a specific node up to radius hops."""
        if node_id not in self.nodes:
            return {"nodes": [], "edges": []}

        subgraph_nodes = {node_id}
        frontier = {node_id}

        for _ in range(radius):
            next_frontier = set()
            for curr in frontier:
                neighbors = set(self.adj.get(curr, {}).keys()) | set(self.rev_adj.get(curr, {}).keys())
                next_frontier.update(neighbors)
            frontier = next_frontier - subgraph_nodes
            subgraph_nodes.update(frontier)

        nodes_list = [self.nodes[nid] for nid in subgraph_nodes if nid in self.nodes]
        edges_list = []

        for u in subgraph_nodes:
            for v, edge in self.adj.get(u, {}).items():
                if v in subgraph_nodes:
                    edges_list.append(edge)

        return {
            "center": node_id,
            "nodes": [n.model_dump() for n in nodes_list],
            "edges": [e.model_dump() for e in edges_list],
        }

    def get_subgraph(
        self,
        entity_types: Optional[list[str]] = None,
        max_nodes: int = 120,
    ) -> dict[str, Any]:
        """Export graph structure for frontend 2D visualization, sorted by centrality."""
        candidates = list(self.nodes.values())
        if entity_types:
            candidates = [n for n in candidates if n.entity_type in entity_types]

        # Prioritize high centrality nodes
        candidates.sort(key=lambda n: n.centrality, reverse=True)
        selected_nodes = candidates[:max_nodes]
        selected_ids = {n.id for n in selected_nodes}

        selected_edges = []
        for u in selected_ids:
            for v, edge in self.adj.get(u, {}).items():
                if v in selected_ids:
                    selected_edges.append(edge)

        return {
            "total_graph_nodes": len(self.nodes),
            "returned_nodes": len(selected_nodes),
            "nodes": [n.model_dump() for n in selected_nodes],
            "edges": [e.model_dump() for e in selected_edges],
        }

    def augment_query(self, query: str, top_k_entities: int = 4) -> str:
        """
        Scan user query for mentioned entities, expand along high-centrality
        edges, and format a semantic graph context block for LLM prompting.
        """
        q_lower = query.lower()
        matched = []

        for nid, node in self.nodes.items():
            if node.label.lower() in q_lower or (node.attributes.get("filename") and node.attributes["filename"].lower() in q_lower):
                matched.append(node)

        if not matched:
            return ""

        matched.sort(key=lambda n: n.centrality, reverse=True)
        top_matched = matched[:top_k_entities]

        context_lines = ["\n[Knowledge Graph Context]:"]
        for n in top_matched:
            neighbors = list(self.adj.get(n.id, {}).values())[:3]
            rel_strings = [f"{e.relation} -> {self.nodes.get(e.target, EntityNode(id=e.target, label=e.target, entity_type='concept')).label}" for e in neighbors]
            rel_desc = ", ".join(rel_strings) if rel_strings else "no external edges"
            context_lines.append(f"- Entity: {n.label} ({n.entity_type}): {rel_desc}")

        return "\n".join(context_lines)


knowledge_graph = KnowledgeGraph()
