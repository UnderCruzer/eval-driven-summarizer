import os
from pathlib import Path

import anthropic
from pydantic import BaseModel
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm

from agent.prompts import PROMPTS
from eval.analyzer import AnalysisReport

console = Console()


class ImproveProposal(BaseModel):
    base_version: str
    new_version: str
    new_system_prompt: str
    new_user_template: str
    rationale: str


class PromptImprover:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = os.environ.get("JUDGE_MODEL", "claude-sonnet-4-6")

    def propose(self, report: AnalysisReport) -> ImproveProposal:
        base_version = report.prompt_version
        system_prompt, user_template = PROMPTS[base_version]

        patterns_text = "\n".join(
            f"- [{p.category}] {p.description} ({p.frequency}건): {p.improvement_hint}"
            for p in report.patterns
        )

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=(
                "당신은 LLM 프롬프트 엔지니어입니다. "
                "평가 결과를 분석해 기존 프롬프트를 개선한 새 버전을 제안하세요. "
                "반드시 아래 JSON 형식으로만 응답하세요:\n"
                '{"system_prompt": "...", "user_template": "...", "rationale": "..."}\n'
                "user_template에는 {doc_type}과 {content} 플레이스홀더를 반드시 포함하세요."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"## 현재 프롬프트 ({base_version})\n\n"
                    f"[System]\n{system_prompt}\n\n"
                    f"[User Template]\n{user_template}\n\n"
                    f"## 평가 결과\n"
                    f"- 평균 점수: {report.avg_score} / 5.0\n"
                    f"- 가장 취약한 지표: {report.weak_metric}\n\n"
                    f"## 실패 패턴\n{patterns_text}\n\n"
                    f"## 전체 개선 제안\n{report.overall_suggestion}\n\n"
                    "위 분석을 바탕으로 개선된 프롬프트를 JSON으로 작성해 주세요."
                ),
            }],
        )

        import json
        text = response.content[0].text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        data = json.loads(text)
        new_version = _next_version(base_version)

        return ImproveProposal(
            base_version=base_version,
            new_version=new_version,
            new_system_prompt=data["system_prompt"],
            new_user_template=data["user_template"],
            rationale=data["rationale"],
        )

    def apply(self, proposal: ImproveProposal) -> bool:
        """Human Approval Gate — 사람이 확인 후 적용."""
        console.print(Panel(
            f"[bold]버전:[/] {proposal.base_version} → [green]{proposal.new_version}[/]\n\n"
            f"[bold]개선 근거:[/]\n{proposal.rationale}\n\n"
            f"[bold]새 System Prompt:[/]\n[dim]{proposal.new_system_prompt}[/]\n\n"
            f"[bold]새 User Template:[/]\n[dim]{proposal.new_user_template}[/]",
            title="프롬프트 개선 제안",
            border_style="cyan",
        ))

        approved = Confirm.ask(f"\n[yellow]{proposal.new_version}[/]을 prompts.py에 적용할까요?")
        if not approved:
            console.print("[red]적용 취소됨[/]")
            return False

        _write_to_prompts(proposal)
        console.print(f"[green]✓ {proposal.new_version} 적용 완료[/] — `python -m pipeline.run --version {proposal.new_version}` 으로 재평가하세요.")
        return True


def _next_version(current: str) -> str:
    num = int(current.lstrip("v")) + 1
    return f"v{num}"


def _write_to_prompts(proposal: ImproveProposal) -> None:
    prompts_path = Path("agent/prompts.py")
    content = prompts_path.read_text(encoding="utf-8")

    system_escaped = proposal.new_system_prompt.replace('"', '\\"')
    user_escaped = proposal.new_user_template.replace('"', '\\"')

    new_entry = (
        f'    "{proposal.new_version}": (\n'
        f'        "{system_escaped}",\n'
        f'        "{user_escaped}",\n'
        f'    ),\n'
        f'}}\n'
    )
    updated = content.rstrip().rstrip("}").rstrip() + "\n" + new_entry
    prompts_path.write_text(updated, encoding="utf-8")
