"""Pre-download and cache HuggingFace transformer encoder models for PathFinder ML.

Downloads tokenizer and model weights for embedding models (e.g. BAAI/bge-base-en-v1.5)
to prepare the local environment for training and inference.
"""

from __future__ import annotations

import argparse
import sys
from transformers import AutoModel, AutoTokenizer

DEFAULT_MODEL = "BAAI/bge-base-en-v1.5"


def download_encoder(model_name: str = DEFAULT_MODEL) -> None:
    """Download and cache HuggingFace model and tokenizer.

    Args:
        model_name: HuggingFace hub model repository ID.
    """
    print(f"Pre-downloading tokenizer and model for: {model_name}")
    AutoTokenizer.from_pretrained(model_name)
    AutoModel.from_pretrained(model_name)
    print(f"Successfully downloaded and cached: {model_name}")


def main() -> int:
    """CLI entry point for downloading encoder models."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"HuggingFace model ID to download (default: {DEFAULT_MODEL})",
    )
    args = parser.parse_args()
    try:
        download_encoder(args.model)
        return 0
    except Exception as exc:
        print(f"Failed to download model '{args.model}': {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
