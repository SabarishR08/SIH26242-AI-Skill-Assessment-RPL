#!/usr/bin/env bash
# One-click trainer for Linux / WSL. Usage: ./run.sh [--smoke] [--all] [--epochs N]
# Never relies on `pip` or an activated venv being on PATH.
set -euo pipefail
cd "$(dirname "$0")"
echo "=== PathFinder ML trainer ==="

BASEPY=""
for v in python3.13 python3.12 python3.11 python3.10 python3 python; do
  if command -v "$v" >/dev/null 2>&1; then BASEPY="$v"; break; fi
done
[ -n "$BASEPY" ] || { echo "ERROR: no Python found (need 3.10-3.13)"; exit 1; }
echo "Base interpreter: $BASEPY ($($BASEPY -c 'import sys;print(sys.version.split()[0])'))"

VENVPY=".venv/bin/python"
if [ -x "$VENVPY" ] && ! "$VENVPY" -c "import sys" >/dev/null 2>&1; then
  echo "Existing .venv is broken - recreating..."
  rm -rf .venv
fi
if [ ! -x "$VENVPY" ]; then
  echo "Creating virtual environment..."
  rm -rf .venv
  "$BASEPY" -m venv .venv
fi

"$VENVPY" -m pip install --upgrade pip setuptools wheel >/dev/null

if ! "$VENVPY" -c "import torch,sys;sys.exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null; then
  echo "Installing PyTorch with CUDA 12.8 (RTX 50-series needs torch >= 2.7)..."
  "$VENVPY" -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/cu128
fi
"$VENVPY" -m pip install -r requirements.txt
if [ -f data/distill/train.jsonl ]; then "$VENVPY" -m pip install -r requirements-lora.txt; fi

"$VENVPY" -c "import torch;print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NONE - training on CPU (much slower)')"
"$VENVPY" run_all.py "$@"
