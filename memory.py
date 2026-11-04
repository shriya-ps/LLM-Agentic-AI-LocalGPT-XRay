"""
memory.py - Context Manager & Multi-turn Conversation Memory
Handles conversation history, truncation, and persistence
"""

import json
import os
from typing import List, Dict

CONVERSATIONS_DIR = os.path.join("data", "conversations")

class ConversationMemory:
    def __init__(self, max_turns: int = 10):
        self.max_turns = max_turns
        self.history: List[Dict[str, str]] = []
        os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

    def add_message(self, role: str, content: str):
        self.history.append({"role": role, "content": content})

    def get_context_messages(self, system_prompt: str = None) -> List[Dict[str, str]]:
        """Returns pruned messages fitting the context window"""
        recent = self.history[-self.max_turns * 2:]
        if system_prompt:
            return [{"role": "system", "content": system_prompt}] + recent
        return recent

    def clear(self):
        self.history = []

    def save(self, session_id: str):
        filepath = os.path.join(CONVERSATIONS_DIR, f"{session_id}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.history, f, indent=2)

    def load(self, session_id: str):
        filepath = os.path.join(CONVERSATIONS_DIR, f"{session_id}.json")
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                self.history = json.load(f)
