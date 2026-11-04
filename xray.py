"""
xray.py - LLM X-Ray Inspection Engine
Extracts Attention weights, Hidden States, Logits, and Softmax probabilities from Qwen 2.5
"""

import torch
import torch.nn.functional as F
from typing import Dict, Any

class LLMXRayInspector:
    def __init__(self, model_manager):
        self.mm = model_manager

    def inspect(self, prompt: str) -> Dict[str, Any]:
        """Runs full forward pass with outputs enabled to inspect activations"""
        tokenizer, model = self.mm.load()
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

        with torch.no_grad():
            outputs = model(**inputs, output_attentions=True, output_hidden_states=True)

        input_ids = inputs["input_ids"][0].tolist()
        tokens = [tokenizer.decode([tid]) for tid in input_ids]

        # 1. Attentions: list of [batch, num_heads, seq_len, seq_len]
        # Extract layer 12 head 4 as target default
        attentions_summary = {
            "total_layers": len(outputs.attentions),
            "num_heads": outputs.attentions[0].shape[1],
            "seq_len": len(tokens)
        }

        # 2. Hidden states: list of [batch, seq_len, hidden_dim]
        hidden_states_summary = {
            "total_layers": len(outputs.hidden_states),
            "hidden_dim": outputs.hidden_states[0].shape[-1]
        }

        # 3. Next token logits & softmax
        next_token_logits = outputs.logits[0, -1, :]
        probs = F.softmax(next_token_logits, dim=-1)
        top_probs, top_indices = torch.topk(probs, 5)

        candidates = []
        for p, idx in zip(top_probs.tolist(), top_indices.tolist()):
            candidates.append({
                "token": tokenizer.decode([idx]),
                "token_id": idx,
                "probability": float(p)
            })

        return {
            "tokens": tokens,
            "token_ids": input_ids,
            "attentions_summary": attentions_summary,
            "hidden_states_summary": hidden_states_summary,
            "next_token_candidates": candidates
        }
