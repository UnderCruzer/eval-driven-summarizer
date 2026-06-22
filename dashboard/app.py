"""
Streamlit 대시보드: streamlit run dashboard/app.py

탭 구성:
  1. 버전 비교  — 프롬프트 버전별 지표 점수 추이 차트
  2. 실패 케이스 브라우저 — 낮은 점수 케이스 드릴다운
  3. 트레이스 뷰어 — 실행 단계별 입력/출력 확인
"""
import json
import sqlite3
from pathlib import Path

import pandas as pd
import streamlit as st

DB_PATH = Path("data/results.db")

st.set_page_config(page_title="Eval Dashboard", page_icon="📊", layout="wide")
st.title("📊 Eval-Driven Summarizer — Dashboard")


# ── 공통 유틸 ──────────────────────────────────────────────────────────────

def load_results() -> pd.DataFrame:
    if not DB_PATH.exists():
        return pd.DataFrame()
    with sqlite3.connect(DB_PATH) as conn:
        return pd.read_sql("SELECT * FROM eval_results ORDER BY created_at", conn)


def load_traces() -> pd.DataFrame:
    if not DB_PATH.exists():
        return pd.DataFrame()
    with sqlite3.connect(DB_PATH) as conn:
        try:
            return pd.read_sql("SELECT * FROM traces ORDER BY id", conn)
        except Exception:
            return pd.DataFrame()


df = load_results()

if df.empty:
    st.warning("아직 Eval 결과가 없습니다. `python -m pipeline.run` 을 먼저 실행하세요.")
    st.stop()

# ── 탭 ────────────────────────────────────────────────────────────────────

tab1, tab2, tab3 = st.tabs(["📈 버전 비교", "🔍 실패 케이스", "🧵 트레이스"])


# ═══════════════════════════════════════════════════════════════════════════
# TAB 1 — 버전 비교
# ═══════════════════════════════════════════════════════════════════════════
with tab1:
    st.subheader("프롬프트 버전별 지표 비교")

    metrics = ["total_score", "key_point_coverage", "faithfulness",
               "information_loss", "length_adequacy"]

    version_avg = (
        df.groupby("prompt_version")[metrics]
        .mean()
        .round(3)
        .reset_index()
    )

    # 총점 추이
    st.markdown("#### 버전별 평균 총점")
    st.bar_chart(version_avg.set_index("prompt_version")["total_score"])

    # 지표별 레이더 대용 — 멀티 라인 차트
    st.markdown("#### 지표별 점수 추이")
    chart_df = version_avg.set_index("prompt_version")[metrics[1:]]  # total 제외
    st.line_chart(chart_df)

    # 상세 표
    st.markdown("#### 버전별 상세 수치")
    st.dataframe(version_avg, use_container_width=True)

    # 등급 분포
    st.markdown("#### 등급 분포")
    grade_dist = df.groupby(["prompt_version", "grade"]).size().reset_index(name="count")
    grade_pivot = grade_dist.pivot(index="prompt_version", columns="grade", values="count").fillna(0)
    st.bar_chart(grade_pivot)


# ═══════════════════════════════════════════════════════════════════════════
# TAB 2 — 실패 케이스 브라우저
# ═══════════════════════════════════════════════════════════════════════════
with tab2:
    st.subheader("실패 케이스 브라우저")

    col1, col2 = st.columns(2)
    with col1:
        version_filter = st.selectbox(
            "프롬프트 버전",
            ["전체"] + sorted(df["prompt_version"].unique().tolist()),
        )
    with col2:
        threshold = st.slider("총점 임계값 이하만 표시", 0.0, 5.0, 3.0, 0.1)

    filtered = df[df["total_score"] <= threshold]
    if version_filter != "전체":
        filtered = filtered[filtered["prompt_version"] == version_filter]

    st.markdown(f"**{len(filtered)}건** 해당")

    if filtered.empty:
        st.success("해당 조건의 실패 케이스가 없습니다.")
    else:
        for _, row in filtered.iterrows():
            grade_emoji = {"A": "🟢", "B": "🟡", "C": "🟠", "F": "🔴"}.get(row["grade"], "⚪")
            with st.expander(
                f"{grade_emoji} [{row['prompt_version']}] {row['doc_id']} — 총점 {row['total_score']} ({row['grade']})"
            ):
                c1, c2, c3, c4 = st.columns(4)
                c1.metric("Coverage", row["key_point_coverage"])
                c2.metric("Faithfulness", row["faithfulness"])
                c3.metric("Info Loss", row["information_loss"])
                c4.metric("Length", row["length_adequacy"])

                st.markdown("**요약 내용**")
                st.info(row["summary"])

                st.markdown("**평가 근거**")
                try:
                    reasoning = json.loads(row["reasoning"])
                    for metric, text in reasoning.items():
                        st.markdown(f"- **{metric}**: {text}")
                except Exception:
                    st.text(row["reasoning"])


# ═══════════════════════════════════════════════════════════════════════════
# TAB 3 — 트레이스 뷰어
# ═══════════════════════════════════════════════════════════════════════════
with tab3:
    st.subheader("실행 단계 트레이스")

    traces = load_traces()
    if traces.empty:
        st.info("트레이스 데이터가 없습니다.")
    else:
        run_ids = sorted(traces["run_id"].unique().tolist(), reverse=True)
        selected_run = st.selectbox("Run ID 선택", run_ids)

        run_traces = traces[traces["run_id"] == selected_run]
        doc_ids = ["전체"] + sorted(run_traces["doc_id"].unique().tolist())
        selected_doc = st.selectbox("문서 선택", doc_ids)

        if selected_doc != "전체":
            run_traces = run_traces[run_traces["doc_id"] == selected_doc]

        stage_colors = {
            "summarize": "🔵", "judge": "🟡", "analyze": "🟣", "improve": "🟢"
        }

        for _, t in run_traces.iterrows():
            icon = stage_colors.get(t["stage"], "⚪")
            status = "❌" if t["error"] else "✅"
            with st.expander(
                f"{icon} {t['stage'].upper()} | {t['doc_id']} | {t['elapsed_ms']:.1f}ms {status}"
            ):
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown("**Input**")
                    try:
                        st.json(json.loads(t["input_data"]))
                    except Exception:
                        st.text(t["input_data"])
                with c2:
                    st.markdown("**Output**")
                    try:
                        st.json(json.loads(t["output_data"]))
                    except Exception:
                        st.text(t["output_data"])

                if t["error"]:
                    st.error(f"Error: {t['error']}")
