"""Encoder model installer module for PathFinder ML.

Downloads and caches pre-trained HuggingFace sentence transformer models
required for offline vector search and RPL skill assessment pipelines.
"""
from __future__ import annotations

import argparse
import sys


def download_encoder(model_name: str = "BAAI/bge-base-en-v1.5") -> None:
    """Download and cache the specified sentence transformer encoder model.

    Args:
        model_name: HuggingFace model identifier.
    """
    try:
        from sentence_transformers import SentenceTransformer
        print(f"Downloading/verifying sentence transformer model: {model_name}")
        SentenceTransformer(model_name)
        print(f"Successfully cached model: {model_name}")
    except ImportError:
        print("sentence_transformers package is not installed. Install requirements first.")
        sys.exit(1)
    except Exception as exc:
        print(f"Failed to download model {model_name}: {exc}")
        sys.exit(1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="BAAI/bge-base-en-v1.5", help="Model name to download")
    args = parser.parse_args()

    download_encoder(args.model)
    return 0


if __name__ == "__main__":
    sys.exit(main())
