---
title: Eval Driven Summarizer
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# eval-driven-summarizer

![Eval CI](https://github.com/UnderCruzer/eval-driven-summarizer/actions/workflows/eval.yml/badge.svg)

**LLM-as-a-Judge 기반 문서 요약 에이전트 — 평가·개선·승인 루프 + AX 패턴 시연**

> AX(Agent Experience) 포트폴리오 프로젝트.  
> 에이전트가 요약을 평가하고 스스로 프롬프트를 개선하며, 사람이 최종 승인하는 Human-in-the-Loop 파이프라인입니다.

---

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **LLM-as-a-Judge** | 4가지 지표로 요약 품질 자동 평가 |
| **Prompt Auto-Improvement** | 실패 패턴 분석 → 프롬프트 개선안 자동 생성 |
| **Human Approval Gate** | 에이전트 제안을 사람이 검토 후 승인/거절 |
| **Confidence Signal + Autonomy Dial** | 신뢰도 임계값 이상이면 에이전트가 자동 승인 |
| **멀티 에이전트 크리틱** | Summarizer A → Critic → Summarizer B 파이프라인 |
| **에이전트 토론** | 간결 전략 vs 포괄 전략 → Judge 최적안 선정 |
| **출처 분석 (Explainability)** | 요약 문장별 원문 출처 하이라이트 |
| **URL 크롤링** | URL 입력 → 기사 자동 크롤링 → 즉석 요약·평가 |
| **실시간 SSE 스트리밍** | Eval 진행 상황 서버→브라우저 실시간 전송 |

---

## AX 패턴

```
Confidence Signal   — avg_score 표시로 에이전트 자신감 가시화
Autonomy Dial       — 임계값 슬라이더로 자동화 수준 조절
Explainable Rationale — 지표별 판단 근거 상세 표시
Intent Preview      — 승인 전 새 프롬프트 적용 결과 미리보기 (WIP)
```

---

## 평가 지표

| 지표 | 가중치 | 설명 |
|------|--------|------|
| key_point_coverage | 35% | 핵심 포인트를 얼마나 커버했는가 |
| faithfulness | 30% | 원문과 사실적으로 일치하는가 |
| information_loss | 25% | 중요한 정보를 얼마나 보존했는가 |
| length_adequacy | 10% | 길이가 적절한가 (150~350자 기준) |

총점은 가중 평균으로 산출되며 **A(4.0+) / B(3.0+) / C(2.0+) / F**로 등급 부여

---

## 파이프라인

```
문서 입력
  → Summarizer Agent  (요약 생성)
  → Judge Agent       (LLM-as-a-Judge 평가)
  → Failure Analyzer  (실패 패턴 분류)
  → Prompt Improver   (프롬프트 자동 개선 제안)
  → Human Approval    (승인 게이트 — Autonomy Dial로 자동화 가능)
  → 반복
```

---

## 프로젝트 구조

```
agent/
  summarizer.py     # 요약 에이전트
  critic.py         # 크리틱 에이전트 (멀티 에이전트 크리틱)
  debate.py         # 토론 에이전트 (전략 A vs B)
  explainer.py      # 출처 분석 에이전트
  crawler.py        # URL 크롤러 (BeautifulSoup)
  llm.py            # Gemini API 중앙 래퍼
  prompts.py        # 프롬프트 버전 관리
eval/
  judge.py          # LLM-as-a-Judge
  analyzer.py       # 실패 패턴 분류
pipeline/
  runner.py         # 비동기 배치 평가 파이프라인
  improver.py       # 프롬프트 개선 + Human Approval Gate
  tracer.py         # 단계별 트레이스 수집
app/
  main.py           # FastAPI (Eval API + 대시보드 API + React UI 서빙)
  database.py       # 제안 저장/조회 (SQLite)
ui/src/
  components/       # React 컴포넌트
  ├─ PlaygroundTab  # 텍스트 입력 / URL 크롤링 즉석 요약
  ├─ AgentLabTab    # 멀티 에이전트 크리틱 + 에이전트 토론
  ├─ ExplainTab     # 출처 분석 (문장↔원문 하이라이트)
  ├─ AutonomyDial   # Autonomy Dial (자동 승인 임계값)
  └─ dashboard/     # 버전 비교 / 실패 케이스 / 트레이스
data/
  documents/        # 테스트 문서 (뉴스·논문·회의록)
  ground_truth/     # 핵심 포인트 + 참조 요약
```

---

## 로컬 실행

```bash
git clone https://github.com/UnderCruzer/eval-driven-summarizer
cd eval-driven-summarizer

# 환경변수 설정
cp .env.example .env
# .env에 GEMINI_API_KEY 입력

# 의존성 설치
pip install -e ".[dev]"

# 서버 실행
uvicorn app.main:app --reload
# → http://localhost:8000
```

개발 시 React HMR 사용:
```bash
cd ui && npm install && npm run dev
# → http://localhost:5173
```

---

## 배포 (Hugging Face Spaces)

**라이브 데모:** https://huggingface.co/spaces/UnderCruzer/eval-driven-summarizer

Docker 기반으로 배포되며, `GEMINI_API_KEY`를 Space Secrets에 설정하면 됩니다.

---

## CI

PR 생성 시 `agent/`, `eval/`, `pipeline/`, `data/` 변경 감지 → 자동 Eval 실행  
→ 이전 버전 대비 회귀 발생 시 결과를 Step Summary에 자동 기록
