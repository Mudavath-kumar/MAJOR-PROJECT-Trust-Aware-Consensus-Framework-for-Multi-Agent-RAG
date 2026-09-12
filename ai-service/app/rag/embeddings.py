import logging
from typing import List
import numpy as np
from ..core.config import settings

logger = logging.getLogger("trustrag.embeddings")

_model = None

def is_embedding_model_ready() -> bool:
    return _model is not None

def get_embedding_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
            logger.info(f"Loaded embedding model: {settings.EMBEDDING_MODEL_NAME}")
        except Exception as e:
            raise RuntimeError(f"Embedding model is unavailable: {e}") from e
    return _model

def compute_embeddings(texts: List[str]) -> List[List[float]]:
    model = get_embedding_model()
    try:
        embeddings = model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()
    except Exception as e:
        raise RuntimeError(f"Embedding computation failed: {e}") from e
