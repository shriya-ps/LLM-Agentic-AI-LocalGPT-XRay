"""
embeddings.py - Embedding Generator
Uses SentenceTransformers or Model Embeddings
"""

import numpy as np

class EmbeddingEngine:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.encoder = None

    def load(self):
        if self.encoder is None:
            try:
                from sentence_transformers import SentenceTransformer
                self.encoder = SentenceTransformer(self.model_name)
            except Exception as e:
                print(f"Notice: Using TF-IDF/Hash embedding fallback: {e}")
        return self.encoder

    def encode(self, texts: list) -> np.ndarray:
        encoder = self.load()
        if encoder:
            return encoder.encode(texts, convert_to_numpy=True)
        # Fallback deterministic bag-of-words / hash vectors
        vectors = []
        for t in texts:
            vec = np.zeros(384, dtype=np.float32)
            for w in t.lower().split():
                h = abs(hash(w)) % 384
                vec[h] += 1.0
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec /= norm
            vectors.append(vec)
        return np.array(vectors, dtype=np.float32)
