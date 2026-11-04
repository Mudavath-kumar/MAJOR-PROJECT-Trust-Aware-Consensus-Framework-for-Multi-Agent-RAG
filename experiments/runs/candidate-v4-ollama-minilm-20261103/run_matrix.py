import asyncio
import json
from pathlib import Path
import httpx
from sentence_transformers import SentenceTransformer
from experiments import run_exploratory_matrix as matrix
from app.core.config import settings
from app.core.llm_telemetry import record_llm_attempt, complete_llm_attempt

root = Path.cwd()
run_dir = root / "experiments/runs/candidate-v4-ollama-minilm-20261103"
config_dir = run_dir / "configs"
for name in matrix.VARIANT_CONFIGS:
    source = root / "experiments/configs" / f"{name}.json"
    config = json.loads(source.read_text(encoding="utf-8"))
    config["model"] = "ollama/qwen2.5-coder:1.5b"
    config["embedding_model"] = "sentence-transformers/all-MiniLM-L6-v2"
    (config_dir / source.name).write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

model_path = Path(r"C:\Users\kumar\.cache\huggingface\hub\models--sentence-transformers--all-MiniLM-L6-v2\snapshots")
model_path = next(model_path.iterdir())
embed_model = SentenceTransformer(str(model_path), local_files_only=True)
matrix.CONFIG_DIR = config_dir
matrix._default_embedder = lambda texts: embed_model.encode(texts, normalize_embeddings=True).tolist()
settings.GEMINI_API_KEY = ""
settings.OPENROUTER_API_KEY = ""
settings.TAVILY_API_KEY = ""

async def local_llm(prompt, system_prompt="", model=None, temperature=0.1, api_key_override=None, max_output_tokens=1024):
    attempt = record_llm_attempt("ollama", "qwen2.5-coder:1.5b")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post("http://127.0.0.1:11434/api/chat", json={
                "model": "qwen2.5-coder:1.5b",
                "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
                "format": "json",
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_output_tokens},
            })
            response.raise_for_status()
            content = response.json().get("message", {}).get("content", "")
            if not content:
                raise ValueError("Ollama returned empty content")
            complete_llm_attempt(attempt, succeeded=True)
            return content
    except Exception:
        complete_llm_attempt(attempt, succeeded=False)
        raise

import app.core.llm_router as llm_router
llm_router.call_llm = local_llm

report = matrix.run_exploratory_matrix(
    root / "experiments/reports/candidate-review-v4-automated-20261103/candidate-v4-automated-approved-exploratory.jsonl",
    root / "experiments/datasets/trustrag-public-candidate-v4/trustrag-v1.manifest.json",
    run_dir / "output",
)
print(f"report={report}")