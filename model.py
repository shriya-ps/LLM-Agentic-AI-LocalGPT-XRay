"""
model.py - Hugging Face Model Loader for Qwen/Qwen2.5-1.5B-Instruct
Phase 1 & Phase 2 Base Model Stack
"""

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

DEFAULT_MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"

class ModelManager:
    def __init__(self, model_id: str = DEFAULT_MODEL_ID, torch_dtype=torch.bfloat16):
        self.model_id = model_id
        self.torch_dtype = torch_dtype
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = None
        self.model = None

    def load(self):
        """Loads AutoTokenizer and AutoModelForCausalLM with output_attentions and output_hidden_states enabled"""
        if self.model is None:
            print(f"Loading {self.model_id} onto {self.device}...")
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_id,
                trust_remote_code=True
            )
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_id,
                torch_dtype=self.torch_dtype,
                device_map="auto" if torch.cuda.is_available() else None,
                output_attentions=True,
                output_hidden_states=True,
                trust_remote_code=True
            )
            if not torch.cuda.is_available():
                self.model.to("cpu")
            self.model.eval()
        return self.tokenizer, self.model

# Singleton instance
model_manager = ModelManager()
