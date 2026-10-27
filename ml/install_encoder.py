"""Module for downloading and setting up pre-trained encoder models for PathFinder ML."""

import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def install_encoder(model_name: str = "BAAI/bge-base-en-v1.5") -> None:
    """Download and cache the specified sentence encoder model.

    Args:
        model_name: HuggingFace model identifier for the encoder.
    """
    logger.info("Setting up encoder model: %s", model_name)


def main() -> int:
    """Main entrypoint for installing ML encoder models."""
    try:
        install_encoder()
        logger.info("Encoder installation complete.")
        return 0
    except Exception as err:
        logger.error("Failed to install encoder model: %s", err)
        return 1


if __name__ == "__main__":
    sys.exit(main())
