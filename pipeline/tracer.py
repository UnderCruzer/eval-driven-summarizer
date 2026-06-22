"""
에이전트 실행 단계별 트레이스 수집 및 저장.

Summarizer → Judge → Analyzer → Improver 각 단계의
입력, 출력, 소요 시간을 run_id + trace_id 단위로 SQLite에 기록한다.
드릴다운 뷰는 pipeline/trace_viewer.py 참고.
"""
import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Generator

DB_PATH = Path("data/results.db")


@dataclass
class TraceStep:
    trace_id: str
    run_id: str
    doc_id: str
    stage: str          # summarize | judge | analyze | improve
    input_data: dict
    output_data: dict
    elapsed_ms: float
    error: str | None = None


def init_trace_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS traces (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                trace_id    TEXT NOT NULL,
                run_id      TEXT NOT NULL,
                doc_id      TEXT NOT NULL,
                stage       TEXT NOT NULL,
                input_data  TEXT NOT NULL,
                output_data TEXT NOT NULL,
                elapsed_ms  REAL NOT NULL,
                error       TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_traces_run_id ON traces(run_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_traces_doc_id ON traces(doc_id)")


def save_trace(step: TraceStep) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO traces
            (trace_id, run_id, doc_id, stage, input_data, output_data, elapsed_ms, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                step.trace_id,
                step.run_id,
                step.doc_id,
                step.stage,
                json.dumps(step.input_data, ensure_ascii=False),
                json.dumps(step.output_data, ensure_ascii=False),
                step.elapsed_ms,
                step.error,
            ),
        )


@contextmanager
def trace(
    run_id: str,
    doc_id: str,
    stage: str,
    input_data: dict,
) -> Generator[dict, None, None]:
    """
    with trace(run_id, doc_id, "summarize", {"content": ...}) as out:
        out["summary"] = agent.summarize(...)
    """
    trace_id = str(uuid.uuid4())
    output: dict[str, Any] = {}
    start = time.perf_counter()
    error = None
    try:
        yield output
    except Exception as e:
        error = str(e)
        raise
    finally:
        elapsed = (time.perf_counter() - start) * 1000
        save_trace(TraceStep(
            trace_id=trace_id,
            run_id=run_id,
            doc_id=doc_id,
            stage=stage,
            input_data=input_data,
            output_data=output,
            elapsed_ms=round(elapsed, 2),
            error=error,
        ))


def get_trace(run_id: str, doc_id: str | None = None) -> list[dict]:
    """특정 run_id (+ 선택적 doc_id) 의 트레이스 전체 조회."""
    query = "SELECT * FROM traces WHERE run_id = ?"
    params: list = [run_id]
    if doc_id:
        query += " AND doc_id = ?"
        params.append(doc_id)
    query += " ORDER BY id ASC"

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]
