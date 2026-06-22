"""
트레이스 드릴다운 CLI: python -m pipeline.trace_viewer --run-id <run_id> [--doc-id <doc_id>]
"""
import argparse
import json
import sqlite3
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()
DB_PATH = Path("data/results.db")

STAGE_COLOR = {
    "summarize": "cyan",
    "judge": "yellow",
    "analyze": "magenta",
    "improve": "green",
}


def list_runs() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT run_id, COUNT(DISTINCT doc_id) AS docs,
                   COUNT(*) AS steps, MIN(created_at) AS started
            FROM traces
            GROUP BY run_id
            ORDER BY started DESC
            LIMIT 20
            """
        ).fetchall()

    table = Table(title="최근 Run 목록", show_lines=True)
    table.add_column("run_id", style="cyan")
    table.add_column("docs", justify="center")
    table.add_column("steps", justify="center")
    table.add_column("started")
    for r in rows:
        table.add_row(r[0], str(r[1]), str(r[2]), r[3])
    console.print(table)


def show_trace(run_id: str, doc_id: str | None) -> None:
    query = "SELECT * FROM traces WHERE run_id = ?"
    params: list = [run_id]
    if doc_id:
        query += " AND doc_id = ?"
        params.append(doc_id)
    query += " ORDER BY id ASC"

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute(query, params).fetchall()]

    if not rows:
        console.print(f"[red]트레이스 없음: run_id={run_id}[/]")
        return

    console.print(f"\n[bold]Run ID:[/] [cyan]{run_id}[/]  |  총 {len(rows)}개 스텝\n")

    for row in rows:
        color = STAGE_COLOR.get(row["stage"], "white")
        status = "[red]ERROR[/]" if row["error"] else "[green]OK[/]"

        input_preview = json.dumps(
            json.loads(row["input_data"]), ensure_ascii=False, indent=2
        )[:400]
        output_preview = json.dumps(
            json.loads(row["output_data"]), ensure_ascii=False, indent=2
        )[:400]

        content = (
            f"[bold]doc_id:[/] {row['doc_id']}  |  "
            f"[bold]elapsed:[/] {row['elapsed_ms']:.1f}ms  |  {status}\n\n"
            f"[bold]Input:[/]\n[dim]{input_preview}[/]\n\n"
            f"[bold]Output:[/]\n[dim]{output_preview}[/]"
        )
        if row["error"]:
            content += f"\n\n[red]Error: {row['error']}[/]"

        console.print(Panel(
            content,
            title=f"[{color}]{row['stage'].upper()}[/]  trace_id: {row['trace_id'][:8]}...",
            border_style=color,
        ))


def main() -> None:
    parser = argparse.ArgumentParser(description="트레이스 드릴다운 뷰어")
    parser.add_argument("--run-id", help="조회할 run_id (생략 시 목록 출력)")
    parser.add_argument("--doc-id", help="특정 문서만 조회")
    args = parser.parse_args()

    if not args.run_id:
        list_runs()
    else:
        show_trace(args.run_id, args.doc_id)


if __name__ == "__main__":
    main()
