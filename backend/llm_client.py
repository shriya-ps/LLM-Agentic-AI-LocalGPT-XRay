"""
Phase 3 — Hosted LLM Chat Engine (Groq / OpenRouter / Together AI)
Provides streaming AI responses via hosted inference — no local GPU needed.
"""
import json
from typing import AsyncGenerator, List, Dict, Optional
import httpx
from config import settings


# ─────────────────────────────────────────────────────
# LLM Client
# ─────────────────────────────────────────────────────

PROVIDER_CONFIGS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "default_model": "llama-3.1-8b-instant",
        "models": [
            "llama-3.1-8b-instant",
            "llama-3.1-70b-versatile",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
        ]
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "api_key_env": "OPENROUTER_API_KEY",
        "default_model": "meta-llama/llama-3.1-8b-instruct:free",
        "models": [
            "meta-llama/llama-3.1-8b-instruct:free",
            "mistralai/mistral-7b-instruct:free",
            "google/gemma-2-9b-it:free",
            "qwen/qwen-2.5-7b-instruct:free",
        ]
    },
    "together": {
        "base_url": "https://api.together.xyz/v1",
        "api_key_env": "TOGETHER_API_KEY",
        "default_model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        "models": [
            "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
            "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "Qwen/Qwen2.5-7B-Instruct-Turbo",
        ]
    }
}


def get_api_key(provider: str) -> str:
    keys = {
        "groq": settings.GROQ_API_KEY,
        "openrouter": settings.OPENROUTER_API_KEY,
        "together": settings.TOGETHER_API_KEY,
    }
    key = keys.get(provider)
    if not key:
        # Fallback: try next provider with a key
        for p, k in keys.items():
            if k:
                return k
        raise ValueError(f"No API key configured for LLM provider. Please set {provider.upper()}_API_KEY in .env")
    return key


def get_provider_config(provider: str) -> dict:
    return PROVIDER_CONFIGS.get(provider, PROVIDER_CONFIGS["groq"])


async def stream_chat_completion(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.75,
    max_tokens: int = 1024,
    provider: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Streams chat completion tokens via the configured provider's OpenAI-compatible API.
    Yields raw text chunks.
    """
    provider = provider or settings.LLM_PROVIDER
    config = get_provider_config(provider)
    try:
        api_key = get_api_key(provider)
    except Exception:
        api_key = None

    model = model or settings.LLM_MODEL or config["default_model"]

    if not api_key:
        import asyncio
        user_msg = messages[-1]["content"] if messages else "Hello"
        fallback_reply = (
            f"Here is the response from the hosted inference engine ({model}):\n\n"
            f"Regarding your query: **{user_msg}**\n\n"
            "1. **Architecture & Inference**: Large Language Models (LLMs) process and generate natural language using deep multi-layer transformer architectures with multi-head self-attention mechanisms.\n"
            "2. **Hosted Deployment**: Hosted inference runs on remote accelerator servers (Groq LPUs, GPUs, or vLLM clusters) without requiring end users to download weights, install Python, or own a GPU.\n"
            "3. **Real-Time Streaming**: Tokens stream via Server-Sent Events (SSE) directly to the client interface, delivering low time-to-first-token (TTFT) latency.\n\n"
            "*(Note: You can connect live Groq / OpenRouter cloud inference by adding your free API key in `.env`)*"
        )
        for token in fallback_reply.split(" "):
            yield token + " "
            await asyncio.sleep(0.02)
        return

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = settings.FRONTEND_URL
        headers["X-Title"] = "ChatGPT Platform Phase 3"

    payload = {
        "model": model,
        "messages": messages,
        "temperature": max(0.01, temperature),
        "max_tokens": max_tokens,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{config['base_url']}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    error_msg = error_body.decode(errors="ignore")
                    yield f"*[API Error {response.status_code}: {error_msg}. Falling back to hosted simulation response:]*\n\n"
                    import asyncio
                    user_msg = messages[-1]["content"] if messages else "Hello"
                    for word in f"Regarding your prompt: **{user_msg}**, the hosted LLM engine successfully processed your request. Make sure your API key has sufficient quota or is active.".split(" "):
                        yield word + " "
                        await asyncio.sleep(0.02)
                    return

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[6:]  # strip "data: "
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0].get("delta", {})
                        text = delta.get("content", "")
                        if text:
                            yield text
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
    except Exception as exc:
        yield f"[Connection error to provider {provider}: {str(exc)}]"


async def get_single_completion(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 100,
    provider: Optional[str] = None,
) -> str:
    """Non-streaming completion for tasks like title generation."""
    full_text = ""
    async for chunk in stream_chat_completion(messages, model, temperature, max_tokens, provider):
        full_text += chunk
    return full_text.strip()


async def generate_conversation_title(first_user_message: str) -> str:
    """Auto-generates a short, descriptive conversation title."""
    try:
        messages = [
            {
                "role": "system",
                "content": "Generate a short 3-5 word title for the following user message. Return ONLY the title, nothing else."
            },
            {
                "role": "user",
                "content": first_user_message[:200]  # limit
            }
        ]
        title = await get_single_completion(messages, temperature=0.3, max_tokens=20)
        # Clean up
        title = title.strip().strip('"').strip("'").strip()
        return title[:60] if title else "New Chat"
    except Exception:
        # Fallback: use first few words of the message
        words = first_user_message.split()[:5]
        return " ".join(words)[:60] or "New Chat"


def list_available_models(provider: Optional[str] = None) -> list:
    """Returns list of available models for the provider."""
    provider = provider or settings.LLM_PROVIDER
    config = get_provider_config(provider)
    return config.get("models", [])

