from __future__ import annotations

import re
from dataclasses import dataclass

USER_INSTRUCTIONS_TAG = "user_additional_instructions"
_CLOSING_TAG_PATTERN = re.compile(
    rf"</\s*{re.escape(USER_INSTRUCTIONS_TAG)}\s*>",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class RenderedPrompt:
    """Encapsulates a rendered prompt pairing system and user prompts with version metadata."""

    system_prompt: str
    user_prompt: str
    system_version: str
    task_version: str

    @property
    def version_tag(self) -> str:
        return f"sys:{self.system_version}#task:{self.task_version}"


def delimit_user_instructions(instructions: str) -> str:
    """
    Wraps user-provided free-text instructions inside isolation delimiters (<user_additional_instructions>).
    Neutralizes any attempt to break out by escaping/replacing nested closing tags.
    """
    stripped = instructions.strip()
    if not stripped:
        return ""

    # Neutralize any literal closing tag within the user text to prevent delimiter breakout
    sanitized = _CLOSING_TAG_PATTERN.sub(
        f"&lt;/{USER_INSTRUCTIONS_TAG}&gt;",
        stripped,
    )

    return f"<{USER_INSTRUCTIONS_TAG}>\n{sanitized}\n</{USER_INSTRUCTIONS_TAG}>"
