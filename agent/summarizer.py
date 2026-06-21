import os
import anthropic
from pydantic import BaseModel
from agent.prompts import PROMPTS


class SummaryOutput(BaseModel):
    doc_id: str
    doc_type: str
    summary: str
    prompt_version: str


class SummarizerAgent:
    def __init__(self, prompt_version: str = "v1"):
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = os.environ.get("SUMMARIZER_MODEL", "claude-sonnet-4-6")
        self.max_tokens = int(os.environ.get("MAX_TOKENS", "2048"))
        self.prompt_version = prompt_version

    def summarize(self, doc_id: str, doc_type: str, content: str) -> SummaryOutput:
        if self.prompt_version not in PROMPTS:
            raise ValueError(f"Unknown prompt version: {self.prompt_version}")

        system_prompt, user_template = PROMPTS[self.prompt_version]
        user_message = user_template.format(doc_type=doc_type, content=content)

        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        return SummaryOutput(
            doc_id=doc_id,
            doc_type=doc_type,
            summary=response.content[0].text.strip(),
            prompt_version=self.prompt_version,
        )
