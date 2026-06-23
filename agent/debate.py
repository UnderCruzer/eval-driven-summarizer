import os
from pydantic import BaseModel
from agent.llm import call_llm
from agent.prompts import PROMPTS


class DebateSummary(BaseModel):
    strategy: str
    summary: str


class DebateVerdict(BaseModel):
    winner: str          # "A" | "B" | "tie"
    winner_reason: str
    a_strengths: list[str]
    b_strengths: list[str]
    a_weaknesses: list[str]
    b_weaknesses: list[str]
    final_verdict: str


STRATEGY_A = "간결 전략"
STRATEGY_B = "포괄 전략"


class DebateSummarizer:
    """두 가지 상반된 전략으로 요약을 생성하는 에이전트 쌍."""

    def __init__(self, prompt_version: str = "v1"):
        self.model = os.environ.get("SUMMARIZER_MODEL", "gemini-2.5-flash")
        self.prompt_version = prompt_version

    def summarize_a(self, doc_type: str, content: str) -> DebateSummary:
        """전략 A: 핵심만 담은 간결한 요약 (3문장 이내)."""
        _, user_template = PROMPTS.get(self.prompt_version, list(PROMPTS.values())[0])
        system = (
            "당신은 간결함을 최우선으로 하는 요약 전문가입니다. "
            "가장 중요한 핵심 정보만 담아 3문장 이내로 요약하세요. "
            "불필요한 수치나 세부 사항은 과감히 생략하세요. "
            "반드시 완전한 문장으로 끝내세요. 문장 중간에 절대 멈추지 마세요."
        )
        user = user_template.format(doc_type=doc_type, content=content)
        summary = call_llm(self.model, user, system=system, max_tokens=2048)
        return DebateSummary(strategy=STRATEGY_A, summary=summary)

    def summarize_b(self, doc_type: str, content: str) -> DebateSummary:
        """전략 B: 중요 세부 정보까지 포함한 포괄적 요약."""
        _, user_template = PROMPTS.get(self.prompt_version, list(PROMPTS.values())[0])
        system = (
            "당신은 정보 보존을 최우선으로 하는 요약 전문가입니다. "
            "중요한 수치, 날짜, 고유명사를 모두 포함해 빠진 정보가 없도록 포괄적으로 요약하세요. "
            "길이보다 완전성을 우선시하세요. "
            "반드시 완전한 문장으로 끝내세요. 문장 중간에 절대 멈추지 마세요."
        )
        user = user_template.format(doc_type=doc_type, content=content)
        summary = call_llm(self.model, user, system=system, max_tokens=2048)
        return DebateSummary(strategy=STRATEGY_B, summary=summary)


class DebateJudge:
    """두 요약을 비교하고 법정 스타일로 판결을 내리는 에이전트."""

    def __init__(self):
        self.model = os.environ.get("JUDGE_MODEL", "gemini-2.5-flash")

    def judge(
        self,
        doc_type: str,
        content: str,
        summary_a: DebateSummary,
        summary_b: DebateSummary,
        key_points: list[str],
    ) -> DebateVerdict:
        kp_block = "\n".join(f"- {kp}" for kp in key_points) if key_points else "(없음)"
        system = (
            "당신은 공정한 토론 심판입니다. 두 요약을 법정 판사처럼 냉정하게 비교하고 "
            "어느 쪽이 더 우수한지 판결하세요.\n"
            "반드시 아래 JSON 형식으로만 응답하세요. 각 배열에는 반드시 1개 이상 항목을 포함하세요:\n"
            "{\n"
            '  "winner": "A" 또는 "B" 또는 "tie",\n'
            '  "winner_reason": "한 문장 판결 이유",\n'
            '  "a_strengths": ["A의 장점을 구체적으로"],\n'
            '  "b_strengths": ["B의 장점을 구체적으로"],\n'
            '  "a_weaknesses": ["A의 단점을 구체적으로"],\n'
            '  "b_weaknesses": ["B의 단점을 구체적으로"],\n'
            '  "final_verdict": "두 요약의 차이와 승자 선정 이유를 2~3문장으로"\n'
            "}"
        )
        user = f"""[문서 유형]: {doc_type}

[원문]
{content}

[핵심 포인트 (ground truth)]
{kp_block}

[요약 A — {summary_a.strategy}]
{summary_a.summary}

[요약 B — {summary_b.strategy}]
{summary_b.summary}

두 요약을 비교해 판결해 주세요."""

        from eval.judge import _parse_json_robust
        text = call_llm(self.model, user, system=system, max_tokens=1024)
        data = _parse_json_robust(text)
        return DebateVerdict(
            winner=data.get("winner", "tie"),
            winner_reason=data.get("winner_reason", ""),
            a_strengths=data.get("a_strengths", []),
            b_strengths=data.get("b_strengths", []),
            a_weaknesses=data.get("a_weaknesses", []),
            b_weaknesses=data.get("b_weaknesses", []),
            final_verdict=data.get("final_verdict", ""),
        )
