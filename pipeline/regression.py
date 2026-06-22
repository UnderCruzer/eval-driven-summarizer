import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from rich.console import Console
from rich.table import Table

console = Console()
DB_PATH = Path("data/results.db")

REGRESSION_THRESHOLD = float(os.environ.get("REGRESSION_THRESHOLD", "0.3"))


@dataclass
class VersionSummary:
    prompt_version: str
    avg_total: float
    avg_coverage: float
    avg_faithfulness: float
    avg_info_loss: float
    avg_length: float
    doc_count: int


@dataclass
class RegressionAlert:
    metric: str
    baseline_version: str
    current_version: str
    baseline_score: float
    current_score: float
    delta: float


class RegressionTracker:
    def compare(
        self,
        baseline_version: str,
        current_version: str,
    ) -> tuple[VersionSummary, VersionSummary, list[RegressionAlert]]:
        baseline = self._load_summary(baseline_version)
        current = self._load_summary(current_version)

        if baseline is None:
            raise ValueError(f"'{baseline_version}' 결과 없음. 먼저 Eval을 실행하세요.")
        if current is None:
            raise ValueError(f"'{current_version}' 결과 없음. 먼저 Eval을 실행하세요.")

        alerts = self._detect_regressions(baseline, current)
        self._print_report(baseline, current, alerts)
        return baseline, current, alerts

    def _load_summary(self, version: str) -> VersionSummary | None:
        with sqlite3.connect(DB_PATH) as conn:
            row = conn.execute(
                """
                SELECT
                    prompt_version,
                    AVG(total_score)          AS avg_total,
                    AVG(key_point_coverage)   AS avg_coverage,
                    AVG(faithfulness)         AS avg_faithfulness,
                    AVG(information_loss)     AS avg_info_loss,
                    AVG(length_adequacy)      AS avg_length,
                    COUNT(*)                  AS doc_count
                FROM eval_results
                WHERE prompt_version = ?
                """,
                (version,),
            ).fetchone()

        if row is None or row[6] == 0:
            return None

        return VersionSummary(
            prompt_version=row[0],
            avg_total=round(row[1], 3),
            avg_coverage=round(row[2], 3),
            avg_faithfulness=round(row[3], 3),
            avg_info_loss=round(row[4], 3),
            avg_length=round(row[5], 3),
            doc_count=row[6],
        )

    def _detect_regressions(
        self,
        baseline: VersionSummary,
        current: VersionSummary,
    ) -> list[RegressionAlert]:
        metrics = {
            "total_score": (baseline.avg_total, current.avg_total),
            "key_point_coverage": (baseline.avg_coverage, current.avg_coverage),
            "faithfulness": (baseline.avg_faithfulness, current.avg_faithfulness),
            "information_loss": (baseline.avg_info_loss, current.avg_info_loss),
            "length_adequacy": (baseline.avg_length, current.avg_length),
        }

        alerts = []
        for metric, (b_score, c_score) in metrics.items():
            delta = c_score - b_score
            if delta < -REGRESSION_THRESHOLD:
                alerts.append(RegressionAlert(
                    metric=metric,
                    baseline_version=baseline.prompt_version,
                    current_version=current.prompt_version,
                    baseline_score=b_score,
                    current_score=c_score,
                    delta=round(delta, 3),
                ))
        return alerts

    def _print_report(
        self,
        baseline: VersionSummary,
        current: VersionSummary,
        alerts: list[RegressionAlert],
    ) -> None:
        table = Table(
            title=f"회귀 비교: {baseline.prompt_version} → {current.prompt_version}",
            show_lines=True,
        )
        table.add_column("지표", style="cyan")
        table.add_column(baseline.prompt_version, justify="center")
        table.add_column(current.prompt_version, justify="center")
        table.add_column("변화", justify="center")

        rows = [
            ("total_score", baseline.avg_total, current.avg_total),
            ("key_point_coverage", baseline.avg_coverage, current.avg_coverage),
            ("faithfulness", baseline.avg_faithfulness, current.avg_faithfulness),
            ("information_loss", baseline.avg_info_loss, current.avg_info_loss),
            ("length_adequacy", baseline.avg_length, current.avg_length),
        ]

        regressed = {a.metric for a in alerts}
        for metric, b, c in rows:
            delta = c - b
            color = "red" if metric in regressed else "green" if delta > 0 else "white"
            sign = "+" if delta >= 0 else ""
            table.add_row(metric, str(b), str(c), f"[{color}]{sign}{delta:.3f}[/]")

        console.print(table)

        if alerts:
            console.print(f"\n[bold red]회귀 감지 {len(alerts)}건 (임계값: -{REGRESSION_THRESHOLD})[/]")
            for a in alerts:
                console.print(f"  [red]✗ {a.metric}: {a.baseline_score} → {a.current_score} ({a.delta:+.3f})[/]")
        else:
            console.print("\n[bold green]회귀 없음 — 모든 지표 유지 또는 향상[/]")
