import json
import os
import anthropic
from eval.metrics import EvalResult, MetricScore, METRIC_DEFINITIONS


class JudgeAgent:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = os.environ.get("JUDGE_MODEL", "claude-sonnet-4-6")

    def evaluate(
        self,
        doc_id: str,
        doc_type: str,
        content: str,
        summary: str,
        prompt_version: str,
        key_points: list[str],
        reference_summary: str,
    ) -> EvalResult:
        raw = self._call_judge(
            doc_type=doc_type,
            content=content,
            summary=summary,
            key_points=key_points,
            reference_summary=reference_summary,
        )

        scores = {
            k: MetricScore(score=raw[k]["score"], reasoning=raw[k]["reasoning"])
            for k in ("key_point_coverage", "faithfulness", "information_loss", "length_adequacy")
        }
        total, grade = EvalResult.compute_total(scores)

        return EvalResult(
            doc_id=doc_id,
            prompt_version=prompt_version,
            summary=summary,
            total_score=total,
            grade=grade,
            **scores,
        )

    def _call_judge(
        self,
        doc_type: str,
        content: str,
        summary: str,
        key_points: list[str],
        reference_summary: str,
    ) -> dict:
        system = _build_system_prompt()
        user = _build_user_prompt(
            doc_type=doc_type,
            content=content,
            summary=summary,
            key_points=key_points,
            reference_summary=reference_summary,
        )

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user}],
        )

        text = response.content[0].text.strip()
        # JSON 블록만 추출
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        return json.loads(text)


def _build_system_prompt() -> str:
    metric_desc = "\n".join(
        f"- {k}: {v['description']}" for k, v in METRIC_DEFINITIONS.items()
    )
    return f"""당신은 문서 요약 품질을 평가하는 전문 심사 에이전트입니다.
아래 4가지 지표로 요약을 평가하고, 각 지표에 0~5점을 부여하세요.

평가 지표:
{metric_desc}

반드시 다음 JSON 형식으로만 응답하세요:
{{
  "key_point_coverage": {{"score": <0-5>, "reasoning": "<근거>"}},
  "faithfulness": {{"score": <0-5>, "reasoning": "<근거>"}},
  "information_loss": {{"score": <0-5>, "reasoning": "<근거>"}},
  "length_adequacy": {{"score": <0-5>, "reasoning": "<근거>"}}
}}"""


def _build_user_prompt(
    doc_type: str,
    content: str,
    summary: str,
    key_points: list[str],
    reference_summary: str,
) -> str:
    kp_list = "\n".join(f"- {kp}" for kp in key_points)
    return f"""[문서 유형]: {doc_type}

[원문]
{content}

[핵심 포인트 (ground truth)]
{kp_list}

[참조 요약 (ground truth)]
{reference_summary}

[평가 대상 요약]
{summary}

위 요약을 4가지 지표로 평가해 주세요."""
