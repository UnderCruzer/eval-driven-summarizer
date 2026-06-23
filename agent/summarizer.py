import os
from pydantic import BaseModel
from agent.prompts import PROMPTS
from agent.llm import call_llm


class SummaryOutput(BaseModel):
    doc_id: str
    doc_type: str
    summary: str
    prompt_version: str


class SummarizerAgent:
    def __init__(self, prompt_version: str = "v1"):
        self.model = os.environ.get("SUMMARIZER_MODEL", "gemini-2.5-flash")
        self.max_tokens = int(os.environ.get("MAX_TOKENS", "2048"))
        self.prompt_version = prompt_version

    def summarize(self, doc_id: str, doc_type: str, content: str) -> SummaryOutput:
        if self.prompt_version not in PROMPTS:
            raise ValueError(f"Unknown prompt version: {self.prompt_version}")

        system_prompt, user_template = PROMPTS[self.prompt_version]
        user_message = user_template.format(doc_type=doc_type, content=content)

        summary = call_llm(self.model, user_message, system=system_prompt, max_tokens=self.max_tokens)

        return SummaryOutput(
            doc_id=doc_id,
            doc_type=doc_type,
            summary=summary,
            prompt_version=self.prompt_version,
        )
