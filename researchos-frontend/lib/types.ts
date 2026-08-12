// PASTE YOUR TYPES HERE
export type Mode = "research" | "compare" | "decision" | "career" | "codebase";

export interface Source {
  title: string;
  url: string;
  snippet?: string;
  published_at?: string | null;
  source?: string | null;
  quality_score: number;
  quality_reason?: string;
}

export interface Claim {
  id: string;
  claim: string;
  confidence: number;
  supporting_source_ids: string[];
  contradicting_source_ids: string[];
  resolution?: string;
}

export interface ComparisonRow {
  criterion: string;
  option_a: string;
  option_b: string;
  winner: "A" | "B" | "Tie";
  reason: string;
  confidence: number;
}

export interface Decision {
  recommendation: string;
  confidence: number;
  reasons: string[];
  risks: string[];
  when_not_to_use: string[];
  next_actions: string[];
}

export interface SkillGap {
  skill: string;
  demand_percent: number;
  user_level: "missing" | "beginner" | "intermediate" | "strong";
  priority: "critical" | "high" | "medium" | "low";
  evidence: string[];
}

export interface CareerReport {
  roles_analyzed: number;
  top_skills: SkillGap[];
  skill_gaps: SkillGap[];
  roadmap: string[];
  portfolio_projects: string[];
}

export interface CodebaseFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  area: string;
  finding: string;
  evidence: string;
  recommendation: string;
}

export interface CodebaseReport {
  repository: string;
  architecture_score: number;
  code_quality_score: number;
  security_score: number;
  documentation_score: number;
  testing_score: number;
  summary: string;
  findings: CodebaseFinding[];
  quick_wins: string[];
}

export interface FinalReport {
  title: string;
  executive_summary: string;
  key_insights: string[];
  decision?: Decision | null;
  comparison: ComparisonRow[];
  career?: CareerReport | null;
  codebase?: CodebaseReport | null;
}

export interface RunRequest {
  mode: Mode;
  query?: string;
  option_a?: string;
  option_b?: string;
  goal?: string;
  constraints?: string[];
  target_role?: string;
  experience?: string;
  current_skills?: string[];
  location?: string;
  repo_url?: string;
}

export type NodeStatus = "idle" | "active" | "done" | "error";

export interface LogEntry {
  id: string;
  node: string;
  timestamp: string;
  summary: string;
}

/** Raw shapes coming off the SSE stream — loosely typed on purpose. */
export interface MetaEvent {
  pipeline: string[];
  mode: Mode;
}

export interface NodeEvent {
  node: string;
  output: Record<string, unknown>;
}