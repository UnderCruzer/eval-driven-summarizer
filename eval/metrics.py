from pydantic import BaseModel, Field


class MetricScore(BaseModel):
    score: float = Field(ge=0.0, le=5.0)
    reasoning: str


class EvalResult(BaseModel):
    doc_id: str
    prompt_version: str
    summary: str

    # 4가지 핵심 지표 (각 0~5점)
    key_point_coverage: MetricScore
    faithfulness: MetricScore
    information_loss: MetricScore
    length_adequacy: MetricScore

    total_score: float
    grade: str  # A / B / C / F

    @classmethod
    def compute_total(cls, scores: dict[str, MetricScore]) -> tuple[float, str]:
        weights = {
            "key_point_coverage": 0.35,
            "faithfulness": 0.30,
            "information_loss": 0.25,
            "length_adequacy": 0.10,
        }
        total = sum(scores[k].score * w for k, w in weights.items())
        grade = "A" if total >= 4.0 else "B" if total >= 3.0 else "C" if total >= 2.0 else "F"
        return round(total, 2), grade


METRIC_DEFINITIONS = {
    "key_point_coverage": {
        "description": "요약이 원문의 핵심 포인트를 얼마나 커버했는가",
        "scoring": {
            5: "모든 핵심 포인트 포함",
            4: "핵심 포인트 80% 이상 포함",
            3: "핵심 포인트 60% 이상 포함",
            2: "핵심 포인트 40% 이상 포함",
            1: "핵심 포인트 20% 미만 포함",
            0: "핵심 포인트 전혀 없음",
        },
        "weight": 0.35,
    },
    "faithfulness": {
        "description": "요약 내용이 원문 사실과 일치하는가 (환각 없음)",
        "scoring": {
            5: "사실 오류 없음",
            4: "사소한 표현 차이만 존재",
            3: "경미한 사실 오류 1건",
            2: "사실 오류 2건 이상",
            1: "심각한 사실 왜곡",
            0: "내용 대부분이 원문과 다름",
        },
        "weight": 0.30,
    },
    "information_loss": {
        "description": "중요한 정보를 얼마나 보존했는가 (손실이 적을수록 높은 점수)",
        "scoring": {
            5: "중요 정보 손실 없음",
            4: "부가적 정보만 생략",
            3: "중요도 중간인 정보 일부 누락",
            2: "중요 정보 일부 누락",
            1: "핵심 결론이나 수치 누락",
            0: "대부분의 중요 정보 누락",
        },
        "weight": 0.25,
    },
    "length_adequacy": {
        "description": "요약 길이가 적절한가 (150~350자 기준)",
        "scoring": {
            5: "150~350자 이내, 밀도 높음",
            4: "약간 짧거나 길지만 허용 범위",
            3: "기준보다 30% 이상 벗어남",
            2: "기준보다 50% 이상 벗어남",
            1: "너무 짧아 내용 부족 또는 과도하게 김",
            0: "한 문장이거나 원문 수준으로 김",
        },
        "weight": 0.10,
    },
}
