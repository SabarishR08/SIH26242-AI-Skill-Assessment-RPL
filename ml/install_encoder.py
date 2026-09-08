#!/usr/bin/env python
"""Install a returned run's ONNX retriever as the app's runtime encoder.

    python ml/install_encoder.py <path-to-unzipped-run>      # e.g. ml/trained/run

Copies the tokenizer/config files, quantizes the fp32 ONNX export to int8
(127 MB -> 32 MB, cosine agreement with the trained vectors ~0.97) and drops
the tagger weights next to the other artefacts. The encoder is git-ignored;
the app runs without it, just without semantic search or the skill tagger.

Needs: pip install onnx onnxruntime
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEST = REPO / "data" / "ml" / "encoder"
TOKENIZER_FILES = ["config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt"]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    run = Path(sys.argv[1])
    onnx_dir = run / "models" / "retriever-onnx"
    src_model = onnx_dir / "onnx" / "model.onnx"
    if not src_model.exists():
        print(f"ERROR: {src_model} not found. Did the run's ONNX export succeed? (REPORT.md -> retriever.onnx_export)")
        return 1

    (DEST / "onnx").mkdir(parents=True, exist_ok=True)
    for name in TOKENIZER_FILES:
        src = onnx_dir / name
        if src.exists():
            shutil.copy2(src, DEST / name)

    try:
        from onnxruntime.quantization import QuantType, quantize_dynamic
    except ImportError:
        print("ERROR: pip install onnx onnxruntime")
        return 1

    out = DEST / "onnx" / "model_quantized.onnx"
    quantize_dynamic(str(src_model), str(out), weight_type=QuantType.QUInt8)
    print(f"encoder: {src_model.stat().st_size / 2**20:.0f} MB fp32 -> {out.stat().st_size / 2**20:.0f} MB int8 at {DEST}")

    weights = run / "models" / "tagger" / "weights.json"
    if weights.exists():
        shutil.copy2(weights, REPO / "data" / "ml" / "tagger_weights.json")
        print(f"tagger:  {weights.stat().st_size / 2**20:.1f} MB -> data/ml/tagger_weights.json")

    artifacts = run / "artifacts"
    if artifacts.exists():
        for f in artifacts.glob("*.json"):
            shutil.copy2(f, REPO / "data" / "ml" / f.name)
        manifest = run / "manifest.json"
        if manifest.exists():
            shutil.copy2(manifest, REPO / "data" / "ml" / "manifest.json")
        print(f"artefacts: {len(list(artifacts.glob('*.json')))} files -> data/ml/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
