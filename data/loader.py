from pathlib import Path
from typing import Optional
import json
from pydantic import BaseModel


class TestCase(BaseModel):
    doc_id: str
    doc_type: str  # news | paper | meeting
    content: str
    key_points: list[str]
    reference_summary: str
    ideal_length_chars: tuple[int, int]


def load_test_cases(
    doc_type: Optional[str] = None,
    data_dir: Path = Path(__file__).parent,
) -> list[TestCase]:
    docs_dir = data_dir / "documents"
    gt_dir = data_dir / "ground_truth"

    cases = []
    for gt_path in sorted(gt_dir.glob("*.json")):
        gt = json.loads(gt_path.read_text(encoding="utf-8"))

        if doc_type and gt["doc_type"] != doc_type:
            continue

        doc_path = docs_dir / f"{gt['doc_id']}.txt"
        if not doc_path.exists():
            continue

        cases.append(
            TestCase(
                doc_id=gt["doc_id"],
                doc_type=gt["doc_type"],
                content=doc_path.read_text(encoding="utf-8"),
                key_points=gt["key_points"],
                reference_summary=gt["reference_summary"],
                ideal_length_chars=tuple(gt["ideal_length_chars"]),
            )
        )

    return cases
