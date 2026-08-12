# api.py — PASTE YOUR CODE BELOW THIS LINE
# (must sit next to research_backend.py — it imports directly from it)
from __future__ import annotations

"""
ResearchOS API
==============
Wraps the LangGraph pipeline in research_backend.py and streams each node's
output to the frontend as it completes, via Server-Sent Events (SSE).

Run:
    uvicorn api:app --reload --port 8000

This file expects research_backend.py (your existing graph) to sit next to
it, exporting: `app` (the compiled StateGraph) and `State`.
"""

import asyncio
import json
from datetime import date
from typing import Any, AsyncGenerator, List, Optional

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Rename to avoid clashing with the FastAPI `app` instance below.
from research_backend import app as graph_app
from research_backend import State

api = FastAPI(title="ResearchOS API", version="1.0.0")

api.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # add your deployed frontend origin too
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The node order in the compiled graph — the frontend uses this to lay out
# the pipeline diagram without having to reverse-engineer graph structure.
PIPELINE_NODES = [
    "router",
    "research",
    "evaluate",
    "compare",
    "decision",
    "career",
    "codebase",
    "synthesize",
]


class RunRequest(BaseModel):
    mode: str
    query: str = ""
    option_a: str = ""
    option_b: str = ""
    goal: str = ""
    constraints: List[str] = []
    target_role: str = ""
    experience: str = ""
    current_skills: List[str] = []
    location: str = ""
    repo_url: str = ""


def sse(event: str, data: Any) -> str:
    """Format one Server-Sent Event frame."""
    payload = json.dumps(jsonable_encoder(data), default=str, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


def build_initial_state(req: RunRequest) -> State:
    return {
        "mode": req.mode,
        "query": req.query,
        "option_a": req.option_a,
        "option_b": req.option_b,
        "goal": req.goal,
        "constraints": req.constraints,
        "target_role": req.target_role,
        "experience": req.experience,
        "current_skills": req.current_skills,
        "location": req.location,
        "repo_url": req.repo_url,
        "as_of": date.today().isoformat(),
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


async def stream_pipeline(req: RunRequest) -> AsyncGenerator[str, None]:
    initial_state = build_initial_state(req)

    yield sse("meta", {"pipeline": PIPELINE_NODES, "mode": req.mode})

    try:
        # stream_mode="updates" yields {node_name: partial_state_update} as
        # each node finishes — exactly what the frontend needs to light up
        # the graph and print a log line, without waiting for the full run.
        async for update in graph_app.astream(initial_state, stream_mode="updates"):
            for node_name, node_output in update.items():
                yield sse("node", {
                    "node": node_name,
                    "output": node_output,
                })
                # Let the event loop flush the chunk to the client promptly.
                await asyncio.sleep(0)

        yield sse("done", {"status": "complete"})

    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        yield sse("error", {"message": str(exc)})


@api.post("/run/stream")
async def run_stream(req: RunRequest):
    return StreamingResponse(
        stream_pipeline(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering if you sit behind it
        },
    )


@api.post("/run")
async def run_sync(req: RunRequest):
    """Non-streaming fallback — returns the full final state at once."""
    initial_state = build_initial_state(req)
    result = await graph_app.ainvoke(initial_state)
    return jsonable_encoder(result, custom_encoder={object: str})


@api.get("/health")
def health():
    return {"status": "ok"}