import os
from pydantic import BaseModel
from agent.llm import call_llm


class SentenceMapping(BaseModel):
    sentence: str
    source_quotes: list[str]   # 원문에서 발췌한 근거 구절들


class ExplanationOutput(BaseModel):
    mappings: list[SentenceMapping]


class ExplainerAgent:
    """요약 문장별로 원문 근거 구절을 추출하는 에이전트."""

    def __init__(self):
        self.model = os.environ.get("JUDGE_MODEL", "gemini-2.5-flash")

    def explain(self, content: str, summary: str) -> ExplanationOutput:
        system = (
            "당신은 요약의 출처를 분석하는 에이전트입니다. "
            "요약의 각 문장이 원문의 어느 부분에서 왔는지 찾아주세요. "
            "source_quotes는 원문에서 그대로 발췌한 짧은 구절(15~40자)이어야 합니다. "
            "반드시 아래 JSON 형식으로만 응답하세요:\n"
            '{"mappings": [{"sentence": "요약 문장", "source_quotes": ["원문 구절1", "원문 구절2"]}, ...]}'
        )
        user = f"""[원문]
{content}

[요약]
{summary}

요약의 각 문장에 대해 원문 근거 구절을 찾아주세요."""

        from eval.judge import _parse_json_robust
        text = call_llm(self.model, user, system=system, max_tokens=2048)
        data = _parse_json_robust(text)
        return ExplanationOutput(
            mappings=[
                SentenceMapping(
                    sentence=m.get("sentence", ""),
                    source_quotes=m.get("source_quotes", []),
                )
                for m in data.get("mappings", [])
            ]
        )
