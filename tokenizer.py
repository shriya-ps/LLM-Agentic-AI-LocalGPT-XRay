"""
tokenizer.py - Tokenization & ChatML Protocol Handling
Step 4 Implementation for Qwen 2.5
"""

from typing import List, Dict, Any

class TokenizerHelper:
    def __init__(self, tokenizer=None):
        self.tokenizer = tokenizer

    def format_chatml(self, messages: List[Dict[str, str]]) -> str:
        """Constructs ChatML format with <|im_start|> and <|im_end|> tags"""
        prompt = ""
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
        prompt += "<|im_start|>assistant\n"
        return prompt

    def tokenize_details(self, text: str) -> List[Dict[str, Any]]:
        """Extracts token strings, token IDs, lengths, and byte representations"""
        if self.tokenizer is None:
            # Fallback representation
            tokens = text.split()
            return [{"index": i, "token": t, "id": hash(t) % 151643} for i, t in enumerate(tokens)]

        token_ids = self.tokenizer.encode(text)
        records = []
        for idx, tid in enumerate(token_ids):
            token_str = self.tokenizer.decode([tid])
            utf8_bytes = " ".join([f"0x{b:02X}" for b in token_str.encode('utf-8')])
            records.append({
                "index": idx,
                "token": token_str,
                "token_id": tid,
                "length": len(token_str),
                "is_special": tid in self.tokenizer.all_special_ids,
                "utf8_bytes": utf8_bytes
            })
        return records
