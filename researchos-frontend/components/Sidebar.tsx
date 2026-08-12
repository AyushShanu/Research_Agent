"use client";

import { Compass, Target, GitCompare, Briefcase, Bug } from "lucide-react";
import type { Mode } from "../lib/types";

const MODES: { id: Mode; label: string; icon: typeof Compass; hint: string }[] = [
  { id: "research", label: "Research", icon: Compass, hint: "Investigate a topic" },
  { id: "decision", label: "Decision", icon: Target, hint: "Recommend an option" },
  { id: "compare", label: "Compare", icon: GitCompare, hint: "A vs B" },
  { id: "career", label: "Career", icon: Briefcase, hint: "Market vs your skills" },
  { id: "codebase", label: "Codebase", icon: Bug, hint: "Audit a GitHub repo" },
];

interface SidebarProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  query: string;
  setQuery: (v: string) => void;
  optionA: string;
  setOptionA: (v: string) => void;
  optionB: string;
  setOptionB: (v: string) => void;
  goal: string;
  setGoal: (v: string) => void;
  constraints: string;
  setConstraints: (v: string) => void;
  targetRole: string;
  setTargetRole: (v: string) => void;
  experience: string;
  setExperience: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  currentSkills: string;
  setCurrentSkills: (v: string) => void;
  repoUrl: string;
  setRepoUrl: (v: string) => void;
  onRun: () => void;
  running: boolean;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label
        className="mono"
        style={{
          display: "block",
          fontSize: 10.5,
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--graphite)",
  background: "var(--abyss)",
  color: "var(--text)",
  fontSize: 13.5,
  fontFamily: "var(--font-body)",
  resize: "vertical",
};

export default function Sidebar(props: SidebarProps) {
  const { mode, setMode, onRun, running } = props;

  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        borderRight: "1px solid var(--graphite)",
        padding: "28px 22px",
        height: "100vh",
        overflowY: "auto",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: "linear-gradient(135deg, var(--signal-active), var(--signal-verified))",
          }}
        />
        <span className="mono" style={{ fontWeight: 600, fontSize: 14, letterSpacing: "0.02em" }}>
          ResearchOS
        </span>
      </div>

      <Field label="Agent mode">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: `1px solid ${active ? "var(--signal-active)" : "var(--graphite)"}`,
                  background: active ? "var(--signal-active)14" : "transparent",
                  color: active ? "var(--text)" : "var(--text-muted)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon size={15} strokeWidth={2} color={active ? "var(--signal-active)" : "var(--text-muted)"} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{m.hint}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      {(mode === "research" || mode === "decision") && (
        <Field label="Research question">
          <textarea
            style={{ ...inputStyle, minHeight: 80 }}
            value={props.query}
            onChange={(e) => props.setQuery(e.target.value)}
            placeholder="Should I learn LangGraph or CrewAI?"
          />
        </Field>
      )}

      {mode === "compare" && (
        <>
          <Field label="Option A">
            <input style={inputStyle} value={props.optionA} onChange={(e) => props.setOptionA(e.target.value)} placeholder="Supabase" />
          </Field>
          <Field label="Option B">
            <input style={inputStyle} value={props.optionB} onChange={(e) => props.setOptionB(e.target.value)} placeholder="Firebase" />
          </Field>
        </>
      )}

      {mode === "career" && (
        <>
          <Field label="Target role">
            <input style={inputStyle} value={props.targetRole} onChange={(e) => props.setTargetRole(e.target.value)} placeholder="AI Engineer" />
          </Field>
          <Field label="Experience">
            <input style={inputStyle} value={props.experience} onChange={(e) => props.setExperience(e.target.value)} placeholder="1 year" />
          </Field>
          <Field label="Location">
            <input style={inputStyle} value={props.location} onChange={(e) => props.setLocation(e.target.value)} placeholder="India" />
          </Field>
          <Field label="Current skills (one per line)">
            <textarea
              style={{ ...inputStyle, minHeight: 70 }}
              value={props.currentSkills}
              onChange={(e) => props.setCurrentSkills(e.target.value)}
              placeholder={"Python\nReact\nLangGraph"}
            />
          </Field>
        </>
      )}

      {mode === "codebase" && (
        <Field label="Public GitHub repository">
          <input style={inputStyle} value={props.repoUrl} onChange={(e) => props.setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
        </Field>
      )}

      <Field label="Goal (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 56 }}
          value={props.goal}
          onChange={(e) => props.setGoal(e.target.value)}
          placeholder="What are you trying to achieve?"
        />
      </Field>

      <Field label="Constraints (one per line, optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 56 }}
          value={props.constraints}
          onChange={(e) => props.setConstraints(e.target.value)}
          placeholder={"Budget: low\nTime: 30 days"}
        />
      </Field>

      <button
        onClick={onRun}
        disabled={running}
        className="mono"
        style={{
          width: "100%",
          marginTop: 8,
          padding: "12px 0",
          borderRadius: 8,
          border: "none",
          background: running ? "var(--signal-done)" : "linear-gradient(135deg, var(--signal-active), var(--signal-verified))",
          color: "var(--abyss)",
          fontWeight: 700,
          fontSize: 12.5,
          letterSpacing: "0.04em",
          cursor: running ? "not-allowed" : "pointer",
        }}
      >
        {running ? "RUNNING…" : "RUN AGENT"}
      </button>
    </aside>
  );
}