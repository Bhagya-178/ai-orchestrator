"""
Knowledge Graph & Graph RAG Router.

Endpoints:
- GET /rag/v2/graph/explore: Export complete subgraph for frontend 2D visualization.
- GET /rag/v2/graph/neighborhood/{node_id}: Ego-network around a specific node.
- GET /rag/v2/graph/path: Shortest path between two entities.
- POST /rag/v2/graph/index-code: Parse code file with AST and ingest into graph.
- POST /rag/v2/graph/index-text: Extract concepts and co-occurrence edges from prose.
- GET /rag/v2/graph/query-augment: Return graph context snippet for a prompt.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.rag_v2.graph import knowledge_graph

router = APIRouter(prefix="/rag/v2/graph", tags=["Knowledge Graph"])


class IndexCodeRequest(BaseModel):
    code: str = Field(..., min_length=1)
    filename: str = Field(default="untitled.py")
    language: str = Field(default="python")


class IndexTextRequest(BaseModel):
    text: str = Field(..., min_length=1)
    source_doc: str = Field(default="document")


@router.get("/explore")
async def explore_graph(
    types: Optional[str] = Query(None, description="Comma-separated entity types (class,function,module,concept,technology)"),
    max_nodes: int = Query(120, ge=10, le=500),
):
    """Retrieve graph nodes and edges for interactive frontend rendering."""
    filter_types = [t.strip() for t in types.split(",")] if types else None
    return knowledge_graph.get_subgraph(entity_types=filter_types, max_nodes=max_nodes)


@router.get("/neighborhood/{node_id}")
async def get_node_neighborhood(
    node_id: str,
    radius: int = Query(1, ge=1, le=3),
):
    """Retrieve ego-network around a specific entity up to radius hops."""
    return knowledge_graph.get_neighborhood(node_id=node_id, radius=radius)


@router.get("/path")
async def find_entity_path(
    source_id: str = Query(...),
    target_id: str = Query(...),
):
    """Find the shortest relationship path between two entities."""
    path = knowledge_graph.find_shortest_path(source_id=source_id, target_id=target_id)
    if not path:
        raise HTTPException(status_code=404, detail="No path found between the specified entities")
    return {
        "source": source_id,
        "target": target_id,
        "path": path,
        "length": len(path) - 1,
    }


@router.post("/index-code")
async def index_code(req: IndexCodeRequest):
    """Parse Python or JavaScript source code using AST and ingest entities into graph."""
    count = knowledge_graph.extract_from_python_code(code=req.code, filename=req.filename)
    return {
        "message": f"Successfully extracted {count} entities into knowledge graph",
        "entities_count": count,
        "total_graph_nodes": len(knowledge_graph.nodes),
    }


@router.post("/index-text")
async def index_text(req: IndexTextRequest):
    """Extract named concepts and co-occurrence relations from text."""
    count = knowledge_graph.extract_from_text(text=req.text, source_doc=req.source_doc)
    return {
        "message": f"Extracted {count} concepts into knowledge graph",
        "entities_count": count,
        "total_graph_nodes": len(knowledge_graph.nodes),
    }


@router.get("/query-augment")
async def augment_query(q: str = Query(..., min_length=1)):
    """Retrieve semantic graph context for a query to augment LLM prompt."""
    context = knowledge_graph.augment_query(query=q)
    return {
        "query": q,
        "graph_context": context,
        "has_context": bool(context),
    }
