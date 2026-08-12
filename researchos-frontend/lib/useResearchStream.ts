// PASTE YOUR useResearchStream HOOK HERE
"use client";

import { useCallback, useRef, useState } from "react";
import type {
  CareerReport,
  Claim,
  CodebaseReport,
  ComparisonRow,
  Decision,
  FinalReport,
  LogEntry,
  NodeStatus,
  RunRequest,
  Source,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_RESEARCHOS_API ?? "http://localhost:8000";

interface StreamState {
  pipeline: string[];
  nodeStatus: Record<string, NodeStatus>;
  log: LogEntry[];
  sources: Source[];
  claims: Claim[];
  comparison: ComparisonRow[];
  decision: Decision | null;
  career: CareerReport | null;
  codebase: CodebaseReport | null;
  final: FinalReport | null;
  running: boolean;
  error: string | null;
}

const INITIAL_STATE: StreamState = {
  pipeline: [],
  nodeStatus: {},
  log: [],
  sources: [],
  claims: [],
  comparison: [],
  decision: null,
  career: null,
  codebase: null,
  final: null,
  running: false,
  error: null,
};

/** One line of human-readable narration per node, for the terminal log. */
function summarize(node: string, output: Record<string, unknown>): string {
  switch (node) {
    case "router":
      return `routed to "${output.mode}" · ${(output.queries as unknown[] | undefined)?.length ?? 0} queries planned`;
    case "research":
      return `pulled ${(output.raw_results as unknown[] | undefined)?.length ?? 0} raw results`;
    case "evaluate":
      return `scored ${(output.sources as unknown[] | undefined)?.length ?? 0} sources · extracted ${(output.claims as unknown[] | undefined)?.length ?? 0} claims`;
    case "compare":
      return `built ${(output.comparison as unknown[] | undefined)?.length ?? 0} comparison rows`;
    case "decision":
      return output.decision ? "recommendation drafted" : "skipped (not applicable to this mode)";
    case "career":
      return output.career ? "market report drafted" : "skipped (not applicable to this mode)";
    case "codebase":
      return output.codebase ? "repository audited" : "skipped (not applicable to this mode)";
    case "synthesize":
      return "final report synthesized";
    default:
      return "completed";
  }
}

export function useResearchStream() {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (req: RunRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL_STATE, running: true });

    try {
      const res = await fetch(`${API_BASE}/run/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.replace("event: ", "").trim();
          const data = JSON.parse(dataLine.replace("data: ", ""));

          setState((prev) => applyEvent(prev, event, data));
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((prev) => ({ ...prev, running: false, error: (err as Error).message }));
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, running: false }));
  }, []);

  return { ...state, run, cancel };
}

function applyEvent(prev: StreamState, event: string, data: any): StreamState {
  switch (event) {
    case "meta": {
      const nodeStatus: Record<string, NodeStatus> = {};
      data.pipeline.forEach((n: string, i: number) => {
        nodeStatus[n] = i === 0 ? "active" : "idle";
      });
      return { ...prev, pipeline: data.pipeline, nodeStatus };
    }

    case "node": {
      const { node, output } = data;
      const entry: LogEntry = {
        id: `${node}-${Date.now()}`,
        node,
        timestamp: new Date().toLocaleTimeString(),
        summary: summarize(node, output ?? {}),
      };

      // Mark this node done and, since the pipeline runs roughly in
      // declared order, optimistically light up the next node as active
      // so the graph feels alive between SSE frames rather than jumping.
      const nextStatus: Record<string, NodeStatus> = { ...prev.nodeStatus, [node]: "done" };
      const idx = prev.pipeline.indexOf(node);
      const nextNode = prev.pipeline[idx + 1];
      if (nextNode && nextStatus[nextNode] === "idle") {
        nextStatus[nextNode] = "active";
      }

      return {
        ...prev,
        nodeStatus: nextStatus,
        log: [...prev.log, entry],
        sources: output?.sources ?? prev.sources,
        claims: output?.claims ?? prev.claims,
        comparison: output?.comparison ?? prev.comparison,
        decision: output?.decision ?? prev.decision,
        career: output?.career ?? prev.career,
        codebase: output?.codebase ?? prev.codebase,
        final: output?.final ?? prev.final,
      };
    }

    case "done":
      return { ...prev, running: false };

    case "error":
      return { ...prev, running: false, error: data.message };

    default:
      return prev;
  }
}