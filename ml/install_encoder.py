#!/usr/bin/env python
"""Pre-download and install text encoder models for PathFinder ML pipeline.

Downloads and caches sentence-transformer models (e.g. BAAI/bge-base-en-v1.5)
to ensure offline availability during model training and inference stages.
"""
from __future__ import annotations

import sys


def install_encoder(model_name: str = "BAAI/bge-base-en-v1.5") -> None:
    """Download and cache the specified sentence transformer model.

    Args:
        model_name: HuggingFace model identifier to download.
    """
    try:
        from sentence_transformers import SentenceTransformer

        print(f"Pre-loading encoder model: {model_name}...")
        SentenceTransformer(model_name)
        print(f"Successfully cached {model_name}.")
    except ImportError:
        print("Error: sentence-transformers package is not installed.", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"Failed to load model '{model_name}': {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    model = sys.argv[1] if len(sys.argv) > 1 else "BAAI/bge-base-en-v1.5"
    install_encoder(model)
