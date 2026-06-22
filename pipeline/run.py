"""
실행 진입점: python -m pipeline.run [--version v1] [--doc-type news]
"""
import argparse
import asyncio

from pipeline.runner import run_eval


def main():
    parser = argparse.ArgumentParser(description="Eval Runner")
    parser.add_argument("--version", default="v1", help="프롬프트 버전 (예: v1, v2)")
    parser.add_argument("--doc-type", default=None, choices=["news", "paper", "meeting"],
                        help="특정 문서 유형만 평가")
    parser.add_argument("--batch-size", type=int, default=3, help="동시 처리 수")
    args = parser.parse_args()

    asyncio.run(run_eval(
        prompt_version=args.version,
        doc_type=args.doc_type,
        batch_size=args.batch_size,
    ))


if __name__ == "__main__":
    main()
