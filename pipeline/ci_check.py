"""
CI 전용 회귀 체크: python -m pipeline.ci_check

- SQLite에서 가장 최근 두 run을 비교
- 회귀(REGRESSION_THRESHOLD 이상 하락) 발생 시 exit(1) → PR 머지 블락
- 첫 번째 run이라 비교 대상 없으면 통과
- GitHub Actions PR 코멘트용 요약을 GITHUB_STEP_SUMMARY에 기록
"""
import os
import sqlite3
import sys
from pathlib import Path

from rich.console import Console

from pipeline.regression import RegressionTracker

console = Console()
DB_PATH = Path("data/results.db")


def get_latest_two_versions() -> tuple[str | None, str | None]:
    if not DB_PATH.exists():
        return None, None
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT prompt_version
            FROM eval_results
            ORDER BY MIN(created_at) DESC
            LIMIT 2
            """
        ).fetchall()
    versions = [r[0] for r in rows]
    if len(versions) < 2:
        return versions[0] if versions else None, None
    return versions[1], versions[0]   # (baseline, current)


def write_summary(lines: list[str]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a") as f:
            f.write("\n".join(lines) + "\n")


def main() -> None:
    baseline_version, current_version = get_latest_two_versions()

    if baseline_version is None:
        console.print("[yellow]Eval 결과 없음 — CI 통과[/]")
        write_summary(["## Eval CI", "> 결과 없음, 건너뜀"])
        sys.exit(0)

    if current_version is None:
        console.print(f"[cyan]첫 번째 Eval({baseline_version}) — 비교 대상 없음, 통과[/]")
        write_summary([
            "## Eval CI",
            f"첫 번째 실행 버전: `{baseline_version}` — 회귀 비교 없음",
        ])
        sys.exit(0)

    tracker = RegressionTracker()
    baseline, current, alerts = tracker.compare(baseline_version, current_version)

    summary_lines = [
        "## Eval CI 결과",
        f"| | {baseline_version} | {current_version} | 변화 |",
        "|---|---|---|---|",
        f"| **총점** | {baseline.avg_total} | {current.avg_total} | {current.avg_total - baseline.avg_total:+.3f} |",
        f"| coverage | {baseline.avg_coverage} | {current.avg_coverage} | {current.avg_coverage - baseline.avg_coverage:+.3f} |",
        f"| faithfulness | {baseline.avg_faithfulness} | {current.avg_faithfulness} | {current.avg_faithfulness - baseline.avg_faithfulness:+.3f} |",
        f"| info_loss | {baseline.avg_info_loss} | {current.avg_info_loss} | {current.avg_info_loss - baseline.avg_info_loss:+.3f} |",
        f"| length | {baseline.avg_length} | {current.avg_length} | {current.avg_length - baseline.avg_length:+.3f} |",
    ]

    if alerts:
        summary_lines += [
            "",
            f"### ❌ 회귀 감지 {len(alerts)}건",
        ]
        for a in alerts:
            summary_lines.append(f"- **{a.metric}**: {a.baseline_score} → {a.current_score} ({a.delta:+.3f})")
        write_summary(summary_lines)
        console.print(f"\n[bold red]CI 실패: 회귀 {len(alerts)}건 감지[/]")
        sys.exit(1)
    else:
        summary_lines.append("\n### ✅ 회귀 없음")
        write_summary(summary_lines)
        console.print("\n[bold green]CI 통과: 회귀 없음[/]")
        sys.exit(0)


if __name__ == "__main__":
    main()
