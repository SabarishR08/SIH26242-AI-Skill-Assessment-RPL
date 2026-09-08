"""Stage: lora — QLoRA fine-tune of a small instruct model on PathFinder's
structured-JSON tasks (resume extraction, GitHub skill mapping, quiz
generation, rubric grading), distilled from the 70B provider the app uses
today.

GATED: runs only when ``ml/data/distill/train.jsonl`` exists. Each line is
``{"messages": [{"role": "system"|"user"|"assistant", "content": "..."}]}``
— exactly the prompts the app sends via ``chatJson`` and the provider's
accepted JSON reply. Generate it from the app side (see README, "Stage 2").

A 3B model in 4-bit with r=16 adapters fits comfortably in the 5070's 12 GB.
Output: ``models/lora-adapter`` (PEFT adapter). Merge + GGUF conversion for
Ollama is documented in the README; the app already speaks to Ollama through
its OpenAI-compatible provider slot.
"""
from __future__ import annotations

import inspect
from pathlib import Path

from .common import ML_ROOT, device_name, gpu_info


def run(cfg: dict, out_dir: Path, log, smoke: bool = False) -> dict:
    data_path = ML_ROOT / "data" / "distill" / "train.jsonl"
    if not data_path.exists():
        log.warning("lora: %s not found - stage skipped (see README, Stage 2)", data_path)
        return {"status": "skipped", "reason": f"missing {data_path.name}"}
    if device_name() != "cuda":
        log.warning("lora: no CUDA device - stage skipped")
        return {"status": "skipped", "reason": "no cuda"}

    import torch
    from datasets import load_dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    lcfg = cfg["lora"]
    base = lcfg["base_model"]
    log.info("lora: base=%s gpu=%s", base, gpu_info())

    ds = load_dataset("json", data_files=str(data_path))["train"]
    if smoke:
        ds = ds.select(range(min(32, len(ds))))
    split = ds.train_test_split(test_size=0.05, seed=int(cfg["seed"]))

    tok = AutoTokenizer.from_pretrained(base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    bnb = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    model = AutoModelForCausalLM.from_pretrained(base, quantization_config=bnb, device_map="auto")
    model.config.use_cache = False

    peft_cfg = LoraConfig(
        r=int(lcfg["lora_r"]),
        lora_alpha=int(lcfg["lora_alpha"]),
        lora_dropout=0.05,
        target_modules="all-linear",
        task_type="CAUSAL_LM",
    )

    # trl renamed max_seq_length -> max_length across versions; pass whichever exists.
    sft_kwargs = dict(
        output_dir=str(out_dir / "tmp_lora"),
        num_train_epochs=1 if smoke else float(lcfg["epochs"]),
        per_device_train_batch_size=int(lcfg["batch_size"]),
        gradient_accumulation_steps=int(lcfg["grad_accum"]),
        learning_rate=float(lcfg["learning_rate"]),
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        bf16=True,
        logging_steps=10,
        save_strategy="no",
        eval_strategy="epoch",
        gradient_checkpointing=True,
        report_to="none",
        seed=int(cfg["seed"]),
        packing=False,
    )
    params = inspect.signature(SFTConfig.__init__).parameters
    length_key = "max_length" if "max_length" in params else "max_seq_length"
    sft_kwargs[length_key] = int(lcfg["max_seq_length"])
    args = SFTConfig(**{k: v for k, v in sft_kwargs.items() if k in params})

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=split["train"],
        eval_dataset=split["test"],
        peft_config=peft_cfg,
        processing_class=tok,
    )
    out = trainer.train()
    metrics = trainer.evaluate()
    adapter_dir = out_dir / "models" / "lora-adapter"
    trainer.save_model(str(adapter_dir))
    tok.save_pretrained(str(adapter_dir))
    log.info("lora: done, train loss %.4f eval %s", out.training_loss, metrics)
    return {
        "status": "ok",
        "base_model": base,
        "train_rows": len(split["train"]),
        "eval_rows": len(split["test"]),
        "train_loss": round(float(out.training_loss), 4),
        "eval_loss": round(float(metrics.get("eval_loss", 0.0)), 4),
    }
