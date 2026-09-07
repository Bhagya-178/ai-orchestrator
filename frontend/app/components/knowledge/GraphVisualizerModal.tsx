"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Share2,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  ArrowRight,
  Info,
  Compass,
} from "lucide-react";
import { GraphData, GraphNode, GraphEdge } from "@/app/lib/types";
import { exploreGraph, findEntityPath } from "@/app/lib/api/graph";

interface GraphVisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GraphVisualizerModal({ isOpen, onClose }: GraphVisualizerModalProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Path finder state
  const [pathSource, setPathSource] = useState("");
  const [pathTarget, setPathTarget] = useState("");
  const [discoveredPath, setDiscoveredPath] = useState<string[]>([]);
  const [pathError, setPathError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      exploreGraph()
        .then(setGraphData)
        .catch(console.error);
    }
  }, [isOpen]);

  const handleFindPath = async () => {
    if (!pathSource || !pathTarget) return;
    setPathError(null);
    try {
      const res = await findEntityPath(pathSource, pathTarget);
      setDiscoveredPath(res.path);
    } catch (e: any) {
      setPathError("No direct relationship chain found");
      setDiscoveredPath([]);
    }
  };

  // Compute 2D node coordinates in a circular/force layout
  const nodePositions = useMemo(() => {
    if (!graphData || !graphData.nodes) return {};
    const positions: Record<string, { x: number; y: number }> = {};
    const n = graphData.nodes.length;
    const radius = Math.min(320, 40 + n * 18);
    const centerX = 400;
    const centerY = 300;

    graphData.nodes.forEach((node, idx) => {
      const angle = (idx / n) * 2 * Math.PI;
      // Slight radial variation based on centrality
      const r = radius * (0.6 + 0.4 * (1.0 - (node.centrality || 0.5)));
      positions[node.id] = {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    });

    return positions;
  }, [graphData]);

  if (!isOpen) return null;

  const getNodeColor = (type: string) => {
    switch (type) {
      case "class":
        return "#a855f7"; // purple
      case "function":
        return "#3b82f6"; // blue
      case "module":
        return "#10b981"; // emerald
      case "concept":
        return "#f59e0b"; // amber
      case "technology":
        return "#06b6d4"; // cyan
      default:
        return "#8b5cf6";
    }
  };

  const filteredNodes = (graphData?.nodes || []).filter((n) =>
    n.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-6xl h-[85vh] bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Knowledge Graph Explorer & Semantic Network
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Extracted entities, code abstractions, and topological PageRank centrality
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main 2D SVG Canvas */}
          <div
            className="flex-1 relative bg-[#090d16] overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              setIsDragging(true);
              setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
            }}
            onMouseMove={(e) => {
              if (isDragging) {
                setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            {/* View Controls Floating Pill */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 text-white text-xs shadow-lg">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.2))}
                className="p-1 hover:text-blue-400"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                className="p-1 hover:text-blue-400"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoomLevel(1.0);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1 hover:text-blue-400 ml-1"
                title="Reset View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* SVG Visualizer Canvas */}
            <svg className="w-full h-full">
              <g
                transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
                className="transition-transform duration-75"
              >
                {/* Edges */}
                {graphData?.edges.map((edge, idx) => {
                  const p1 = nodePositions[edge.source];
                  const p2 = nodePositions[edge.target];
                  if (!p1 || !p2) return null;

                  const isPathEdge =
                    discoveredPath.includes(edge.source) &&
                    discoveredPath.includes(edge.target);

                  return (
                    <g key={idx}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={isPathEdge ? "#10b981" : "rgba(255, 255, 255, 0.15)"}
                        strokeWidth={isPathEdge ? 3 : 1.2}
                        strokeDasharray={edge.relation === "inherits" ? "4" : undefined}
                      />
                      {/* Edge Label */}
                      <text
                        x={(p1.x + p2.x) / 2}
                        y={(p1.y + p2.y) / 2}
                        fill="rgba(255,255,255,0.4)"
                        fontSize="9"
                        textAnchor="middle"
                        className="select-none font-mono"
                      >
                        {edge.relation}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {graphData?.nodes.map((node) => {
                  const pos = nodePositions[node.id];
                  if (!pos) return null;

                  const isSelected = selectedNode?.id === node.id;
                  const isPathNode = discoveredPath.includes(node.id);
                  const radius = 12 + (node.centrality || 0.2) * 12;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      className="cursor-pointer group"
                    >
                      <circle
                        r={radius}
                        fill={getNodeColor(node.entity_type)}
                        fillOpacity={isSelected ? 0.9 : 0.6}
                        stroke={
                          isSelected
                            ? "#ffffff"
                            : isPathNode
                            ? "#10b981"
                            : "rgba(255,255,255,0.3)"
                        }
                        strokeWidth={isSelected ? 3 : isPathNode ? 2.5 : 1}
                        className="transition-all"
                      />
                      <text
                        y={radius + 12}
                        fill="#f3f4f6"
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle"
                        className="select-none pointer-events-none drop-shadow-sm font-mono"
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Right Inspector & Pathfinder Drawer */}
          <div className="w-84 border-l border-[var(--border)] p-4 flex flex-col gap-4 bg-[var(--card)]/40 overflow-y-auto">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entities..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#18181b] border border-[var(--border)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* Path Finder Section */}
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
                <Compass className="w-3.5 h-3.5 text-blue-500" />
                <span>Relationship Pathfinder</span>
              </div>
              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Source entity ID..."
                  value={pathSource}
                  onChange={(e) => setPathSource(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-transparent text-xs font-mono"
                />
                <input
                  type="text"
                  placeholder="Target entity ID..."
                  value={pathTarget}
                  onChange={(e) => setPathTarget(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-transparent text-xs font-mono"
                />
                <button
                  onClick={handleFindPath}
                  className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Find Shortest Path
                </button>
              </div>

              {discoveredPath.length > 0 && (
                <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                  Path ({discoveredPath.length - 1} hops):
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {discoveredPath.map((p, i) => (
                      <span key={i} className="flex items-center">
                        <span className="font-bold">{p}</span>
                        {i < discoveredPath.length - 1 && <ArrowRight className="w-3 h-3 mx-1" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {pathError && (
                <div className="text-[11px] text-red-500 mt-1">{pathError}</div>
              )}
            </div>

            {/* Selected Node Details */}
            {selectedNode ? (
              <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-50/20 dark:bg-blue-900/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {selectedNode.label}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono text-white capitalize font-medium"
                    style={{ backgroundColor: getNodeColor(selectedNode.entity_type) }}
                  >
                    {selectedNode.entity_type}
                  </span>
                </div>

                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  ID: {selectedNode.id}
                </div>

                <div className="text-[11px] text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Centrality:</span>{" "}
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {(selectedNode.centrality * 100).toFixed(1)}%
                  </span>
                </div>

                {selectedNode.attributes && Object.keys(selectedNode.attributes).length > 0 && (
                  <div className="mt-2 text-[11px] space-y-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Attributes:</span>
                    <pre className="p-2 rounded bg-black/5 dark:bg-white/5 font-mono text-[10px] overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedNode.attributes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-[var(--border)] text-center text-xs text-gray-400">
                Click any node on the canvas to inspect its relationships and attributes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
