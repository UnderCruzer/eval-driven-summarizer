import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

from app.database import (
    get_latest_proposal,
    get_proposal,
    init_proposal_db,
    save_proposal,
    update_proposal_status,
)
from eval.analyzer import FailureAnalyzer
from pipeline.improver import PromptImprover, _write_to_prompts
from pipeline.runner import run_eval


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_proposal_db()
    yield


app = FastAPI(title="Eval-Driven Summarizer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)

_running: dict = {}
_sse_queues: list[asyncio.Queue] = []
_autonomy: dict = {"threshold": 4.0, "enabled": False}  # Confidence Signal 설정


def _broadcast(event: dict) -> None:
    data = json.dumps(event, ensure_ascii=False)
    for q in list(_sse_queues):
        q.put_nowait(data)


async def _progress_callback(event: dict) -> None:
    _broadcast(event)
    if event.get("type") == "start":
        _running["total"] = event.get("total", 0)
        _running["done"] = 0
    elif event.get("type") == "progress":
        _running["done"] = event.get("done", 0)


# ── 스키마 ──────────────────────────────────────────────────────────────────

class EvalRunRequest(BaseModel):
    version: str = "v1"
    doc_type: str | None = None


class DecisionRequest(BaseModel):
    edited_system_prompt: str | None = None
    edited_user_template: str | None = None


class PlaygroundRequest(BaseModel):
    version: str = "v1"
    doc_type: str = "news"
    content: str
    key_points: list[str] = []


class CritiqueRequest(BaseModel):
    version: str = "v1"
    doc_type: str = "news"
    content: str
    key_points: list[str] = []


class DebateRequest(BaseModel):
    version: str = "v1"
    doc_type: str = "news"
    content: str
    key_points: list[str] = []


class ExplainRequest(BaseModel):
    version: str = "v1"
    doc_type: str = "news"
    content: str


class AutonomySettings(BaseModel):
    threshold: float = 4.0
    enabled: bool = False


# ── 엔드포인트 ───────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def root():
    html = (static_path / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(content=html)

app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")


@app.post("/eval/run")
async def eval_run(req: EvalRunRequest, background_tasks: BackgroundTasks):
    if _running.get("status") == "running":
        raise HTTPException(status_code=409, detail="이미 Eval이 실행 중입니다.")

    _running["status"] = "running"
    _running["version"] = req.version

    async def _run():
        try:
            results = await run_eval(
                prompt_version=req.version,
                doc_type=req.doc_type,
                on_progress=_progress_callback,
            )
            if not results:
                _running["status"] = "idle"
                return

            import sqlite3
            from pathlib import Path as P
            with sqlite3.connect(P("data/results.db")) as conn:
                row = conn.execute(
                    "SELECT run_id FROM eval_results ORDER BY created_at DESC LIMIT 1"
                ).fetchone()
            run_id = row[0]

            analyzer = FailureAnalyzer()
            report = analyzer.analyze(run_id)

            improver = PromptImprover()
            proposal = improver.propose(report)

            patterns = [
                {
                    "category": p.category,
                    "description": p.description,
                    "frequency": p.frequency,
                    "improvement_hint": p.improvement_hint,
                }
                for p in report.patterns
            ]

            proposal_id = save_proposal(
                base_version=proposal.base_version,
                new_version=proposal.new_version,
                new_system_prompt=proposal.new_system_prompt,
                new_user_template=proposal.new_user_template,
                rationale=proposal.rationale,
                avg_score=report.avg_score,
                weak_metric=report.weak_metric,
                patterns=patterns,
            )
            _running["status"] = "done"
            avg = sum(r.total_score for r in results) / len(results)

            # Confidence Signal — 임계값 이상이면 자동 승인
            auto_approved = False
            if _autonomy["enabled"] and report.avg_score >= _autonomy["threshold"]:
                _write_to_prompts(proposal)
                update_proposal_status(proposal_id, "approved")
                auto_approved = True

            _broadcast({
                "type": "done",
                "avg_score": round(avg, 2),
                "auto_approved": auto_approved,
                "threshold": _autonomy["threshold"] if _autonomy["enabled"] else None,
            })
        except Exception as e:
            _running["status"] = "error"
            _running["error"] = str(e)
            _broadcast({"type": "error", "message": str(e)})

    background_tasks.add_task(_run)
    return {"message": f"Eval {req.version} 시작됨", "status": "running"}


@app.get("/eval/stream")
async def eval_stream():
    """SSE — Eval 진행 상황 실시간 스트리밍."""
    queue: asyncio.Queue = asyncio.Queue()
    _sse_queues.append(queue)

    async def generator() -> AsyncGenerator[str, None]:
        try:
            yield f"data: {json.dumps(_running or {'status': 'idle'})}\n\n"
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {data}\n\n"
                    event = json.loads(data)
                    if event.get("type") in ("done", "error"):
                        break
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            _sse_queues.remove(queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/eval/status")
async def eval_status():
    return _running or {"status": "idle"}


@app.get("/proposals/latest")
async def latest_proposal():
    proposal = get_latest_proposal()
    if not proposal:
        raise HTTPException(status_code=404, detail="제안 없음")
    proposal["patterns"] = json.loads(proposal["patterns"])
    return proposal


@app.post("/proposals/{proposal_id}/approve")
async def approve_proposal(proposal_id: int, req: DecisionRequest):
    proposal = get_proposal(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="제안 없음")
    if proposal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"이미 {proposal['status']} 상태입니다.")

    from pipeline.improver import ImproveProposal
    p = ImproveProposal(
        base_version=proposal["base_version"],
        new_version=proposal["new_version"],
        new_system_prompt=req.edited_system_prompt or proposal["new_system_prompt"],
        new_user_template=req.edited_user_template or proposal["new_user_template"],
        rationale=proposal["rationale"],
    )
    _write_to_prompts(p)
    update_proposal_status(proposal_id, "approved")
    return {"message": f"{p.new_version} 적용 완료", "new_version": p.new_version}


@app.post("/proposals/{proposal_id}/reject")
async def reject_proposal(proposal_id: int):
    proposal = get_proposal(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="제안 없음")
    if proposal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"이미 {proposal['status']} 상태입니다.")
    update_proposal_status(proposal_id, "rejected")
    return {"message": "제안 거절됨"}


# ── Playground 엔드포인트 ───────────────────────────────────────────────────

@app.post("/playground/run")
async def playground_run(req: PlaygroundRequest):
    """단일 문서 즉석 요약 + 평가."""
    from agent.summarizer import SummarizerAgent
    from eval.judge import JudgeAgent

    loop = asyncio.get_event_loop()

    summarizer = SummarizerAgent(prompt_version=req.version)
    output = await loop.run_in_executor(
        None,
        lambda: summarizer.summarize("playground", req.doc_type, req.content),
    )

    scores = None
    if req.key_points:
        judge = JudgeAgent()
        result = await loop.run_in_executor(
            None,
            lambda: judge.evaluate(
                doc_id="playground",
                doc_type=req.doc_type,
                content=req.content,
                summary=output.summary,
                prompt_version=req.version,
                key_points=req.key_points,
                reference_summary="",
            ),
        )
        scores = {
            "key_point_coverage": result.key_point_coverage.score,
            "faithfulness":       result.faithfulness.score,
            "information_loss":   result.information_loss.score,
            "length_adequacy":    result.length_adequacy.score,
            "total_score":        result.total_score,
            "grade":              result.grade,
            "reasoning": {
                "key_point_coverage": result.key_point_coverage.reasoning,
                "faithfulness":       result.faithfulness.reasoning,
                "information_loss":   result.information_loss.reasoning,
                "length_adequacy":    result.length_adequacy.reasoning,
            },
        }

    return {"summary": output.summary, "prompt_version": output.prompt_version, "scores": scores}


@app.post("/playground/critique")
async def playground_critique(req: CritiqueRequest):
    """멀티 에이전트 크리틱: Summarizer A → Critic → Summarizer B."""
    from agent.summarizer import SummarizerAgent
    from agent.critic import CriticAgent, SummarizerWithCritique
    from eval.judge import JudgeAgent

    loop = asyncio.get_event_loop()

    # Step 1 — Summarizer A
    summarizer_a = SummarizerAgent(prompt_version=req.version)
    output_a = await loop.run_in_executor(
        None, lambda: summarizer_a.summarize("critique", req.doc_type, req.content)
    )

    # Step 2 — Critic Agent
    critic = CriticAgent()
    critique = await loop.run_in_executor(
        None, lambda: critic.critique(req.doc_type, req.content, output_a.summary, req.key_points)
    )

    # Step 3 — Summarizer B (refined)
    summarizer_b = SummarizerWithCritique(prompt_version=req.version)
    summary_b = await loop.run_in_executor(
        None, lambda: summarizer_b.refine(req.doc_type, req.content, output_a.summary, critique)
    )

    # Step 4 — Judge both (선택적, key_points 있을 때만)
    scores_a = scores_b = None
    if req.key_points:
        judge = JudgeAgent()
        result_a = await loop.run_in_executor(
            None, lambda: judge.evaluate("critique_a", req.doc_type, req.content,
                                         output_a.summary, req.version, req.key_points, "")
        )
        result_b = await loop.run_in_executor(
            None, lambda: judge.evaluate("critique_b", req.doc_type, req.content,
                                         summary_b, req.version, req.key_points, "")
        )
        def _score(r):
            return {
                "key_point_coverage": r.key_point_coverage.score,
                "faithfulness":       r.faithfulness.score,
                "information_loss":   r.information_loss.score,
                "length_adequacy":    r.length_adequacy.score,
                "total_score":        r.total_score,
                "grade":              r.grade,
            }
        scores_a = _score(result_a)
        scores_b = _score(result_b)

    return {
        "summary_a": output_a.summary,
        "critique": {
            "missing_points":        critique.missing_points,
            "factual_errors":        critique.factual_errors,
            "improvement_directive": critique.improvement_directive,
        },
        "summary_b": summary_b,
        "scores_a":  scores_a,
        "scores_b":  scores_b,
    }


@app.post("/playground/debate")
async def playground_debate(req: DebateRequest):
    """에이전트 토론: Summarizer A(간결) vs B(포괄) → Debate Judge 판결."""
    from agent.debate import DebateSummarizer, DebateJudge

    loop = asyncio.get_event_loop()
    debater = DebateSummarizer(prompt_version=req.version)
    judge = DebateJudge()

    summary_a, summary_b = await asyncio.gather(
        loop.run_in_executor(None, lambda: debater.summarize_a(req.doc_type, req.content)),
        loop.run_in_executor(None, lambda: debater.summarize_b(req.doc_type, req.content)),
    )

    verdict = await loop.run_in_executor(
        None,
        lambda: judge.judge(req.doc_type, req.content, summary_a, summary_b, req.key_points),
    )

    return {
        "summary_a": {"strategy": summary_a.strategy, "summary": summary_a.summary},
        "summary_b": {"strategy": summary_b.strategy, "summary": summary_b.summary},
        "verdict": {
            "winner": verdict.winner,
            "winner_reason": verdict.winner_reason,
            "a_strengths": verdict.a_strengths,
            "b_strengths": verdict.b_strengths,
            "a_weaknesses": verdict.a_weaknesses,
            "b_weaknesses": verdict.b_weaknesses,
            "final_verdict": verdict.final_verdict,
        },
    }


@app.get("/settings/autonomy")
async def get_autonomy():
    return _autonomy


@app.post("/settings/autonomy")
async def set_autonomy(req: AutonomySettings):
    _autonomy["threshold"] = req.threshold
    _autonomy["enabled"] = req.enabled
    return _autonomy


@app.post("/playground/explain")
async def playground_explain(req: ExplainRequest):
    """요약 생성 후 문장별 원문 출처 매핑."""
    from agent.summarizer import SummarizerAgent
    from agent.explainer import ExplainerAgent

    loop = asyncio.get_event_loop()
    summarizer = SummarizerAgent(prompt_version=req.version)
    output = await loop.run_in_executor(
        None, lambda: summarizer.summarize("explain", req.doc_type, req.content)
    )
    explainer = ExplainerAgent()
    explanation = await loop.run_in_executor(
        None, lambda: explainer.explain(req.content, output.summary)
    )
    return {
        "summary": output.summary,
        "mappings": [
            {"sentence": m.sentence, "source_quotes": m.source_quotes}
            for m in explanation.mappings
        ],
    }


# ── 대시보드 엔드포인트 ──────────────────────────────────────────────────────

def _db():
    import sqlite3
    from pathlib import Path as P
    return sqlite3.connect(P("data/results.db"))


@app.get("/dashboard/versions")
async def dashboard_versions():
    """버전별 평균 지표 및 등급 분포."""
    try:
        with _db() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT prompt_version,
                       round(avg(total_score),3)          AS total_score,
                       round(avg(key_point_coverage),3)   AS key_point_coverage,
                       round(avg(faithfulness),3)         AS faithfulness,
                       round(avg(information_loss),3)     AS information_loss,
                       round(avg(length_adequacy),3)      AS length_adequacy,
                       count(*)                           AS doc_count
                FROM eval_results
                GROUP BY prompt_version
                ORDER BY prompt_version
                """
            ).fetchall()
            averages = [dict(r) for r in rows]

            grade_rows = conn.execute(
                "SELECT prompt_version, grade, count(*) AS cnt FROM eval_results GROUP BY prompt_version, grade"
            ).fetchall()
            from collections import defaultdict
            grade_dist: dict = defaultdict(dict)
            for r in grade_rows:
                grade_dist[r[0]][r[1]] = r[2]

        return {"averages": averages, "grade_dist": dict(grade_dist)}
    except Exception:
        return {"averages": [], "grade_dist": {}}


@app.get("/dashboard/failures")
async def dashboard_failures(version: str = "", threshold: float = 3.0):
    """실패 케이스 목록 (총점 ≤ threshold)."""
    try:
        with _db() as conn:
            conn.row_factory = sqlite3.Row
            query = "SELECT * FROM eval_results WHERE total_score <= ?"
            params: list = [threshold]
            if version:
                query += " AND prompt_version = ?"
                params.append(version)
            query += " ORDER BY total_score ASC"
            rows = conn.execute(query, params).fetchall()
        results = []
        for r in rows:
            item = dict(r)
            try:
                item["reasoning"] = json.loads(item["reasoning"])
            except Exception:
                pass
            results.append(item)
        return {"results": results, "total": len(results)}
    except Exception:
        return {"results": [], "total": 0}


@app.get("/dashboard/run-ids")
async def dashboard_run_ids():
    """트레이스용 run_id 목록."""
    try:
        with _db() as conn:
            rows = conn.execute(
                "SELECT DISTINCT run_id FROM traces ORDER BY id DESC"
            ).fetchall()
        return {"run_ids": [r[0] for r in rows]}
    except Exception:
        return {"run_ids": []}


@app.get("/dashboard/traces")
async def dashboard_traces(run_id: str = "", doc_id: str = ""):
    """트레이스 목록 (run_id / doc_id 필터)."""
    try:
        with _db() as conn:
            conn.row_factory = sqlite3.Row
            query = "SELECT * FROM traces WHERE 1=1"
            params: list = []
            if run_id:
                query += " AND run_id = ?"
                params.append(run_id)
            if doc_id:
                query += " AND doc_id = ?"
                params.append(doc_id)
            query += " ORDER BY id"
            rows = conn.execute(query, params).fetchall()
        results = []
        for r in rows:
            item = dict(r)
            for field in ("input_data", "output_data"):
                try:
                    item[field] = json.loads(item[field])
                except Exception:
                    pass
            results.append(item)
        return {"traces": results}
    except Exception:
        return {"traces": []}
