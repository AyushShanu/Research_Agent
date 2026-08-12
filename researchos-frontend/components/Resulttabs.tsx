"use client";

import { useState } from "react";
import { Sparkles, Target, GitCompare, Briefcase, Bug, Search, Braces, ExternalLink } from "lucide-react";
import type {
  CareerReport,
  Claim,
  CodebaseReport,
  ComparisonRow,
  Decision,
  FinalReport,
  Source,
} from "../lib/types";

type TabId = "intelligence" | "decision" | "comparison" | "career" | "codebase" | "evidence" | "raw";

const TABS: { id: TabId; label: string; icon: typeof Sparkles }[] = [
  { id: "intelligence", label: "Intelligence", icon: Sparkles },
  { id: "decision", label: "Decision", icon: Target },
  { id: "comparison", label: "Comparison", icon: GitCompare },
  { id: "career", label: "Career", icon: Briefcase },
  { id: "codebase", label: "Codebase", icon: Bug },
  { id: "evidence", label: "Evidence", icon: Search },
  { id: "raw", label: "Raw Output", icon: Braces },
];

const panel: React.CSSProperties = {
  border: "1px solid var(--graphite)",
  borderRadius: 12,
  background: "var(--panel)",
  padding: 22,
};

function Empty({ text }: { text: string }) {
  return <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>{text}</p>;
}

function Bar({ percent, color }: { percent: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "var(--abyss)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(Math.max(percent, 0), 100)}%`, background: color, borderRadius: 3 }} />
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        color,
        border: `1px solid ${color}55`,
        background: `${color}14`,
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {text}
    </span>
  );
}

/* ---------- Intelligence ---------- */
function IntelligenceTab({ final }: { final: FinalReport | null }) {
  if (!final) return <Empty text="Run the agent to generate an intelligence report." />;
  return (
    <div style={panel}>
      <h2 style={{ fontSize: 22, marginTop: 0 }}>{final.title}</h2>
      <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>{final.executive_summary}</p>
      {final.key_insights.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 11, color: "var(--signal-verified)", marginTop: 18, marginBottom: 8, letterSpacing: "0.06em" }}>
            KEY INSIGHTS
          </div>
          <ul style={{ lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
            {final.key_insights.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ---------- Decision ---------- */
function DecisionTab({ decision }: { decision: Decision | null }) {
  if (!decision) return <Empty text="No decision generated — this mode only runs for Research/Decision agent modes." />;
  return (
    <div style={panel}>
      <div
        style={{
          border: "1px solid var(--signal-verified)55",
          background: "var(--signal-verified)12",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 20,
          color: "var(--signal-verified)",
          fontWeight: 600,
        }}
      >
        {decision.recommendation}
      </div>

      <div style={{ display: "flex", gap: 32, marginBottom: 20 }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>CONFIDENCE</div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{decision.confidence}%</div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>REASONS</div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{decision.reasons.length}</div>
        </div>
      </div>

      {decision.reasons.length > 0 && (
        <Section title="Why">
          {decision.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </Section>
      )}
      {decision.risks.length > 0 && (
        <Section title="Risks" color="var(--signal-contradiction)">
          {decision.risks.map((r, i) => <li key={i}>{r}</li>)}
        </Section>
      )}
      {decision.when_not_to_use.length > 0 && (
        <Section title="When not to use it">
          {decision.when_not_to_use.map((r, i) => <li key={i}>{r}</li>)}
        </Section>
      )}
      {decision.next_actions.length > 0 && (
        <Section title="Next actions">
          {decision.next_actions.map((r, i) => <li key={i}>{r}</li>)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="mono" style={{ fontSize: 11, color: color ?? "var(--signal-active)", marginBottom: 8, letterSpacing: "0.06em" }}>
        {title.toUpperCase()}
      </div>
      <ul style={{ lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>{children}</ul>
    </div>
  );
}

/* ---------- Comparison ---------- */
function ComparisonTab({ rows }: { rows: ComparisonRow[] }) {
  if (rows.length === 0) return <Empty text="No comparison generated — this mode only runs for Compare agent mode." />;
  return (
    <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--abyss)" }}>
            {["Criterion", "Option A", "Option B", "Winner", "Confidence", "Reason"].map((h) => (
              <th key={h} className="mono" style={{ textAlign: "left", padding: "10px 14px", fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const winColor = row.winner === "A" ? "var(--signal-active)" : row.winner === "B" ? "var(--signal-verified)" : "var(--text-muted)";
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--graphite)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{row.criterion}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{row.option_a}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{row.option_b}</td>
                <td style={{ padding: "10px 14px" }}><Badge text={row.winner} color={winColor} /></td>
                <td style={{ padding: "10px 14px" }}>{row.confidence}%</td>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)", maxWidth: 260 }}>{row.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Career ---------- */
const priorityColor: Record<string, string> = {
  critical: "var(--signal-contradiction)",
  high: "var(--signal-verified)",
  medium: "var(--signal-active)",
  low: "var(--text-muted)",
};

function CareerTab({ career }: { career: CareerReport | null }) {
  if (!career) return <Empty text="No career report generated — this mode only runs for Career agent mode." />;
  return (
    <div style={panel}>
      <div style={{ display: "flex", gap: 32, marginBottom: 22 }}>
        <Metric label="Signals analyzed" value={career.roles_analyzed} />
        <Metric label="Skills mapped" value={career.top_skills.length} />
        <Metric label="Skill gaps" value={career.skill_gaps.length} />
      </div>

      {career.top_skills.length > 0 && (
        <Section title="Market demand">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, listStyle: "none", marginLeft: -18 }}>
            {career.top_skills.map((s, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span>{s.skill}</span>
                  <span style={{ color: "var(--text-muted)" }}>{s.demand_percent}%</span>
                </div>
                <Bar percent={s.demand_percent} color="var(--signal-active)" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {career.skill_gaps.length > 0 && (
        <Section title="Your skill gaps">
          {career.skill_gaps.map((s, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, listStyleType: "none", marginLeft: -18, marginBottom: 6 }}>
              <Badge text={s.priority} color={priorityColor[s.priority] ?? "var(--text-muted)"} />
              <span style={{ fontWeight: 600 }}>{s.skill}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>current: {s.user_level}</span>
            </li>
          ))}
        </Section>
      )}

      {career.roadmap.length > 0 && (
        <Section title="30-day roadmap">
          {career.roadmap.map((r, i) => (
            <li key={i}><strong>Week {Math.floor(i / 2) + 1}:</strong> {r}</li>
          ))}
        </Section>
      )}

      {career.portfolio_projects.length > 0 && (
        <Section title="Portfolio projects">
          {career.portfolio_projects.map((p, i) => <li key={i}>{p}</li>)}
        </Section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/* ---------- Codebase ---------- */
const severityColor: Record<string, string> = {
  critical: "var(--signal-contradiction)",
  high: "#ff9f43",
  medium: "var(--signal-verified)",
  low: "var(--signal-active)",
  info: "var(--text-muted)",
};

function CodebaseTab({ codebase }: { codebase: CodebaseReport | null }) {
  if (!codebase) return <Empty text="No codebase audit generated — this mode only runs for Codebase agent mode." />;
  const scores: [string, number][] = [
    ["Architecture", codebase.architecture_score],
    ["Quality", codebase.code_quality_score],
    ["Security", codebase.security_score],
    ["Docs", codebase.documentation_score],
    ["Testing", codebase.testing_score],
  ];

  return (
    <div style={panel}>
      <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>{codebase.repository}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
        {scores.map(([label, val]) => (
          <div key={label} style={{ border: "1px solid var(--graphite)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{val}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>{label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>{codebase.summary}</p>

      {codebase.findings.length > 0 && (
        <Section title="Findings">
          {codebase.findings.map((f, i) => (
            <li key={i} style={{ listStyleType: "none", marginLeft: -18, marginBottom: 14, borderLeft: `3px solid ${severityColor[f.severity]}`, paddingLeft: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <Badge text={f.severity} color={severityColor[f.severity]} />
                <span style={{ fontWeight: 600 }}>{f.area}</span>
              </div>
              <div>{f.finding}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
                <strong>Evidence:</strong> {f.evidence}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                <strong>Fix:</strong> {f.recommendation}
              </div>
            </li>
          ))}
        </Section>
      )}

      {codebase.quick_wins.length > 0 && (
        <Section title="Quick wins">
          {codebase.quick_wins.map((q, i) => <li key={i}>{q}</li>)}
        </Section>
      )}
    </div>
  );
}

/* ---------- Evidence ---------- */
function EvidenceTab({ sources, claims }: { sources: Source[]; claims: Claim[] }) {
  if (sources.length === 0) return <Empty text="No sources yet — check your TAVILY_API_KEY and run the agent." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sources.map((s, i) => (
        <div key={i} style={{ ...panel, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>
              S{i + 1} · {s.title || "Untitled source"}
            </div>
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, flexShrink: 0 }}>
                open <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div style={{ marginTop: 8, marginBottom: 6 }}>
            <Bar percent={s.quality_score} color="var(--signal-verified)" />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 8 }}>
            QUALITY {s.quality_score}/100
          </div>
          {s.quality_reason && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 6px" }}>{s.quality_reason}</p>}
          {s.snippet && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>{s.snippet.slice(0, 400)}</p>}
        </div>
      ))}

      {claims.length > 0 && (
        <div style={panel}>
          <div className="mono" style={{ fontSize: 11, color: "var(--signal-active)", marginBottom: 10, letterSpacing: "0.06em" }}>
            CLAIM → EVIDENCE
          </div>
          {claims.map((c) => (
            <details key={c.id} style={{ marginBottom: 10, borderBottom: "1px solid var(--graphite)", paddingBottom: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>
                <span className="mono" style={{ color: "var(--signal-verified)" }}>{c.id}</span> · {c.confidence}% · {c.claim}
              </summary>
              <div style={{ marginTop: 8, fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                {c.supporting_source_ids.length > 0 && (
                  <div style={{ color: "var(--signal-verified)" }}>Supporting: {c.supporting_source_ids.join(", ")}</div>
                )}
                {c.contradicting_source_ids.length > 0 && (
                  <div style={{ color: "var(--signal-contradiction)" }}>Contradicting: {c.contradicting_source_ids.join(", ")}</div>
                )}
                {c.resolution && <div style={{ color: "var(--text-muted)" }}>{c.resolution}</div>}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Raw ---------- */
function RawTab({ data }: { data: unknown }) {
  return (
    <pre className="mono" style={{ ...panel, fontSize: 11.5, overflowX: "auto", lineHeight: 1.6 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

/* ---------- Root ---------- */
interface ResultTabsProps {
  final: FinalReport | null;
  decision: Decision | null;
  comparison: ComparisonRow[];
  career: CareerReport | null;
  codebase: CodebaseReport | null;
  sources: Source[];
  claims: Claim[];
}

export default function ResultTabs(props: ResultTabsProps) {
  const [tab, setTab] = useState<TabId>("intelligence");

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--graphite)", marginBottom: 20, overflowX: "auto" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="mono"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                fontSize: 12.5,
                background: "none",
                border: "none",
                borderBottom: `2px solid ${active ? "var(--signal-active)" : "transparent"}`,
                color: active ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "intelligence" && <IntelligenceTab final={props.final} />}
      {tab === "decision" && <DecisionTab decision={props.decision} />}
      {tab === "comparison" && <ComparisonTab rows={props.comparison} />}
      {tab === "career" && <CareerTab career={props.career} />}
      {tab === "codebase" && <CodebaseTab codebase={props.codebase} />}
      {tab === "evidence" && <EvidenceTab sources={props.sources} claims={props.claims} />}
      {tab === "raw" && <RawTab data={props} />}
    </div>
  );
}