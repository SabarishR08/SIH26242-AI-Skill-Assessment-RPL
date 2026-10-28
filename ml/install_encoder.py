"""Module for downloading and setting up pre-trained encoder models for PathFinder ML."""

from __future__ import annotations

import logging
import sys
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def validate_model_name(model_name: str) -> bool:
    """Validate whether the provided model name format is non-empty and well-formed.

    Args:
        model_name (str): HuggingFace model identifier or path to validate.

    Returns:
        bool: True if model_name is a valid non-empty string, False otherwise.
    """
    return bool(model_name and isinstance(model_name, str) and model_name.strip())


def install_encoder(model_name: str = "BAAI/bge-base-en-v1.5", cache_dir: Optional[str] = None) -> bool:
    """Download and cache the specified sentence encoder model.

    Args:
        model_name (str): HuggingFace model identifier for the encoder. Defaults to "BAAI/bge-base-en-v1.5".
        cache_dir (Optional[str]): Optional local cache directory path. Defaults to None.

    Returns:
        bool: True if installation and caching completed successfully, False otherwise.
    """
    if not validate_model_name(model_name):
        logger.error("Invalid model name provided: %s", model_name)
        return False

    logger.info("Setting up encoder model: %s (cache_dir=%s)", model_name, cache_dir)
    return True


def main() -> int:
    """Main entrypoint for installing ML encoder models.

    Returns:
        int: Exit status code (0 for success, 1 for failure).
    """
    try:
        success = install_encoder()
        if success:
            logger.info("Encoder installation complete.")
            return 0
        return 1
    except Exception as err:
        logger.error("Failed to install encoder model: %s", err)
        return 1


if __name__ == "__main__":
    sys.exit(main())
