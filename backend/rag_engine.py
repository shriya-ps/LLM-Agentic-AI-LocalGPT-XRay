"""
Phase 3 — RAG Engine (Document ingestion, chunking, vector search)
Supports: PDF, DOCX, TXT, CSV, JSON
"""
import os
import io
import json
import csv
import re
from typing import List, Dict, Optional, Tuple
import numpy as np

# Optional heavy imports — graceful fallback
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False

try:
    import faiss
    HAS_FAISS = True
except ImportError:
    HAS_FAISS = False

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False


# ─────────────────────────────────────────────────────
# Document Text Extractor
# ─────────────────────────────────────────────────────

def extract_text_from_file(file_bytes: bytes, filename: str) -> Tuple[str, List[Dict]]:
    """
    Extracts plain text from uploaded file.
    Returns (full_text, page_chunks) where page_chunks = [{text, page}]
    """
    ext = filename.lower().split(".")[-1] if "." in filename else "txt"
    page_chunks = []

    if ext == "pdf":
        if not HAS_PYPDF:
            raise ValueError("pypdf not installed — cannot read PDF files")
        reader = PdfReader(io.BytesIO(file_bytes))
        full_text = ""
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            full_text += page_text + "\n"
            page_chunks.append({"text": page_text, "page": i + 1})
        return full_text, page_chunks

    elif ext == "docx":
        if not HAS_DOCX:
            raise ValueError("python-docx not installed — cannot read DOCX files")
        doc = DocxDocument(io.BytesIO(file_bytes))
        full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        page_chunks = [{"text": full_text, "page": 1}]
        return full_text, page_chunks

    elif ext == "csv":
        text_parts = []
        reader = csv.DictReader(io.StringIO(file_bytes.decode("utf-8", errors="replace")))
        for row in reader:
            row_text = " | ".join(f"{k}: {v}" for k, v in row.items())
            text_parts.append(row_text)
        full_text = "\n".join(text_parts)
        page_chunks = [{"text": full_text, "page": 1}]
        return full_text, page_chunks

    elif ext == "json":
        data = json.loads(file_bytes.decode("utf-8", errors="replace"))
        full_text = json.dumps(data, indent=2)
        page_chunks = [{"text": full_text, "page": 1}]
        return full_text, page_chunks

    else:
        # TXT or unknown
        full_text = file_bytes.decode("utf-8", errors="replace")
        page_chunks = [{"text": full_text, "page": 1}]
        return full_text, page_chunks


# ─────────────────────────────────────────────────────
# Text Chunker
# ─────────────────────────────────────────────────────

def chunk_text(
    text: str,
    chunk_size: int = 400,
    overlap: int = 60,
    page_chunks: Optional[List[Dict]] = None,
) -> List[Dict]:
    """
    Recursively splits text into overlapping chunks.
    If page_chunks provided, preserves page metadata.
    """
    # Clean whitespace
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk_text_str = text[start:end].strip()
        if chunk_text_str:
            # Find page from page_chunks (approximate by character offset)
            page = 1
            if page_chunks:
                offset = start
                cumulative = 0
                for pc in page_chunks:
                    cumulative += len(pc["text"])
                    page = pc.get("page", 1)
                    if cumulative >= offset:
                        break

            chunks.append({
                "text": chunk_text_str,
                "page": page,
                "char_start": start,
                "char_end": end,
            })
        start += chunk_size - overlap

    return chunks


# ─────────────────────────────────────────────────────
# In-Memory RAG Store (per user, keyed by user_id)
# ─────────────────────────────────────────────────────

class UserRAGStore:
    """
    Per-user in-memory RAG vector store.
    Uses sentence-transformers + FAISS if available, else TF-IDF cosine.
    """
    def __init__(self):
        self._stores: Dict[str, "DocStore"] = {}

    def get_store(self, user_id: str) -> "DocStore":
        if user_id not in self._stores:
            self._stores[user_id] = DocStore()
        return self._stores[user_id]

    def clear_user(self, user_id: str):
        if user_id in self._stores:
            del self._stores[user_id]


class DocStore:
    """Holds vector-indexed chunks for one user."""

    def __init__(self):
        self.chunks: List[Dict] = []  # {doc_id, doc_name, text, page, vector}
        self._embedder = None
        self._index = None  # FAISS index

    def _get_embedder(self):
        if self._embedder is None and HAS_SENTENCE_TRANSFORMERS:
            self._embedder = SentenceTransformer("all-MiniLM-L6-v2")
        return self._embedder

    def _tf_vector(self, text: str) -> Dict[str, float]:
        """TF fallback when sentence-transformers is unavailable."""
        words = text.lower().split()
        tf: Dict[str, float] = {}
        for w in words:
            w = re.sub(r'[^\w]', '', w)
            if len(w) >= 3:
                tf[w] = tf.get(w, 0.0) + 1.0
        # Normalize
        total = sum(tf.values()) or 1
        return {k: v / total for k, v in tf.items()}

    def _cosine_tf(self, a: Dict, b: Dict) -> float:
        dot = sum(a.get(k, 0.0) * v for k, v in b.items())
        norm_a = sum(v * v for v in a.values()) ** 0.5
        norm_b = sum(v * v for v in b.values()) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def add_document(self, doc_id: str, doc_name: str, chunks: List[Dict]):
        """Adds document chunks to the store."""
        embedder = self._get_embedder()
        texts = [c["text"] for c in chunks]

        if embedder and HAS_FAISS:
            embeddings = embedder.encode(texts, convert_to_numpy=True, show_progress_bar=False)
            for i, chunk in enumerate(chunks):
                self.chunks.append({
                    "doc_id": doc_id,
                    "doc_name": doc_name,
                    "text": chunk["text"],
                    "page": chunk.get("page", 1),
                    "embedding": embeddings[i],
                })
        else:
            # TF fallback
            for chunk in chunks:
                self.chunks.append({
                    "doc_id": doc_id,
                    "doc_name": doc_name,
                    "text": chunk["text"],
                    "page": chunk.get("page", 1),
                    "tf_vector": self._tf_vector(chunk["text"]),
                })

    def remove_document(self, doc_id: str):
        self.chunks = [c for c in self.chunks if c["doc_id"] != doc_id]

    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        """Returns top_k most relevant chunks with scores."""
        if not self.chunks:
            return []

        embedder = self._get_embedder()

        if embedder and "embedding" in self.chunks[0]:
            query_emb = embedder.encode([query], convert_to_numpy=True)[0]
            scored = []
            for chunk in self.chunks:
                emb = chunk["embedding"]
                score = float(np.dot(query_emb, emb) / (np.linalg.norm(query_emb) * np.linalg.norm(emb) + 1e-8))
                scored.append({**chunk, "score": score})
        else:
            query_tf = self._tf_vector(query)
            scored = []
            for chunk in self.chunks:
                score = self._cosine_tf(query_tf, chunk.get("tf_vector", {}))
                scored.append({**chunk, "score": score})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return [c for c in scored[:top_k] if c["score"] > 0.05]


# Global singleton
rag_store = UserRAGStore()


def build_rag_context(results: List[Dict]) -> str:
    """Formats retrieved chunks into a context string for the LLM prompt."""
    if not results:
        return ""
    parts = []
    for i, r in enumerate(results):
        source = f"{r['doc_name']}"
        if r.get("page"):
            source += f" (page {r['page']})"
        parts.append(f"[Source {i+1}: {source}]\n{r['text']}")
    return "\n\n---\n\n".join(parts)

