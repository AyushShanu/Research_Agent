// PASTE YOUR PipelineGraph COMPONENT HERE
"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeStatus } from "../lib/types";

const NODE_LABELS: Record<string, string> = {
  router: "ROUTE",
  research: "SEARCH",
  evaluate: "VERIFY",
  compare: "COMPARE",
  decision: "DECIDE",
  career: "CAREER",
  codebase: "AUDIT",
  synthesize: "SYNTHESIZE",
};

interface PipelineNodeData {
  label: string;
  status: NodeStatus;
  [key: string]: unknown;
}

function statusColor(status: NodeStatus): string {
  switch (status) {
    case "active":
      return "var(--signal-active)";
    case "done":
      return "var(--signal-verified)";
    case "error":
      return "var(--signal-contradiction)";
    default:
      return "var(--graphite)";
  }
}

function PipelineNode({ data }: NodeProps) {
  const { label, status } = data as unknown as PipelineNodeData;
  const color = statusColor(status);

  return (
    <div
      className="mono"
      style={{
        padding: "10px 16px",
        borderRadius: "var(--radius)",
        border: `1.5px solid ${color}`,
        background: "var(--panel)",
        color: status === "idle" ? "var(--text-muted)" : "var(--text)",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.06em",
        minWidth: 108,
        textAlign: "center",
        boxShadow: status === "active" ? `0 0 0 4px ${color}22, 0 0 18px ${color}55` : "none",
        animation: status === "active" ? "pulse 1.6s ease-in-out infinite" : "none",
        transition: "box-shadow 0.3s ease, border-color 0.3s ease, color 0.3s ease",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, border: "none" }} />
      {label}
      <Handle type="source" position={Position.Right} style={{ background: color, border: "none" }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px ${color}22, 0 0 18px ${color}55; }
          50% { box-shadow: 0 0 0 7px ${color}11, 0 0 26px ${color}88; }
        }
      `}</style>
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNode };

interface PipelineGraphProps {
  pipeline: string[];
  nodeStatus: Record<string, NodeStatus>;
}

export default function PipelineGraph({ pipeline, nodeStatus }: PipelineGraphProps) {
  const nodes: Node[] = useMemo(
    () =>
      pipeline.map((id, i) => ({
        id,
        type: "pipeline",
        position: { x: i * 168, y: 0 },
        data: { label: NODE_LABELS[id] ?? id.toUpperCase(), status: nodeStatus[id] ?? "idle" },
        draggable: false,
        selectable: false,
      })),
    [pipeline, nodeStatus]
  );

  const edges: Edge[] = useMemo(
    () =>
      pipeline.slice(0, -1).map((id, i) => {
        const target = pipeline[i + 1];
        const isLit = nodeStatus[id] === "done";
        return {
          id: `${id}-${target}`,
          source: id,
          target,
          animated: nodeStatus[target] === "active",
          style: {
            stroke: isLit ? "var(--signal-verified)" : "var(--graphite)",
            strokeWidth: 1.5,
          },
        };
      }),
    [pipeline, nodeStatus]
  );

  if (pipeline.length === 0) {
    return (
      <div
        className="mono"
        style={{
          height: 160,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          border: "1px dashed var(--graphite)",
          borderRadius: "var(--radius)",
          fontSize: 12,
        }}
      >
        awaiting run…
      </div>
    );
  }

  return (
    <div style={{ height: 160, background: "transparent" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--graphite)" gap={18} size={1} />
      </ReactFlow>
    </div>
  );
}