# ResearchOS

> An evidence-first AI research agent that plans, verifies, and synthesizes answers — built on a streaming LangGraph pipeline and a modern Next.js front end.

ResearchOS is not a chatbot. It is a multi-stage research system that turns an open-ended question into a structured, citation-backed intelligence report. Every claim is anchored to a real source, every source is scored for quality, and every final report explicitly separates evidence from inference.

The repository contains two services:

| Service | Path | Role |
| --- | --- | --- |
| `researchos-backend` | Python · FastAPI · LangGraph | The reasoning engine, search, evaluation, and synthesis |
| `researchos-frontend` | TypeScript · Next.js 16 · React 19 | The operator UI, pipeline visualizer, and result viewer |

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Key features](#key-features)
3. [Operating modes](#operating-modes)
4. [Architecture](#architecture)
5. [Repository layout](#repository-layout)
6. [Quick start](#quick-start)
7. [Configuration](#configuration)
8. [API reference](#api-reference)
9. [Swapping the LLM provider or model](#swapping-the-llm-provider-or-model)
10. [Swapping the search provider](#swapping-the-search-provider)
11. [Quality, safety, and limitations](#quality-safety-and-limitations)
12. [Development workflow](#development-workflow)
13. [Deployment notes](#deployment-notes)
14. [Troubleshooting](#troubleshooting)
15. [License](#license)

---

## What it does

Given a natural-language brief, ResearchOS will:

1. **Route** the request to the correct analytical mode.
2. **Plan** a set of high-signal web queries.
3. **Collect** evidence from the open web (Tavily) and, when relevant, directly from a public GitHub repository.
4. **Evaluate** every retrieved source for quality (0–100) and extract claims with explicit supporting and contradicting evidence.
5. **Specialize** the analysis for the chosen mode (comparison, decision, career, or codebase audit).
6. **Synthesize** a final report that surfaces the most important findings first, marks uncertainty, and never invents citations.

The output is delivered as a typed `FinalReport` and streamed node-by-node to the UI over Server-Sent Events, so the operator can see the system think.

---

## Key features

- **Five operating modes in one pipeline** — `research`, `compare`, `decision`, `career`, `codebase`.
- **Evidence-first synthesis** — claims carry supporting *and* contradicting source IDs, confidence scores, and explicit resolution notes.
- **Quality scoring on every source** — official docs, primary sources, and government data rank above SEO content.
- **Direct GitHub ingestion** — the codebase mode reads files straight from the GitHub API instead of relying on web search.
- **Streaming UI** — the FastAPI backend emits per-node updates; the Next.js front end visualizes the live graph with `@xyflow/react`.
- **Structured outputs everywhere** — every LLM call uses Pydantic schemas, so the system can never return malformed JSON.
- **Provider-agnostic LLM layer** — swap Groq for OpenAI, Anthropic, Google, Mistral, Ollama, or any OpenAI-compatible endpoint in a few lines.
- **Deterministic generation** — temperature is fixed at `0` so the same input yields the same reasoning trace (modulo live web results).

---

## Operating modes

| Mode | Purpose | Required inputs |
| --- | --- | --- |
| `research` | Open-ended investigation of a topic. | `query` |
| `compare` | Side-by-side comparison of two options across 6–10 criteria. | `option_a`, `option_b`, `goal`, optional `constraints` |
| `decision` | Evidence-backed recommendation for a single choice. | `query`, `goal`, optional `constraints` |
| `career` | Market-demand analysis and skill-gap roadmap for a target role. | `target_role`, `experience`, `current_skills`, optional `location` |
| `codebase` | AI code audit across architecture, quality, security, docs, and testing. | `repo_url` (public GitHub) |

If `mode` is omitted, the router LLM picks one automatically based on the query.

---

## Architecture

```
┌────────────────────────┐         SSE          ┌──────────────────────────┐
│  Next.js 16 Frontend   │ ◄──────────────────► │   FastAPI API (api.py)   │
│  Sidebar · Graph · Log │                      │  /run/stream · /run      │
└────────────────────────┘                      └─────────────┬────────────┘
                                                              │ astream
                                                              ▼
                                              ┌────────────────────────────┐
                                              │  LangGraph Pipeline         │
                                              │  router → research →        │
                                              │  evaluate → compare →       │
                                              │  decision → career →        │
                                              │  codebase → synthesize      │
                                              └──────┬─────────────┬────────┘
                                                     │             │
                                              ┌──────▼──────┐ ┌────▼────────┐
                                              │   Tavily    │ │  GitHub API │
                                              │   Search    │ │  (codebase) │
                                              └─────────────┘ └─────────────┘
```

The pipeline is a compiled `StateGraph`. Each node receives a `State` TypedDict, returns a partial update, and the state is reduced as it moves down the line. The `router` is the only auto-routing component — every other node is a no-op for modes it does not apply to, which keeps the graph simple and the state predictable.

---

## Repository layout

```
ResearchOS/
├── researchos-backend/
│   ├── research_backend.py     # The LangGraph pipeline (single file, by design)
│   ├── api.py                  # FastAPI wrapper with SSE streaming
│   ├── requirements.txt
│   └── .env                    # API keys live here (never commit)
│
└── researchos-frontend/
    ├── app/
    │   ├── page.tsx            # Main operator UI
    │   └── research/page.tsx   # Alternate deep link
    ├── components/             # Sidebar, PipelineGraph, EventLog, ResultTabs
    ├── lib/
    │   ├── types.ts
    │   └── useResearchStream.ts # SSE client hook
    └── .env.local              # NEXT_PUBLIC_RESEARCHOS_API
```

---

## Quick start

### Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- A Groq API key (or a key for any provider you intend to swap in — see [Swapping the LLM provider or model](#swapping-the-llm-provider-or-model))
- A Tavily API key for web search (optional; the system falls back gracefully if it is missing)
- A GitHub personal access token (optional, but strongly recommended for the `codebase` mode to avoid rate limits)

### 1. Clone and configure the backend

```bash
cd researchos-backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env .env.local                 # then edit .env.local with your keys
```

The `.env` file expects:

```ini
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
TAVILY_API_KEY=your_tavily_key
GITHUB_TOKEN=your_github_pat      # optional
```

### 2. Start the backend

```bash
uvicorn api:app --reload --port 8000
```

A `GET /health` should now return `{"status": "ok"}`.

### 3. Configure and start the frontend

In a second terminal:

```bash
cd researchos-frontend
npm install
echo "NEXT_PUBLIC_RESEARCHOS_API=http://localhost:8000" > .env.local
npm run dev
```

Open <http://localhost:3000> and pick a mode from the sidebar to run your first query.

---

## Configuration

All backend configuration is environment-driven, read via `python-dotenv` at process start.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes (for default provider) | API key for the Groq Chat Completions endpoint. |
| `GROQ_MODEL` | No | Model identifier, default `llama-3.3-70b-versatile`. |
| `TAVILY_API_KEY` | No | Tavily search key. When missing, the `research` node returns empty results and downstream nodes adapt. |
| `GITHUB_TOKEN` | No | A PAT raises the unauthenticated 60 req/hr limit to 5,000 req/hr. Required for serious codebase audits. |

The frontend only needs `NEXT_PUBLIC_RESEARCHOS_API`, which is the origin of the FastAPI server. For production, point it at your deployed API URL (e.g. `https://api.your-domain.com`).

---

## API reference

The backend exposes a small, stable surface.

### `POST /run/stream`

Streams the pipeline as Server-Sent Events.

**Request body** (`RunRequest`):

```json
{
  "mode": "decision",
  "query": "Should I learn LangGraph or CrewAI for AI engineering?",
  "goal": "Become a production-focused AI engineer.",
  "constraints": ["TypeScript only", "Must support streaming"],
  "option_a": "",
  "option_b": "",
  "target_role": "",
  "experience": "",
  "current_skills": [],
  "location": "",
  "repo_url": ""
}
```

**Events emitted**:

| Event | Payload |
| --- | --- |
| `meta` | `{ "pipeline": [...nodes], "mode": "..." }` — emitted once on connect. |
| `node` | `{ "node": "evaluate", "output": { ...partial state... } }` — emitted as each node finishes. |
| `done` | `{ "status": "complete" }` — terminal success event. |
| `error` | `{ "message": "..." }` — emitted on any exception. |

### `POST /run`

Same request body, returns the final `State` as a single JSON response. Useful for batch jobs, scripts, and tests.

### `GET /health`

Liveness probe, returns `{"status": "ok"}`.

---

## Swapping the LLM provider or model

The pipeline deliberately uses a single `llm` constant so that swapping providers is a one-file change. Open `researchos-backend/research_backend.py` and find:

```python
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
llm = ChatGroq(model=MODEL, temperature=0)
```

### Use a different Groq model

Set the env var, no code change required:

```ini
GROQ_MODEL=llama-3.1-8b-instant
GROQ_MODEL=openai/gpt-oss-120b
GROQ_MODEL=meta-llama/llama-guard-4-12b
```

### Use OpenAI

```bash
pip install langchain-openai
```

```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model=os.getenv("OPENAI_MODEL", "gpt-4o"), temperature=0)
```

```ini
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

### Use Anthropic Claude

```bash
pip install langchain-anthropic
```

```python
from langchain_anthropic import ChatChatAnthropic  # see langchain-anthropic
llm = ChatAnthropic(model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5"), temperature=0)
```

```ini
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
```

### Use Google Gemini

```bash
pip install langchain-google-genai
```

```python
from langchain_google_genai import ChatGoogleGenerativeAI
llm = ChatGoogleGenerativeAI(model=os.getenv("GEMINI_MODEL", "gemini-2.5-pro"), temperature=0)
```

### Use a local model via Ollama

```bash
pip install langchain-ollama
ollama pull llama3.1:70b
```

```python
from langchain_ollama import ChatOllama
llm = ChatOllama(model=os.getenv("OLLAMA_MODEL", "llama3.1:70b"), temperature=0)
```

### Use any OpenAI-compatible endpoint (Together, Fireworks, vLLM, LM Studio)

```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(
    base_url=os.getenv("OPENAI_BASE_URL"),
    api_key=os.getenv("OPENAI_API_KEY"),
    model=os.getenv("OPENAI_MODEL", "meta-llama/Llama-3.1-70B-Instruct"),
    temperature=0,
)
```

> **Note on structured outputs.** The pipeline calls `llm.with_structured_output(Schema)`. Some providers or models do not support tool-calling. If a provider rejects a structured call, fall back to a prompt-based parser (see LangChain's `with_structured_output(..., method="json_mode")`) or use a more capable model.

> **Note on context window.** The evaluator trims each source to 800 characters and caps total sources at 40 to stay within Groq's TPM. If you move to a provider with a smaller window, lower `MAX_SOURCES` and `MAX_SNIPPET_CHARS` inside `evaluate_sources_node`.

---

## Swapping the search provider

`researchos-backend/research_backend.py` exposes a single `tavily_search` function. To use a different provider (Serper, Bing, Exa, Brave, your own crawler), replace the function body. The function contract is:

```python
def search(query: str, max_results: int = 6) -> List[dict]:
    """Return a list of {"title", "url", "content", "published_at", "source"} dicts."""
```

For example, to use SerpAPI:

```python
from langchain_community.utilities import SerpAPIWrapper

def tavily_search(query: str, max_results: int = 6) -> List[dict]:
    serp = SerpAPIWrapper(serpapi_api_key=os.getenv("SERPAPI_API_KEY"))
    raw = serp.results(query)
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("link", ""),
            "content": r.get("snippet", ""),
            "published_at": None,
            "source": r.get("source", ""),
        }
        for r in raw.get("organic_results", [])[:max_results]
    ]
```

No other file in the backend needs to change.

---

## Quality, safety, and limitations

ResearchOS is designed for evidence, not vibes. The pipeline enforces several quality controls by construction:

- **Source quality scoring** — every retrieved page is scored 0–100 with an explicit `quality_reason`. The synthesis node is biased toward high-scoring sources.
- **Mandatory source coverage** — the evaluator is prompted to produce exactly one `Source` per input result. Low-quality results are scored low, never silently dropped.
- **Contradiction tracking** — claims carry both `supporting_source_ids` and `contradicting_source_ids`, and a `resolution` string that explains the disagreement.
- **Confidence scoring** — every claim, comparison row, and decision carries a 0–100 confidence score. The final editor is instructed to lower confidence when evidence is thin.
- **No invented citations** — the synthesis system prompt forbids fabricating URLs or numbers. If the evidence pack is empty, the report will say so plainly.
- **No fabricated job counts** — the career mode is explicitly told to mark `roles_analyzed = 0` if listings cannot be enumerated, rather than invent demand percentages.
- **Codebase audits are evidence-bounded** — the codebase auditor is forbidden from claiming a security issue unless the inspected code provides reasonable evidence.

### Known limitations

- Web search is only as good as the provider you point it at. If Tavily returns thin results, the report will be thin.
- The codebase mode reads at most 30 source files and 12,000 characters per file. Large monorepos should be audited incrementally.
- `temperature=0` improves reproducibility but is not a guarantee — live web results change between runs.
- The pipeline is single-tenant. If you expose it to the public, add authentication, per-user rate limits, and a job queue.

---

## Development workflow

```bash
# Backend
cd researchos-backend
source .venv/bin/activate
uvicorn api:app --reload --port 8000

# Frontend
cd researchos-frontend
npm run dev
```

The FastAPI server streams the LangGraph state as it runs, so changes to node prompts are visible in the UI on the next reload. There is no test suite checked in yet; the recommended starting point is `pytest` against `run_researchos(...)` with golden JSON fixtures for each mode.

---

## Deployment notes

- **Backend.** Ship the `researchos-backend` directory to any Python 3.11+ host (Fly.io, Railway, Render, a VM, or Cloud Run). Run `uvicorn api:app --host 0.0.0.0 --port 8000 --workers 1` behind a reverse proxy. SSE needs `X-Accel-Buffering: no` if you sit behind nginx — it is already set in `api.py`.
- **Frontend.** Vercel is the path of least resistance. Set `NEXT_PUBLIC_RESEARCHOS_API` to the deployed backend origin and redeploy. The Next.js app is a standard App Router project.
- **CORS.** `api.py` whitelists `http://localhost:3000` by default. Add your production origin to `allow_origins` before shipping.

---

## Troubleshooting

**The pipeline runs but the report is empty.**
Tavily returned no results. Check `TAVILY_API_KEY` and your account quota.

**`codebase` mode fails with 403 from GitHub.**
You have hit the unauthenticated 60 req/hr limit. Set `GITHUB_TOKEN` to a personal access token (no scopes required for public repos).

**Structured output errors on a custom model.**
Your model does not support tool/function calling. Either upgrade to a tool-calling model or switch `with_structured_output(...)` to use `method="json_mode"` and a self-parsing validator.

**CORS error in the browser.**
Add the frontend origin to `allow_origins` in `api.py`.

**Frontend cannot reach the API.**
Check `NEXT_PUBLIC_RESEARCHOS_API` in `.env.local` and confirm the backend is reachable on that origin.

---

## License

This project is provided as-is for evaluation and internal use. Add a license file before public distribution.
