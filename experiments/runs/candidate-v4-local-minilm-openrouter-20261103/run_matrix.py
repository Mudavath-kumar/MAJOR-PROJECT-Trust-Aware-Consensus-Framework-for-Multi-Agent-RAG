import json
import os
from pathlib import Path
import shutil

from sentence_transformers import SentenceTransformer
from experiments import run_exploratory_matrix as matrix
from app.core.config import settings

root = Path.cwd()
run_dir = root / "experiments/runs/candidate-v4-local-minilm-openrouter-20261103"
config_dir = run_dir / "configs"
config_dir.mkdir(parents=True, exist_ok=True)
for name in matrix.VARIANT_CONFIGS:
    source = root / "experiments/configs" / f"{name}.json"
    config = json.loads(source.read_text(encoding="utf-8"))
    config["model"] = "gemini-3.5-flash-lite"
    config["embedding_model"] = "sentence-transformers/all-MiniLM-L6-v2"
    destination = config_dir / source.name
    destination.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

snapshots = Path(r"C:\Users\kumar\.cache\huggingface\hub\models--sentence-transformers--all-MiniLM-L6-v2\snapshots")
model_path = next(snapshots.iterdir())
model = SentenceTransformer(str(model_path), local_files_only=True)
matrix.CONFIG_DIR = config_dir
matrix._default_embedder = lambda texts: model.encode(texts, normalize_embeddings=True).tolist()
settings.GEMINI_MODEL = "gemini-3.5-flash-lite"
settings.OPENROUTER_API_KEY = ""

report = matrix.run_exploratory_matrix(
    root / "experiments/runs/candidate-v4-local-minilm-openrouter-20261103/pilot-4.jsonl",
    root / "experiments/datasets/trustrag-public-candidate-v4/trustrag-v1.manifest.json",
    run_dir / "pilot-gemini4",
    embedding_cache=run_dir / "pilot-output/embedding-cache.jsonl",
)
print(f"report={report}")
