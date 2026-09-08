"""Minimal OpenAI-compatible chat client for data collection.

Reads keys from the environment, falling back to the repo's ``.env``. Any
provider the app itself supports works here (Groq, NVIDIA NIM, OpenAI-compat).
Rate limits (429) are honoured with the provider's retry-after when present.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def load_dotenv(path: Path = REPO / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


@dataclass
class Provider:
    name: str
    base_url: str
    api_key: str
    model: str


def resolve_provider(prefer: str | None = None) -> Provider:
    """``prefer`` is one of groq | nvidia | openai; default order groq, nvidia, openai."""
    load_dotenv()
    candidates = {
        "groq": Provider("groq", os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"), os.getenv("GROQ_API_KEY", ""), os.getenv("COLLECT_GROQ_MODEL", "qwen/qwen3.8-27b")),
        "nvidia": Provider("nvidia", os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"), os.getenv("NVIDIA_API_KEY", ""), os.getenv("COLLECT_NVIDIA_MODEL", "nvidia/llama-3.1-nemotron-70b-instruct")),
        "openai": Provider("openai", os.getenv("OPENAI_BASE", "https://api.openai.com/v1"), os.getenv("OPENAI_API_KEY", ""), os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
        # Gemini's OpenAI-compatible endpoint; model names rotate, check /openai/models when one 404s.
        "gemini": Provider("gemini", "https://generativelanguage.googleapis.com/v1beta/openai", os.getenv("GEMINI_API_KEY", ""), os.getenv("COLLECT_GEMINI_MODEL", "gemini-3.1-flash-lite-preview")),
    }
    order = [prefer] if prefer else []
    order += [k for k in ["groq", "gemini", "nvidia", "openai"] if k not in order]
    for name in order:
        p = candidates.get(name)
        if p and p.api_key:
            return p
    raise SystemExit("No LLM API key found (GROQ_API_KEY / NVIDIA_API_KEY / OPENAI_API_KEY)")


def reasoning_params(model: str) -> dict:
    """Keep thinking models from spending the token budget on a <think> block."""
    m = model.lower()
    if "gpt-oss" in m:
        return {"reasoning_effort": "low"}
    if "qwen3" in m:
        return {"reasoning_effort": "none"}
    return {}


def chat(provider: Provider, messages: list[dict], max_tokens: int = 1500, temperature: float = 0.7, retries: int = 6, **extra) -> str:
    payload = {"model": provider.model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
    if provider.name == "groq":
        payload.update(reasoning_params(provider.model))
    payload.update(extra)
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{provider.base_url}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {provider.api_key}",
            # Cloudflare in front of Groq rejects the default urllib agent (error 1010).
            "User-Agent": "PathFinderAI-collect/1.0",
            "Accept": "application/json",
        },
    )
    delay = 3.0
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                data = json.loads(res.read().decode("utf-8"))
                return data["choices"][0]["message"].get("content") or ""
        except urllib.error.HTTPError as e:
            text = e.read().decode("utf-8", "ignore")[:300]
            if e.code == 429 or e.code >= 500:
                wait = delay
                m = re.search(r"try again in ([\d.]+)s", text)
                if m:
                    wait = float(m.group(1)) + 0.5
                ra = e.headers.get("retry-after")
                if ra and ra.replace(".", "", 1).isdigit():
                    wait = max(wait, float(ra))
                time.sleep(min(wait, 90))
                delay = min(delay * 2, 60)
                continue
            raise RuntimeError(f"{provider.name} HTTP {e.code}: {text}")
        except (urllib.error.URLError, TimeoutError):
            time.sleep(delay)
            delay = min(delay * 2, 60)
    raise RuntimeError(f"{provider.name}: gave up after {retries} attempts")


def extract_json(raw: str):
    """Tolerant JSON extraction: strips <think>, fences, leading prose, trailing commas."""
    text = re.sub(r"<think>[\s\S]*?</think>", "", raw or "")
    text = re.sub(r"```(?:json)?", "", text)
    start = min([i for i in [text.find("{"), text.find("[")] if i >= 0], default=-1)
    if start < 0:
        return None
    text = text[start:]
    end = max(text.rfind("}"), text.rfind("]"))
    text = text[: end + 1]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Fallback: the last balanced {...} in the reply (thinking models often
    # restate the final answer at the very end).
    depth = 0
    end = -1
    for i in range(len(text) - 1, -1, -1):
        ch = text[i]
        if ch == "}":
            if depth == 0:
                end = i
            depth += 1
        elif ch == "{":
            depth -= 1
            if depth == 0 and end >= 0:
                try:
                    return json.loads(re.sub(r",\s*([}\]])", r"\1", text[i : end + 1]))
                except json.JSONDecodeError:
                    end = -1
    return None
