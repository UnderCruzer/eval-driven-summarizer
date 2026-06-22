import json
import sqlite3
from pathlib import Path

DB_PATH = Path("data/results.db")


def init_proposal_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS proposals (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                base_version    TEXT NOT NULL,
                new_version     TEXT NOT NULL,
                new_system_prompt   TEXT NOT NULL,
                new_user_template   TEXT NOT NULL,
                rationale       TEXT NOT NULL,
                avg_score       REAL NOT NULL,
                weak_metric     TEXT NOT NULL,
                patterns        TEXT NOT NULL,
                status          TEXT NOT NULL DEFAULT 'pending',
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                decided_at      TEXT
            )
        """)


def save_proposal(
    base_version: str,
    new_version: str,
    new_system_prompt: str,
    new_user_template: str,
    rationale: str,
    avg_score: float,
    weak_metric: str,
    patterns: list[dict],
) -> int:
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            """
            INSERT INTO proposals
            (base_version, new_version, new_system_prompt, new_user_template,
             rationale, avg_score, weak_metric, patterns)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                base_version, new_version, new_system_prompt, new_user_template,
                rationale, avg_score, weak_metric,
                json.dumps(patterns, ensure_ascii=False),
            ),
        )
        return cur.lastrowid


def get_latest_proposal() -> dict | None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM proposals ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return dict(row) if row else None


def get_proposal(proposal_id: int) -> dict | None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM proposals WHERE id = ?", (proposal_id,)
        ).fetchone()
    return dict(row) if row else None


def update_proposal_status(proposal_id: int, status: str) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE proposals SET status = ?, decided_at = datetime('now') WHERE id = ?",
            (status, proposal_id),
        )
