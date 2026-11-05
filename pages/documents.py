"""
pages/documents.py - Per-User Private Document Manager & Vector Store
Handles Drag-and-Drop Ingestion, Progress Tracking, Document Listing, and Deletion
Follows Phase 3 Step 7 & Step 9 Specifications
"""

import os
import uuid
import streamlit as st
from datetime import datetime
from auth.guards import require_login
from database import Database
from ui.theme import load_css, get_current_theme
from ui.components import render_toast
from rag import RAGPipeline

# 1. Protect Page
user = require_login()
uid = user["uid"]

st.set_page_config(
    page_title="My Documents · LocalGPT Pro",
    page_icon="📁",
    layout="wide"
)

theme = get_current_theme()
load_css(theme)

db = Database()

# Initialize per-user RAG Pipeline
if "rag_engine" not in st.session_state or st.session_state.get("rag_uid") != uid:
    st.session_state.rag_engine = RAGPipeline(user_id=uid)
    st.session_state.rag_uid = uid

rag_engine = st.session_state.rag_engine

# Top Bar
col_back, col_title = st.columns([1, 6])
with col_back:
    if st.button("← Back to Chat"):
        try:
            st.switch_page("pages/workspace.py")
        except Exception:
            pass
with col_title:
    st.title("📁 Private Document Library")
    st.caption(f"Strict user isolation enabled. Only visible to **{user.get('email')}**.")

st.markdown("---")

# ================= 1. DRAG AND DROP UPLOAD WITH PROGRESS =================
st.subheader("📤 Ingest New Documents")
st.markdown("Supported formats: **PDF, Word (DOCX), TXT, Markdown (MD), CSV, JSON** (Max: 20 MB)")

uploaded_files = st.file_uploader(
    "Choose files to index into your personal FAISS vector store",
    type=["pdf", "docx", "txt", "md", "csv", "json"],
    accept_multiple_files=True
)

if uploaded_files:
    user_docs_dir = os.path.join("data", "users", uid, "documents")
    os.makedirs(user_docs_dir, exist_ok=True)

    for f in uploaded_files:
        # Check size (20MB limit)
        if f.size > 20 * 1024 * 1024:
            st.error(f"⚠️ {f.name} exceeds the 20 MB size limit.")
            continue

        clean_name = RAGPipeline.sanitize_filename(f.name)
        save_path = os.path.join(user_docs_dir, clean_name)

        # Check if already processed in this session
        if f"indexed_{clean_name}" in st.session_state:
            continue

        with open(save_path, "wb") as out_file:
            out_file.write(f.read())

        # Progress bar animation (extract -> chunk -> embed -> index)
        progress_bar = st.progress(0, text=f"Processing {clean_name}...")
        
        def update_progress(msg: str, pct: float):
            progress_bar.progress(int(pct * 100), text=f"{clean_name}: {msg}")

        chunks_count, pages_count = rag_engine.ingest_file(save_path, progress_callback=update_progress)
        progress_bar.empty()

        # Save to database
        doc_id = f"doc_{uuid.uuid4().hex[:10]}"
        db.save_document(uid=uid, doc_id=doc_id, filename=clean_name, pages=pages_count, chunks=chunks_count)
        st.session_state[f"indexed_{clean_name}"] = True
        render_toast(f"Indexed {clean_name} ({chunks_count} chunks, {pages_count} pages)", "✅")

st.markdown("---")

# ================= 2. DOCUMENT MANAGER TABLE =================
st.subheader("📚 Your Indexed Documents")

docs = db.get_user_documents(uid)

if not docs:
    st.info("No documents uploaded yet. Drag and drop documents above to build your private knowledge base.")
else:
    for d in docs:
        c1, c2, c3, c4, c5 = st.columns([4, 1.5, 1.5, 2.5, 1.5])
        with c1:
            st.markdown(f"**📄 {d['filename']}**")
        with c2:
            st.caption(f"{d['pages']} pages")
        with c3:
            st.caption(f"{d['chunks']} chunks")
        with c4:
            st.caption(f"Uploaded: {d['uploaded_at']}")
        with c5:
            if st.button("🗑 Delete", key=f"del_doc_{d['doc_id']}"):
                # Remove from FAISS index and DB
                rag_engine.delete_document(d['filename'])
                db.delete_document(d['doc_id'], uid)
                # Remove file from disk
                try:
                    fpath = os.path.join("data", "users", uid, "documents", d['filename'])
                    if os.path.exists(fpath):
                        os.remove(fpath)
                except Exception:
                    pass
                render_toast(f"Removed {d['filename']}", "🗑")
                st.rerun()

st.markdown("---")

# ================= 3. TEST RETRIEVAL PLAYGROUND =================
st.subheader("🔍 Vector Retrieval Playground")
st.caption("Verify that semantic search retrieves only from your own documents:")

query_test = st.text_input("Enter search query to test cosine similarity matching:")
if query_test:
    results = rag_engine.retrieve_context(query_test, top_k=3)
    if not results:
        st.warning("No matching chunks found in your private index.")
    else:
        for idx, r in enumerate(results):
            with st.expander(f"Match #{idx+1}: {r['doc_name']} (Page {r.get('page', 1)}) — Score: {r.get('score', 0):.3f}"):
                st.markdown(f"> {r['text']}")

