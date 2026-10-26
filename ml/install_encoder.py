"""Encoder Model Installer for PathFinder ML.

Pre-downloads and caches HuggingFace sentence transformer and encoder models
required for the PathFinder ML pipeline (retriever and tagger stages).
"""

from __future__ import annotations

import argparse
import logging
import sys


def parse_args() -> argparse.Namespace:
    """Parse command line arguments for encoder installation."""
    parser = argparse.ArgumentParser(
        description="Pre-download and cache encoder models for PathFinder ML."
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="BAAI/bge-base-en-v1.5",
        help="Name or path of HuggingFace encoder model to cache.",
    )
    return parser.parse_args()


def install_encoder(model_name: str) -> None:
    """Download and cache the specified encoder model.

    Args:
        model_name: HuggingFace model identifier or local path.
    """
    logging.basicConfig(level=logging.INFO)
    logging.info("Downloading and caching encoder model: %s", model_name)
    try:
        from sentence_transformers import SentenceTransformer

        SentenceTransformer(model_name)
        logging.info("Successfully installed and cached model: %s", model_name)
    except Exception as exc:
        logging.error("Failed to install model %s: %s", model_name, exc)
        sys.exit(1)


def main() -> int:
    """Main execution entry point."""
    args = parse_args()
    install_encoder(args.model_name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
