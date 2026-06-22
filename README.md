# eval-driven-summarizer

![Eval CI](https://github.com/UnderCruzer/eval-driven-summarizer/actions/workflows/eval.yml/badge.svg)

**문서 요약 에이전트를 평가하고 자동으로 개선하는 시스템**

```
문서 입력
  → Summarizer Agent  (요약 생성)
  → Judge Agent       (품질 평가 — LLM-as-a-Judge)
  → Failure Analyzer  (실패 패턴 분류)
  → Prompt Improver   (프롬프트 자동 개선 제안)
  → Human Approval    (개선안 승인 게이트)
  → Regression Check  (버전 간 회귀 감지)
  → 반복
```

## 평가 지표

| 지표 | 가중치 | 설명 |
|------|--------|------|
| key_point_coverage | 35% | 핵심 포인트를 얼마나 커버했는가 |
| faithfulness | 30% | 원문과 사실적으로 일치하는가 |
| information_loss | 25% | 중요한 정보를 얼마나 보존했는가 |
| length_adequacy | 10% | 길이가 적절한가 (150~350자 기준) |

총점은 가중 평균으로 산출되며 A(4.0+) / B(3.0+) / C(2.0+) / F로 등급 부여

## 프로젝트 구조

```
agent/
  summarizer.py     # Claude API 기반 요약 에이전트
  prompts.py        # 프롬프트 버전 관리 (v1, v2, ...)
eval/
  metrics.py        # 평가 지표 정의 및 스키마
  judge.py          # LLM-as-a-Judge 평가 에이전트
  analyzer.py       # 실패 패턴 분류 및 개선 힌트 생성
pipeline/
  runner.py         # 비동기 배치 평가 파이프라인
  loop.py           # 평가→분석→개선→승인 전체 루프
  improver.py       # 프롬프트 자동 개선 + Human Approval Gate
  regression.py     # 버전 간 회귀 감지
  tracer.py         # 단계별 트레이스 수집
  trace_viewer.py   # CLI 트레이스 드릴다운 뷰어
  ci_check.py       # CI 전용 회귀 체크 (exit code)
dashboard/
  app.py            # Streamlit 대시보드 (버전 비교 / 실패 케이스 / 트레이스)
data/
  documents/        # 테스트 문서 (뉴스, 논문, 회의록)
  ground_truth/     # 핵심 포인트 + 참조 요약
  loader.py         # TestCase 스키마 및 로더
```

## 개선 루프 실행 결과

실제로 `python -m pipeline.loop` 를 v1부터 순차 실행한 결과입니다.

| 버전 | 평균 점수 | coverage | faithfulness | info_loss | length | 주요 변경 |
|------|-----------|----------|--------------|-----------|--------|-----------|
| v1 | 4.93 / 5.0 | 5.0 | 5.0 | 5.0 | 4.17 | 기본 프롬프트 |
| v2 | 4.98 / 5.0 | 5.0 | 5.0 | 5.0 | 4.83 | 원문 길이 구간별 기준 추가 (500자 미만 / 500~2000자 / 2000자 이상) |
| v3 | 4.97 / 5.0 | 5.0 | 5.0 | 5.0 | 4.83 | 요약 작성 후 길이 자체 검토 단계 추가 |

**개선 포인트:** Judge Agent가 매 버전마다 `length_adequacy` 를 취약 지표로 식별 →
Prompt Improver가 길이 기준을 점진적으로 구체화 → v1(4.93) → v2(4.98)로 향상

> 모든 문서(뉴스 2건, 논문 2건, 회의록 2건)에서 v2 기준 전 항목 A등급 달성

## 시작하기

```bash
git clone https://github.com/UnderCruzer/eval-driven-summarizer
cd eval-driven-summarizer

cp .env.example .env
# .env에 ANTHROPIC_API_KEY 입력

pip install -e ".[dev]"
```

## 실행 방법

```bash
# 1. 단순 평가 실행
python -m pipeline.run --version v1

# 2. 전체 개선 루프 (평가 → 분석 → 개선 제안 → 승인)
python -m pipeline.loop --version v1

# 3. 버전 간 회귀 비교
python -c "from pipeline.regression import RegressionTracker; RegressionTracker().compare('v1', 'v2')"

# 4. 트레이스 드릴다운
python -m pipeline.trace_viewer
python -m pipeline.trace_viewer --run-id <run_id> --doc-id news_001

# 5. 대시보드
streamlit run dashboard/app.py
```

## CI

PR 생성 시 `agent/`, `eval/`, `pipeline/`, `data/` 변경 감지 → 자동 Eval 실행
→ 이전 버전 대비 회귀 발생 시 머지 블락, 결과 Step Summary에 자동 기록
