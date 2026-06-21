# eval-driven-summarizer

**문서 요약 에이전트를 평가하고 자동으로 개선하는 시스템**

```
문서 입력
  → Summarizer Agent  (요약 생성)
  → Judge Agent       (품질 평가)
  → Failure Analyzer  (실패 패턴 분석)
  → Prompt Improver   (프롬프트 자동 개선)
  → Human Approval    (개선안 승인)
  → Regression Check  (회귀 감지)
  → 반복
```

## 평가 지표

| 지표 | 설명 |
|------|------|
| Key Point Coverage | 핵심 포인트를 몇 개나 커버했는가 |
| Faithfulness | 원문과 사실적으로 일치하는가 |
| Information Loss | 중요한 정보를 얼마나 놓쳤는가 |
| Length Adequacy | 길이가 적절한가 |

## 구조

```
agent/       # Summarizer Agent
eval/        # Judge Agent + 평가 지표
pipeline/    # 실행 → 평가 → 개선 루프
dashboard/   # 점수 트래킹 UI (Streamlit)
data/        # 테스트셋 (문서 + ground truth)
```

## 시작하기

```bash
cp .env.example .env
# ANTHROPIC_API_KEY 입력

pip install -e ".[dev]"

# Eval 실행
python -m pipeline.run

# 대시보드
streamlit run dashboard/app.py
```
