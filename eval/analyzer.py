import json
import os
import sqlite3
from pathlib import Path

from pydantic import BaseModel
from agent.llm import call_llm

DB_PATH = Path("data/results.db")


class FailurePattern(BaseModel):
    category: str        # missing_keypoints | hallucination | info_loss | length
    frequency: int
    affected_doc_ids: list[str]
    description: str
    improvement_hint: str


class AnalysisReport(BaseModel):
    run_id: str
    prompt_version: str
    total_docs: int
    avg_score: float
    weak_metric: str
    patterns: list[FailurePattern]
    overall_suggestion: str


class FailureAnalyzer:
    def __init__(self):
        self.model = os.environ.get("JUDGE_MODEL", "gemini-2.5-flash")

    def analyze(self, run_id: str) -> AnalysisReport:
        rows = self._load_results(run_id)
        if not rows:
            raise ValueError(f"run_id '{run_id}'에 해당하는 결과가 없습니다.")

        prompt_version = rows[0]["prompt_version"]
        avg_score = sum(r["total_score"] for r in rows) / len(rows)

        metric_avgs = {
            m: sum(r[m] for r in rows) / len(rows)
            for m in ("key_point_coverage", "faithfulness", "information_loss", "length_adequacy")
        }
        weak_metric = min(metric_avgs, key=metric_avgs.get)

        failures = [r for r in rows if r["total_score"] < 3.0]
        patterns = self._extract_patterns(rows, failures)

        return AnalysisReport(
            run_id=run_id,
            prompt_version=prompt_version,
            total_docs=len(rows),
            avg_score=round(avg_score, 2),
            weak_metric=weak_metric,
            patterns=patterns,
            overall_suggestion=self._generate_suggestion(weak_metric, patterns, metric_avgs),
        )

    def _load_results(self, run_id: str) -> list[dict]:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM eval_results WHERE run_id = ?", (run_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def _extract_patterns(self, all_rows: list[dict], failures: list[dict]) -> list[FailurePattern]:
        patterns = []

        thresholds = {
            "key_point_coverage": ("missing_keypoints", "핵심 포인트 누락"),
            "faithfulness": ("hallucination", "사실 오류/환각"),
            "information_loss": ("info_loss", "중요 정보 손실"),
            "length_adequacy": ("length", "길이 부적절"),
        }

        for metric, (category, desc) in thresholds.items():
            affected = [r["doc_id"] for r in all_rows if r[metric] < 3.0]
            if not affected:
                continue

            reasonings = [
                json.loads(r["reasoning"]).get(metric, "")
                for r in all_rows if r["doc_id"] in affected
            ]
            hint = self._generate_hint(category, reasonings)

            patterns.append(FailurePattern(
                category=category,
                frequency=len(affected),
                affected_doc_ids=affected,
                description=desc,
                improvement_hint=hint,
            ))

        return sorted(patterns, key=lambda p: p.frequency, reverse=True)

    def _generate_hint(self, category: str, reasonings: list[str]) -> str:
        reasoning_text = "\n".join(f"- {r}" for r in reasonings if r)
        return call_llm(
            self.model,
            (
                f"다음은 문서 요약 평가에서 '{category}' 문제가 발생한 사례들의 평가 근거입니다:\n"
                f"{reasoning_text}\n\n"
                "이 문제를 해결하기 위한 프롬프트 개선 힌트를 한 문장으로 제시해 주세요."
            ),
            max_tokens=256,
        )

    def _generate_suggestion(
        self,
        weak_metric: str,
        patterns: list[FailurePattern],
        metric_avgs: dict[str, float],
    ) -> str:
        avgs_text = "\n".join(f"- {k}: {v:.2f}" for k, v in metric_avgs.items())
        patterns_text = "\n".join(
            f"- [{p.category}] {p.description} (발생 {p.frequency}건): {p.improvement_hint}"
            for p in patterns
        )
        return call_llm(
            self.model,
            (
                f"문서 요약 에이전트 평가 결과입니다.\n\n"
                f"지표별 평균:\n{avgs_text}\n\n"
                f"발견된 실패 패턴:\n{patterns_text}\n\n"
                f"가장 취약한 지표: {weak_metric}\n\n"
                "프롬프트를 어떻게 개선해야 할지 핵심만 2~3문장으로 제안해 주세요."
            ),
            max_tokens=300,
        )
