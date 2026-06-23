import asyncio
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from agent.summarizer import SummarizerAgent
from data.loader import TestCase, load_test_cases
from eval.judge import JudgeAgent
from eval.metrics import EvalResult
from pipeline.tracer import init_trace_db, trace

console = Console()
DB_PATH = Path("data/results.db")


def init_db() -> None:
    init_trace_db()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS eval_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                doc_id TEXT NOT NULL,
                doc_type TEXT NOT NULL,
                prompt_version TEXT NOT NULL,
                summary TEXT NOT NULL,
                key_point_coverage REAL,
                faithfulness REAL,
                information_loss REAL,
                length_adequacy REAL,
                total_score REAL,
                grade TEXT,
                reasoning TEXT,
                created_at TEXT NOT NULL
            )
        """)


def save_result(run_id: str, doc_type: str, result: EvalResult) -> None:
    reasoning = json.dumps(
        {
            "key_point_coverage": result.key_point_coverage.reasoning,
            "faithfulness": result.faithfulness.reasoning,
            "information_loss": result.information_loss.reasoning,
            "length_adequacy": result.length_adequacy.reasoning,
        },
        ensure_ascii=False,
    )
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO eval_results
            (run_id, doc_id, doc_type, prompt_version, summary,
             key_point_coverage, faithfulness, information_loss, length_adequacy,
             total_score, grade, reasoning, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id, result.doc_id, doc_type, result.prompt_version, result.summary,
                result.key_point_coverage.score, result.faithfulness.score,
                result.information_loss.score, result.length_adequacy.score,
                result.total_score, result.grade, reasoning,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


async def _evaluate_one(
    case: TestCase,
    summarizer: SummarizerAgent,
    judge: JudgeAgent,
    run_id: str,
    semaphore: asyncio.Semaphore,
) -> EvalResult:
    async with semaphore:
        loop = asyncio.get_event_loop()

        with trace(run_id, case.doc_id, "summarize", {"doc_type": case.doc_type, "content_len": len(case.content)}) as t_sum:
            output = await loop.run_in_executor(
                None,
                lambda: summarizer.summarize(case.doc_id, case.doc_type, case.content),
            )
            t_sum["summary"] = output.summary
            t_sum["prompt_version"] = output.prompt_version

        with trace(run_id, case.doc_id, "judge", {"prompt_version": output.prompt_version, "summary_len": len(output.summary)}) as t_judge:
            result = await loop.run_in_executor(
                None,
                lambda: judge.evaluate(
                    doc_id=case.doc_id,
                    doc_type=case.doc_type,
                    content=case.content,
                    summary=output.summary,
                    prompt_version=output.prompt_version,
                    key_points=case.key_points,
                    reference_summary=case.reference_summary,
                ),
            )
            t_judge["total_score"] = result.total_score
            t_judge["grade"] = result.grade
        save_result(run_id, case.doc_type, result)
        return result


async def run_eval(
    prompt_version: str = "v1",
    doc_type: Optional[str] = None,
    batch_size: int = 3,
    on_progress=None,
) -> list[EvalResult]:
    init_db()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    cases = load_test_cases(doc_type=doc_type)

    summarizer = SummarizerAgent(prompt_version=prompt_version)
    judge = JudgeAgent()
    semaphore = asyncio.Semaphore(batch_size)

    console.print(f"\n[bold cyan]Eval Run[/] — version=[yellow]{prompt_version}[/] docs=[green]{len(cases)}[/]\n")

    if on_progress:
        await on_progress({"type": "start", "total": len(cases), "version": prompt_version, "run_id": run_id})

    with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as progress:
        task_coroutines = [
            _evaluate_one(case, summarizer, judge, run_id, semaphore)
            for case in cases
        ]
        task_id = progress.add_task("평가 중...", total=len(task_coroutines))
        results = []
        done_count = 0
        for coro in asyncio.as_completed(task_coroutines):
            result = await coro
            results.append(result)
            done_count += 1
            progress.advance(task_id)
            if on_progress:
                await on_progress({
                    "type": "progress",
                    "done": done_count,
                    "total": len(cases),
                    "doc_id": result.doc_id,
                    "grade": result.grade,
                    "total_score": result.total_score,
                })

    _print_summary(results, run_id)
    return results


def _print_summary(results: list[EvalResult], run_id: str) -> None:
    table = Table(title=f"Eval 결과 — run_id: {run_id}", show_lines=True)
    table.add_column("doc_id", style="cyan")
    table.add_column("coverage", justify="center")
    table.add_column("faithful", justify="center")
    table.add_column("info_loss", justify="center")
    table.add_column("length", justify="center")
    table.add_column("total", justify="center", style="bold")
    table.add_column("grade", justify="center")

    for r in sorted(results, key=lambda x: x.doc_id):
        grade_color = {"A": "green", "B": "yellow", "C": "orange3", "F": "red"}.get(r.grade, "white")
        table.add_row(
            r.doc_id,
            str(r.key_point_coverage.score),
            str(r.faithfulness.score),
            str(r.information_loss.score),
            str(r.length_adequacy.score),
            str(r.total_score),
            f"[{grade_color}]{r.grade}[/]",
        )

    avg = sum(r.total_score for r in results) / len(results)
    console.print(table)
    console.print(f"\n[bold]평균 점수:[/] [cyan]{avg:.2f}[/] / 5.00\n")
