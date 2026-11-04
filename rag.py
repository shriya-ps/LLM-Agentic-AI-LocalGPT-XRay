"""
rag.py - Retrieval-Augmented Generation Pipeline
Coordinates Document Ingestion, Vector Retrieval, and Context Injection
"""

from typing import List, Dict, Any
from document_loader import DocumentLoader
from embeddings import EmbeddingEngine
from vector_store import VectorStore

class RAGPipeline:
    def __init__(self):
        self.loader = DocumentLoader()
        self.embedding_engine = EmbeddingEngine()
        self.vector_store = VectorStore()
        self.indexed_files: List[str] = []

    def ingest_file(self, file_path: str):
        text = self.loader.load_file(file_path)
        if not text:
            return 0
        chunks = self.loader.chunk_text(text)
        if chunks:
            embeddings = self.embedding_engine.encode(chunks)
            doc_name = file_path.split("/")[-1].split("\\")[-1]
            self.vector_store.add_chunks(chunks, embeddings, doc_name=doc_name)
            self.indexed_files.append(doc_name)
        return len(chunks)

    def retrieve_context(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        query_vec = self.embedding_engine.encode([query])[0]
        return self.vector_store.search(query_vec, top_k=top_k)

    def build_augmented_prompt(self, user_query: str, top_k: int = 3) -> tuple:
        contexts = self.retrieve_context(user_query, top_k=top_k)
        if not contexts:
            return user_query, []

        context_str = "\n\n".join([f"Source [{c['doc_name']}]:\n{c['text']}" for c in contexts])
        augmented = f"""Use the following retrieved context to answer the question:

--- CONTEXT ---
{context_str}
--- END CONTEXT ---

User Question: {user_query}"""
        return augmented, contexts
