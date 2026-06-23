import os
import anthropic
from pydantic import BaseModel


class CritiqueOutput(BaseModel):
    missing_points: list[str]
    factual_errors: list[str]
    improvement_directive: str


class CriticAgent:
    """요약을 검토해 빠진 정보와 오류를 지적하고 개선 지시를 내리는 에이전트."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = os.environ.get("CRITIC_MODEL", "claude-sonnet-4-6")

    def critique(
        self,
        doc_type: str,
        content: str,
        summary: str,
        key_points: list[str],
    ) -> CritiqueOutput:
        kp_block = "\n".join(f"- {kp}" for kp in key_points) if key_points else "(없음)"

        system = (
            "당신은 요약 품질을 검토하는 Critic Agent입니다. "
            "원문과 요약을 비교해 (1) 빠진 핵심 정보, (2) 사실과 다른 내용을 지적하고 "
            "(3) 다음 요약 에이전트에게 구체적인 개선 지시를 내리세요. "
            "지적은 간결하고 실행 가능하게 작성하세요."
        )
        user = f"""[문서 유형]: {doc_type}

[원문]
{content}

[핵심 포인트 (ground truth)]
{kp_block}

[검토할 요약]
{summary}

다음 JSON 형식으로만 응답하세요:
{{
  "missing_points": ["빠진 정보 1", "빠진 정보 2"],
  "factual_errors": ["오류 1"],
  "improvement_directive": "다음 요약 작성 시 반드시 반영할 구체적 지시사항"
}}"""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user}],
        )

        from eval.judge import _parse_json_robust
        data = _parse_json_robust(response.content[0].text.strip())
        return CritiqueOutput(**data)


class SummarizerWithCritique:
    """Critic의 지시를 반영해 요약을 개선하는 Summarizer B."""

    def __init__(self, prompt_version: str = "v1"):
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = os.environ.get("SUMMARIZER_MODEL", "claude-sonnet-4-6")
        self.prompt_version = prompt_version

    def refine(
        self,
        doc_type: str,
        content: str,
        first_summary: str,
        critique: CritiqueOutput,
    ) -> str:
        from agent.prompts import PROMPTS
        _, user_template = PROMPTS.get(self.prompt_version, list(PROMPTS.values())[0])

        missing = "\n".join(f"- {p}" for p in critique.missing_points) or "없음"
        errors  = "\n".join(f"- {e}" for e in critique.factual_errors)  or "없음"

        system = (
            "당신은 문서 요약 전문가입니다. "
            "Critic Agent의 피드백을 반드시 반영해 이전 요약을 개선하세요."
        )
        user = f"""[문서 유형]: {doc_type}

[원문]
{content}

[이전 요약 (Summarizer A)]
{first_summary}

[Critic Agent 피드백]
빠진 정보:
{missing}

사실 오류:
{errors}

개선 지시:
{critique.improvement_directive}

위 피드백을 모두 반영해 개선된 요약을 작성하세요. 요약만 출력하세요."""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return response.content[0].text.strip()
