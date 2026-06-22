import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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

# 정적 파일 (UI)
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=static_path), name="static")

# 실행 중인 작업 상태 (in-memory)
_running: dict[str, str] = {}


# ── 스키마 ──────────────────────────────────────────────────────────────────

class EvalRunRequest(BaseModel):
    version: str = "v1"
    doc_type: str | None = None


class DecisionRequest(BaseModel):
    edited_system_prompt: str | None = None
    edited_user_template: str | None = None


# ── 엔드포인트 ───────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def root():
    html = (static_path / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(content=html)


@app.post("/eval/run")
async def eval_run(req: EvalRunRequest, background_tasks: BackgroundTasks):
    if _running.get("status") == "running":
        raise HTTPException(status_code=409, detail="이미 Eval이 실행 중입니다.")

    _running["status"] = "running"
    _running["version"] = req.version

    async def _run():
        try:
            results = await run_eval(prompt_version=req.version, doc_type=req.doc_type)
            if not results:
                _running["status"] = "idle"
                return

            # 최근 run_id 조회
            import sqlite3
            from pathlib import Path as P
            with sqlite3.connect(P("data/results.db")) as conn:
                row = conn.execute(
                    "SELECT run_id FROM eval_results ORDER BY created_at DESC LIMIT 1"
                ).fetchone()
            run_id = row[0]

            # 실패 분석 + 개선 제안 생성
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

            save_proposal(
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
        except Exception as e:
            _running["status"] = "error"
            _running["error"] = str(e)

    background_tasks.add_task(_run)
    return {"message": f"Eval v{req.version} 시작됨", "status": "running"}


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
