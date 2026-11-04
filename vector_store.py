"""
vector_store.py - FAISS Vector Database for Document Similarity Search
"""

import numpy as np
from typing import List, Dict, Any

class VectorStore:
    def __init__(self, dimension: int = 384):
        self.dimension = dimension
        self.chunks: List[Dict[str, Any]] = []
        self.index = None
        self._init_faiss()

    def _init_faiss(self):
        try:
            import faiss
            self.index = faiss.IndexFlatIP(self.dimension) # Inner product / cosine similarity
        except ImportError:
            self.index = None

    def add_chunks(self, chunks: List[str], embeddings: np.ndarray, doc_name: str = ""):
        # Normalize for cosine similarity
        faiss_vectors = embeddings.copy()
        norms = np.linalg.norm(faiss_vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        faiss_vectors = faiss_vectors / norms

        if self.index is not None:
            self.index.add(faiss_vectors.astype(np.float32))

        for idx, text in enumerate(chunks):
            self.chunks.append({
                "doc_name": doc_name,
                "text": text,
                "vector": faiss_vectors[idx]
            })

    def search(self, query_vector: np.ndarray, top_k: int = 3) -> List[Dict[str, Any]]:
        if not self.chunks:
            return []

        q_norm = np.linalg.norm(query_vector)
        if q_norm > 0:
            query_vector = query_vector / q_norm

        if self.index is not None:
            scores, indices = self.index.search(query_vector.reshape(1, -1).astype(np.float32), min(top_k, len(self.chunks)))
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx != -1 and idx < len(self.chunks):
                    item = dict(self.chunks[idx])
                    item["score"] = float(score)
                    results.append(item)
            return results
        else:
            # Fallback exact dot product search
            results = []
            for item in self.chunks:
                score = float(np.dot(query_vector, item["vector"]))
                results.append({**item, "score": score})
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]
