from __future__ import annotations

from curses import raw
import json
import operator
import os
import re
from datetime import date, timedelta
from typing import Annotated, List, Literal, Optional, TypedDict
from urllib.parse import urlparse
from pathlib import Path

import requests
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import BaseModel, Field

load_dotenv()

# ============================================================
# ResearchOS Backend
# Research -> Evidence -> Verification -> Synthesis -> Decision
# Supports:
#   research, compare, decision, career, codebase
# ============================================================

MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
llm = ChatGroq(model=MODEL, temperature=0)

Mode = Literal["research", "compare", "decision", "career", "codebase"]


# -----------------------------
# Schemas
# -----------------------------

class Source(BaseModel):
    title: str
    url: str
    snippet: str = ""
    published_at: Optional[str] = None
    source: Optional[str] = None
    quality_score: int = Field(default=0, ge=0, le=100)
    quality_reason: str = ""


class Claim(BaseModel):
    id: str
    claim: str
    confidence: int = Field(ge=0, le=100)
    supporting_source_ids: List[str] = Field(default_factory=list)
    contradicting_source_ids: List[str] = Field(default_factory=list)
    resolution: str = ""


class ResearchPack(BaseModel):
    sources: List[Source] = Field(default_factory=list)
    claims: List[Claim] = Field(default_factory=list)


class ComparisonRow(BaseModel):
    criterion: str
    option_a: str
    option_b: str
    winner: Literal["A", "B", "Tie"]
    reason: str
    confidence: int = Field(ge=0, le=100)


class ComparisonPack(BaseModel):
    rows: List[ComparisonRow] = Field(default_factory=list)


class Decision(BaseModel):
    recommendation: str
    confidence: int = Field(ge=0, le=100)
    reasons: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    when_not_to_use: List[str] = Field(default_factory=list)
    next_actions: List[str] = Field(default_factory=list)


class SkillGap(BaseModel):
    skill: str
    demand_percent: int = Field(ge=0, le=100)
    user_level: Literal["missing", "beginner", "intermediate", "strong"] = "missing"
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    evidence: List[str] = Field(default_factory=list)


class CareerReport(BaseModel):
    roles_analyzed: int = 0
    top_skills: List[SkillGap] = Field(default_factory=list)
    skill_gaps: List[SkillGap] = Field(default_factory=list)
    roadmap: List[str] = Field(default_factory=list)
    portfolio_projects: List[str] = Field(default_factory=list)


class CodebaseFinding(BaseModel):
    severity: Literal["critical", "high", "medium", "low", "info"]
    area: str
    finding: str
    evidence: str
    recommendation: str


class CodebaseReport(BaseModel):
    repository: str
    architecture_score: int = Field(ge=0, le=100)
    code_quality_score: int = Field(ge=0, le=100)
    security_score: int = Field(ge=0, le=100)
    documentation_score: int = Field(ge=0, le=100)
    testing_score: int = Field(ge=0, le=100)
    summary: str
    findings: List[CodebaseFinding] = Field(default_factory=list)
    quick_wins: List[str] = Field(default_factory=list)


class FinalReport(BaseModel):
    title: str
    executive_summary: str
    key_insights: List[str] = Field(default_factory=list)
    decision: Optional[Decision] = None
    comparison: List[ComparisonRow] = Field(default_factory=list)
    career: Optional[CareerReport] = None
    codebase: Optional[CodebaseReport] = None


class State(TypedDict, total=False):
    mode: str
    query: str
    as_of: str
    recency_days: int

    # compare / decision
    option_a: str
    option_b: str
    goal: str
    constraints: List[str]

    # career
    target_role: str
    experience: str
    current_skills: List[str]
    location: str

    # codebase
    repo_url: str

    queries: List[str]
    raw_results: List[dict]
    sources: List[Source]
    claims: List[Claim]

    comparison: List[ComparisonRow]
    decision: Optional[Decision]
    career: Optional[CareerReport]
    codebase: Optional[CodebaseReport]

    # parallel research tasks
    sections: Annotated[List[dict], operator.add]

    final: Optional[FinalReport]


# -----------------------------
# Search
# -----------------------------

def tavily_search(query: str, max_results: int = 6) -> List[dict]:
    if not os.getenv("TAVILY_API_KEY"):
        return []

    try:
       
        from langchain_tavily import TavilySearch

        tool = TavilySearch(max_results=max_results)
        response = tool.invoke({"query": query})
        results = response.get("results", []) if isinstance(response, dict) else response

        output = []
        for item in results or []:
            output.append({
                "title": item.get("title") or "",
                "url": item.get("url") or "",
                "content": item.get("content") or item.get("snippet") or "",
                "published_at": item.get("published_date") or item.get("published_at"),
                "source": item.get("source"),
            })
        return output
    except Exception as exc:
        return [{"error": str(exc)}]


# -----------------------------
# GitHub inspection
# -----------------------------

def parse_github_url(repo_url: str) -> tuple[str, str]:
    parsed = urlparse(repo_url.strip())
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        raise ValueError("Only public GitHub repository URLs are supported.")

    parts = [p for p in parsed.path.strip("/").split("/") if p]
    if len(parts) < 2:
        raise ValueError("Invalid GitHub repository URL.")

    return parts[0], parts[1]


def github_get(path: str):
    url = f"https://api.github.com/{path.lstrip('/')}"
    headers = {"Accept": "application/vnd.github+json"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = requests.get(url, headers=headers, timeout=20)
    response.raise_for_status()
    return response.json()


def fetch_github_context(repo_url: str) -> dict:
    owner, repo = parse_github_url(repo_url)

    repo_info = github_get(f"repos/{owner}/{repo}")
    branch = repo_info.get("default_branch", "main")

    tree = github_get(f"repos/{owner}/{repo}/git/trees/{branch}?recursive=1")
    files = tree.get("tree", [])

    interesting = []
    allowed = {
        ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".md",
        ".yml", ".yaml", ".toml", ".txt", ".sql"
    }

    for item in files:
        if item.get("type") != "blob":
            continue

        path = item.get("path", "")
        suffix = Path(path).suffix.lower()

        if (
            suffix in allowed
            or Path(path).name.lower() in {
                "dockerfile", "readme", "readme.md", ".env.example",
                "package.json", "requirements.txt"
            }
        ):
            interesting.append(path)

    interesting = interesting[:30]

    snippets = []
    for path in interesting:
        try:
            content = github_get(
                f"repos/{owner}/{repo}/contents/{path}?ref={branch}"
            )
            if content.get("encoding") == "base64":
                import base64
                decoded = base64.b64decode(content.get("content", "")).decode(
                    "utf-8", errors="replace"
                )
                snippets.append({
                    "path": path,
                    "content": decoded[:12000]
                })
        except Exception:
            continue

    return {
        "name": repo_info.get("full_name", f"{owner}/{repo}"),
        "description": repo_info.get("description") or "",
        "stars": repo_info.get("stargazers_count", 0),
        "forks": repo_info.get("forks_count", 0),
        "language": repo_info.get("language") or "",
        "default_branch": branch,
        "files": [x.get("path") for x in files if x.get("type") == "blob"][:500],
        "snippets": snippets,
    }


# -----------------------------
# Router
# -----------------------------

class RouteDecision(BaseModel):
    mode: Mode
    queries: List[str] = Field(default_factory=list)
    reason: str


ROUTER_SYSTEM = """
You are the intent router for ResearchOS.

Choose exactly one mode:
- research: investigate a question/topic and produce evidence-backed insights.
- compare: compare two technologies/products/options.
- decision: research a decision and recommend an option based on the user's goal.
- career: analyze current job-market demand and compare it against the user's skills.
- codebase: audit a public GitHub repository.

Generate 3-8 high-signal web queries for research, comparison, decision, or career.
For career, search current job listings and skill-demand sources.
For codebase, web queries are optional because the backend directly inspects GitHub.
"""


def router_node(state: State) -> dict:
    router = llm.with_structured_output(RouteDecision)

    mode_hint = state.get("mode", "")
    prompt = f"""
User query: {state.get('query', '')}
Requested mode: {mode_hint or 'auto'}
Goal: {state.get('goal', '')}
Option A: {state.get('option_a', '')}
Option B: {state.get('option_b', '')}
Target role: {state.get('target_role', '')}
Repository: {state.get('repo_url', '')}
"""

    result = router.invoke([
        SystemMessage(content=ROUTER_SYSTEM),
        HumanMessage(content=prompt),
    ])

    mode = mode_hint if mode_hint in {
        "research", "compare", "decision", "career", "codebase"
    } else result.mode

    recency_days = 30 if mode in {"career", "decision"} else 90

    return {
        "mode": mode,
        "queries": result.queries,
        "recency_days": recency_days,
    }


# -----------------------------
# Research
# -----------------------------

def research_node(state: State) -> dict:
    if state.get("mode") == "codebase":
        return {}

    queries = state.get("queries") or []
    raw = []

    for query in queries[:8]:
        raw.extend(tavily_search(query, max_results=6))

    raw = [x for x in raw if x.get("url") and not x.get("error")]

    # Deduplicate before sending to the model.
    seen = set()
    deduped = []
    for item in raw:
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        deduped.append(item)

    return {"raw_results": deduped[:40]}


# -----------------------------
# Source evaluation + claim extraction
# -----------------------------

EVALUATOR_SYSTEM = """
You are a rigorous research verifier.

Turn the provided web results into:
1. Source objects with a 0-100 quality score.
2. Important claims.
3. Supporting and contradicting source IDs.

CRITICAL: you must create exactly one Source object for EVERY result provided
in the input, in the same order, using the same source IDs (S1, S2, S3...).
Do not skip, omit, merge, or drop any result, even if it is low quality or
appears irrelevant — give it a low quality_score instead of excluding it.
The number of Source objects you return must equal the number of results
provided.

Rules:
- Prefer official documentation, primary sources, government sources,
  reputable companies, GitHub repositories, research papers, and direct data.
- Do not invent publication dates.
- A source can have a low quality score even if it is relevant.
- If two sources disagree, explicitly represent the contradiction.
- Keep source snippets concise.
- Use source IDs S1, S2, S3...
- Use claim IDs C1, C2, C3...
"""


def evaluate_sources_node(state: State) -> dict:
    raw = state.get("raw_results", [])

    if not raw:
        return {"sources": [], "claims": []}

    evaluator = llm.with_structured_output(ResearchPack)

    # Keep the evidence pack small enough for Groq's TPM limit.
# We want breadth, but not thousands of tokens of duplicated web text.

    MAX_SOURCES = 40
    MAX_SNIPPET_CHARS = 650

    compact = []

    for idx, item in enumerate(raw[:MAX_SOURCES], 1):
        compact.append({
        "id": f"S{idx}",
        "title": (item.get("title") or "")[:180],
        "url": item.get("url") or "",
        "published_at": item.get("published_at"),
        "source": (item.get("source") or "")[:100],
        "snippet": (item.get("content") or "")[:MAX_SNIPPET_CHARS],
    })

    result = evaluator.invoke([
        SystemMessage(content=EVALUATOR_SYSTEM),
        HumanMessage(content=json.dumps({
            "as_of": state.get("as_of"),
            "results": compact,
        }, ensure_ascii=False)),
    ])

    # Ensure source IDs remain stable for claim references.
    source_lookup = {
        f"S{i}": item for i, item in enumerate(compact, 1)
    }

    for i, source in enumerate(result.sources, 1):
        if not source.url:
            continue
        # If model changed the URL, keep it only if it matches one we supplied.
        source_id = f"S{i}"
        original = source_lookup.get(source_id)
        if original and original["url"]:
            source.url = original["url"]

    return {
        "sources": result.sources,
        "claims": result.claims,
    }


# -----------------------------
# Specialized analysis
# -----------------------------

def compare_node(state: State) -> dict:
    if state.get("mode") != "compare":
        return {}

    sources = [
        s.model_dump() if hasattr(s, "model_dump") else s
        for s in state.get("sources", [])
    ]

    prompt = f"""
Compare these two options:

OPTION A:
{state.get('option_a')}

OPTION B:
{state.get('option_b')}

USER GOAL:
{state.get('goal')}

CONSTRAINTS:
{state.get('constraints', [])}

EVIDENCE:
{json.dumps(sources, ensure_ascii=False)}

Create 6-10 useful comparison criteria.

For every criterion:
- explain Option A
- explain Option B
- choose A, B, or Tie
- explain why
- give a confidence score from 0-100

Use the evidence where factual claims are involved.
Do not invent statistics or facts.
"""

    model = llm.with_structured_output(ComparisonPack)

    result = model.invoke([
        SystemMessage(
            content="""
You are a senior technology comparison analyst.

Your job is to compare two technologies/options using available evidence.

Be precise.
Do not invent facts.
If evidence is insufficient, say so in the reason.
Return structured comparison rows.
"""
        ),
        HumanMessage(content=prompt),
    ])

    # Pydantic structured output
    if isinstance(result, ComparisonPack):
        rows = result.rows

    # Defensive fallback in case the provider returns a dict
    elif isinstance(result, dict):
        rows = result.get("rows", [])

    else:
        rows = []

    # Normalize every row into ComparisonRow objects.
    normalized_rows = []

    for row in rows:
        if isinstance(row, ComparisonRow):
            normalized_rows.append(row)

        elif isinstance(row, dict):
            try:
                normalized_rows.append(
                    ComparisonRow(**row)
                )
            except Exception:
                continue

    return {
        "comparison": normalized_rows
    }

def decision_node(state: State) -> dict:
    if state.get("mode") not in {"decision", "research"}:
        return {}

    prompt = f"""
Question: {state.get('query')}
Goal: {state.get('goal')}
Constraints: {state.get('constraints', [])}

Evidence:
{json.dumps([s.model_dump() for s in state.get('sources', [])], ensure_ascii=False)}

Claims:
{json.dumps([c.model_dump() for c in state.get('claims', [])], ensure_ascii=False)}

Produce a practical recommendation. If evidence is weak, reduce confidence
and explicitly mention uncertainty.
"""

    model = llm.with_structured_output(Decision)
    result = model.invoke([
        SystemMessage(content="""
You are a decision-support analyst.
Never pretend uncertainty is certainty.
Separate evidence-backed reasons from assumptions.
The final recommendation must be actionable.
"""),
        HumanMessage(content=prompt),
    ])

    return {"decision": result}


def career_node(state: State) -> dict:
    if state.get("mode") != "career":
        return {}

    prompt = f"""
Target role: {state.get('target_role')}
Experience: {state.get('experience')}
Location: {state.get('location')}
Current skills: {state.get('current_skills', [])}

Research evidence:
{json.dumps([s.model_dump() for s in state.get('sources', [])], ensure_ascii=False)}

Build a market intelligence report:
- Estimate demand percentages only from the available evidence.
- Identify skill gaps relative to the user's skills.
- Prioritize gaps.
- Give a practical 30-day roadmap.
- Suggest portfolio projects that prove the missing skills.
"""

    model = llm.with_structured_output(CareerReport)
    result = model.invoke([
        SystemMessage(content="""
You are a technical career-market analyst.
Do not fabricate job counts. If exact counts are unavailable, use a
conservative estimate or set roles_analyzed to 0 and explain the limitation.
"""),
        HumanMessage(content=prompt),
    ])

    return {"career": result}


def codebase_node(state: State) -> dict:
    if state.get("mode") != "codebase":
        return {}

    context = fetch_github_context(state.get("repo_url", ""))

    prompt = f"""
Audit this public GitHub repository.

Repository metadata:
{json.dumps({k: v for k, v in context.items() if k != 'snippets'}, ensure_ascii=False)}

Selected source files:
{json.dumps(context.get('snippets', []), ensure_ascii=False)}

Focus on:
- architecture
- code quality
- security
- documentation
- testing
- concrete findings with evidence
- quick wins

Do not claim that a security issue exists unless the inspected code provides
reasonable evidence.
"""

    model = llm.with_structured_output(CodebaseReport)
    result = model.invoke([
        SystemMessage(content="You are a senior software engineer performing an AI codebase audit."),
        HumanMessage(content=prompt),
    ])

    result.repository = context["name"]
    return {"codebase": result}


# -----------------------------
# Parallel research worker
# -----------------------------

def fanout(state: State):
    if state.get("mode") == "codebase":
        return [Send("codebase", state)]

    return [Send("research_worker", {"query": q}) for q in (state.get("queries") or [])[:8]]


def research_worker(payload: dict) -> dict:
    query = payload["query"]
    results = tavily_search(query, max_results=5)
    return {"sections": [{"query": query, "results": results}]}


def reduce_worker_results(state: State) -> dict:
    merged = []
    for section in state.get("sections", []):
        merged.extend(section.get("results", []))

    # Keep unique URLs.
    seen = set()
    unique = []
    for item in merged:
        url = item.get("url")
        if not url or url in seen:
            continue
        seen.add(url)
        unique.append(item)

    return {"raw_results": unique[:18]}


# -----------------------------
# Final synthesis
# -----------------------------

def synthesis_node(state: State) -> dict:
    mode = state.get("mode", "research")

    if mode == "compare":
        title = f"{state.get('option_a')} vs {state.get('option_b')}"
    elif mode == "career":
        title = f"{state.get('target_role')} Career Intelligence"
    elif mode == "codebase":
        title = f"AI Codebase Audit — {state.get('repo_url')}"
    else:
        title = state.get("query", "Research Intelligence Report")

    prompt = {
        "mode": mode,
        "query": state.get("query"),
        "goal": state.get("goal"),
        "sources": [s.model_dump() for s in state.get("sources", [])],
        "claims": [c.model_dump() for c in state.get("claims", [])],
       "comparison": [
    x.model_dump() if hasattr(x, "model_dump") else x
    for x in state.get("comparison", [])
],
        "decision": state.get("decision").model_dump() if state.get("decision") else None,
        "career": state.get("career").model_dump() if state.get("career") else None,
        "codebase": state.get("codebase").model_dump() if state.get("codebase") else None,
    }

    model = llm.with_structured_output(FinalReport)

    result = model.invoke([
        SystemMessage(content="""
You are the final editor for ResearchOS.

Create a concise but high-value intelligence report.
The report must:
- surface the most important findings first;
- distinguish evidence from inference;
- mention uncertainty when evidence conflicts;
- never invent citations or numbers;
- make the output useful for an actual decision.
"""),
        HumanMessage(content=json.dumps(prompt, ensure_ascii=False)),
    ])

    result.title = title
    return {"final": result}


# -----------------------------
# Graph
# -----------------------------

g = StateGraph(State)

g.add_node("router", router_node)
g.add_node("research_fanout", research_worker)
g.add_node("research", research_node)
g.add_node("evaluate", evaluate_sources_node)
g.add_node("compare", compare_node)
g.add_node("decision", decision_node)
g.add_node("career", career_node)
g.add_node("codebase", codebase_node)
g.add_node("synthesize", synthesis_node)

g.add_edge(START, "router")

# Direct research path after routing.
g.add_edge("router", "research")
g.add_edge("research", "evaluate")

g.add_edge("evaluate", "compare")
g.add_edge("compare", "decision")
g.add_edge("decision", "career")
g.add_edge("career", "codebase")
g.add_edge("codebase", "synthesize")
g.add_edge("synthesize", END)

app = g.compile()


def run_researchos(
    *,
    mode: str,
    query: str = "",
    option_a: str = "",
    option_b: str = "",
    goal: str = "",
    constraints: Optional[List[str]] = None,
    target_role: str = "",
    experience: str = "",
    current_skills: Optional[List[str]] = None,
    location: str = "",
    repo_url: str = "",
) -> dict:
    today = date.today().isoformat()

    initial: State = {
        "mode": mode,
        "query": query,
        "option_a": option_a,
        "option_b": option_b,
        "goal": goal,
        "constraints": constraints or [],
        "target_role": target_role,
        "experience": experience,
        "current_skills": current_skills or [],
        "location": location,
        "repo_url": repo_url,
        "as_of": today,
        "recency_days": 30,
        "queries": [],
        "raw_results": [],
        "sources": [],
        "claims": [],
        "comparison": [],
        "decision": None,
        "career": None,
        "codebase": None,
        "sections": [],
        "final": None,
    }

    output = app.invoke(initial)
    return output


if __name__ == "__main__":
    result = run_researchos(
        mode="decision",
        query="Should I learn LangGraph or CrewAI for AI engineering?",
        goal="Become a production-focused AI engineer.",
    )
    print(json.dumps(result.get("final").model_dump(), indent=2, default=str))
