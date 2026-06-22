"""
개선 루프 진입점: python -m pipeline.loop [--version v1]

실행 → 평가 → 실패 분석 → 프롬프트 개선 제안 → Human Approval → 재실행
"""
import argparse
import asyncio
from dotenv import load_dotenv

load_dotenv()

from rich.console import Console

from eval.analyzer import FailureAnalyzer
from pipeline.improver import PromptImprover
from pipeline.runner import run_eval

console = Console()


async def main(version: str) -> None:
    console.rule(f"[bold cyan]Improvement Loop — {version}[/]")

    # 1. 평가 실행
    results = await run_eval(prompt_version=version)
    if not results:
        console.print("[red]평가 결과 없음[/]")
        return

    run_id = _extract_run_id(results)

    # 2. 실패 패턴 분석
    console.rule("[bold]실패 패턴 분석[/]")
    analyzer = FailureAnalyzer()
    report = analyzer.analyze(run_id)

    console.print(f"평균 점수: [cyan]{report.avg_score}[/] / 5.0  |  취약 지표: [yellow]{report.weak_metric}[/]")
    for p in report.patterns:
        console.print(f"  [{p.category}] {p.description} — {p.frequency}건")

    # 3. 프롬프트 개선 제안 + Human Approval
    console.rule("[bold]프롬프트 개선 제안[/]")
    improver = PromptImprover()
    proposal = improver.propose(report)
    applied = improver.apply(proposal)

    if applied:
        console.print(f"\n다음 실행: [bold]python -m pipeline.loop --version {proposal.new_version}[/]")


def _extract_run_id(results) -> str:
    from pathlib import Path
    import sqlite3
    db = Path("data/results.db")
    with sqlite3.connect(db) as conn:
        row = conn.execute(
            "SELECT run_id FROM eval_results ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
    return row[0]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default="v1")
    args = parser.parse_args()
    asyncio.run(main(args.version))
