// PASTE YOUR EventLog COMPONENT HERE
"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "../lib/types";

interface EventLogProps {
  log: LogEntry[];
  running: boolean;
}

export default function EventLog({ log, running }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [log.length]);

  return (
    <div
      ref={scrollRef}
      className="mono"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--graphite)",
        borderRadius: "var(--radius)",
        padding: "14px 16px",
        height: 220,
        overflowY: "auto",
        fontSize: 12.5,
        lineHeight: 1.7,
      }}
    >
      {log.length === 0 && !running && (
        <div style={{ color: "var(--text-muted)" }}>{"> idle — run the agent to see it think"}</div>
      )}

      {log.map((entry) => (
        <div key={entry.id} style={{ display: "flex", gap: 10 }}>
          <span style={{ color: "var(--text-muted)" }}>{entry.timestamp}</span>
          <span style={{ color: "var(--signal-verified)" }}>[{entry.node}]</span>
          <span style={{ color: "var(--text)" }}>{entry.summary}</span>
        </div>
      ))}

      {running && (
        <div style={{ color: "var(--signal-active)" }}>
          {"> "}
          <span style={{ animation: "blink 1s step-start infinite" }}>▍</span>
          <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
        </div>
      )}
    </div>
  );
}