"""
document_loader.py - Multi-format Document Loader
Parses PDF, Word (docx), Markdown, TXT, CSV, and JSON files
"""

import os
from typing import List, Dict

class DocumentLoader:
    @staticmethod
    def load_file(file_path: str) -> str:
        """Reads file content based on extension"""
        ext = os.path.splitext(file_path)[1].lower()
        if ext in [".txt", ".md", ".csv", ".json"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        elif ext == ".pdf":
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                return "\n".join([page.extract_text() or "" for page in reader.pages])
            except ImportError:
                return "Error: pypdf not installed."
        elif ext in [".docx", ".doc"]:
            try:
                import docx
                doc = docx.Document(file_path)
                return "\n".join([p.text for p in doc.paragraphs])
            except ImportError:
                return "Error: python-docx not installed."
        return ""

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 300, overlap: int = 50) -> List[str]:
        """Recursive sliding-window chunking"""
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start += chunk_size - overlap
        return chunks
