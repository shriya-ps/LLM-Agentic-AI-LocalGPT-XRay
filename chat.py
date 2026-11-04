"""
chat.py - Multi-turn conversational interface & streaming response generator
Step 3 Implementation for LocalGPT (Phase 2)
"""

import threading
from typing import Generator, List, Dict
from transformers import TextIteratorStreamer

class ChatEngine:
    def __init__(self, model_manager):
        self.mm = model_manager

    def stream_generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.75,
        top_p: float = 0.9,
        top_k: int = 50,
        max_new_tokens: int = 256
    ) -> Generator[str, None, None]:
        """Streams tokens autoregressively from Qwen 2.5"""
        tokenizer, model = self.mm.load()
        
        # Build ChatML text
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        
        streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
        gen_kwargs = dict(
            **inputs,
            streamer=streamer,
            max_new_tokens=max_new_tokens,
            temperature=max(0.01, temperature),
            top_p=top_p,
            top_k=top_k,
            do_sample=(temperature > 0)
        )
        
        thread = threading.Thread(target=model.generate, kwargs=gen_kwargs)
        thread.start()
        
        for new_text in streamer:
            yield new_text
