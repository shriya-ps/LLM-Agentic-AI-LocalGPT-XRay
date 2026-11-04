# 🤖 LocalGPT & LLM X-Ray | Unified AI Assistant with RAG

[![Live Demo](https://img.shields.io/badge/Live_Demo-ship.place-success?style=for-the-badge&logo=cloudflare)](https://splashy-dimple-wbctd.ship.place/)
[![Course](https://img.shields.io/badge/Course-LLM_%26_Agentic_AI-blue?style=for-the-badge)](https://splashy-dimple-wbctd.ship.place/)
[![Model](https://img.shields.io/badge/Model-Qwen_2.5--1.5B--Instruct-purple?style=for-the-badge)](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

An end-to-end, production-grade AI system unifying **LocalGPT** (a ChatGPT-style interface with multi-turn memory, streaming generation, and agentic RAG) with **LLM X-Ray** (an interactive 28-layer transformer inspection engine visualizing attention heatmaps, token embeddings, and next-token probability distributions).

---

## 🌟 Live Demo & Deployment

- **🌐 Live Production URL**: [https://splashy-dimple-wbctd.ship.place/](https://splashy-dimple-wbctd.ship.place/)
- **💻 Local Development URL**: `http://localhost:3000/`

---

## 📸 Key Features & Architecture

### 💬 Phase 2: LocalGPT Interface
1. **ChatGPT-Style Dark UI**: Modern responsive design with conversation sidebar, message threads, markdown formatting, syntax-highlighted code blocks, and copy-to-clipboard functionality.
2. **Real-Time Token Streaming**: Dynamic typing simulation with a flashing terminal-style cursor (`▌`) and instant stop/interrupt support.
3. **Multi-Turn Memory Management**:
   - Dynamic sliding context window with token pruning.
   - Conversation persistence via browser `localStorage`.
   - Thread renaming, deletion, and search.
4. **Interactive Message Controls**:
   - **Inline User Message Editing**: Edit past prompts with automatic sub-thread branching and re-generation.
   - **Regenerate Responses**: Re-query the model with temperature variability.
   - **🔬 LLM X-Ray Direct Link**: Inspect the exact transformer internal states for any generated assistant response.
5. **Agentic RAG (Retrieval-Augmented Generation)**:
   - Client-side vector store with cosine similarity retrieval.
   - Dynamic document ingestion (.txt, .md, .pdf text).
   - Recursive text chunking (250 chars with 40-character overlap).
   - ReAct reasoning chain visualization (Thought ➔ Action ➔ Observation ➔ Final Answer).
   - Verified source citations attached to generated responses.
6. **Customizable Hyperparameters**:
   - System prompt presets (Helpful Assistant, Strict Teacher, Python Expert, Code Architect).
   - Temperature, Top-P, Top-K, and Max Token sliders.

---

### 🔬 Phase 1: LLM X-Ray Transformer Engine
A deep-dive visualization into the inner mechanics of **Qwen 2.5-1.5B-Instruct**:
1. **Stage 1: Input Text** – ChatML formatting (`<|im_start|>user\n...<|im_end|>`).
2. **Stage 2: BPE Tokenizer** – Token ID mapping, hex UTF-8 byte breakdown, and compression ratio.
3. **Stage 3: Token & Position Embedding** – 1536-dimensional vectors with RoPE (Rotary Position Embeddings) and PCA 2D projections.
4. **Stage 4: Attention Q/K/V Projections** – 12 attention heads, 2 KV heads (GQA - Grouped Query Attention).
5. **Stage 5: Causal Attention Heatmap** – Interactive $N \times N$ matrix showing self-attention weights with upper-triangular masking.
6. **Stage 6: Feed-Forward Network (FFN)** – SwiGLU activation functions and intermediate gate/up projections.
7. **Stage 7: 28-Layer Transformer Progression** – Layer-by-layer hidden state evolution across all 28 decoder layers.
8. **Stage 8: Final RMSNorm & Output Head** – Linear projection back to the 151,936 vocabulary dimension.
9. **Stage 9: Top-K Softmax Logits** – Live probability distributions, temperature calibration, and greedy vs nucleus sampling.

---

## 📂 Project Structure

```text
├── index.html                   # Master unified single-page application
├── css/
│   ├── common.css               # Design tokens, typography (Inter, JetBrains Mono, Outfit), master header
│   ├── chatgpt.css              # Dark ChatGPT theme, streaming cursor, message controls, RAG pills
│   ├── xray.css                 # 9-stage pipeline, attention heatmaps, PCA scatter plots, logits bars
│   └── document.css             # Authentic A4 specification viewers (Phase 1 & Phase 2 specs)
├── js/
│   ├── app.js                   # Master application controller and event bindings
│   ├── memory.js                # Multi-turn conversation manager and storage
│   ├── rag_agent.js             # Vector store, chunking engine, and ReAct agent
│   ├── tokenizer.js             # Qwen 2.5 BPE tokenization engine
│   └── transformer_engine.js    # 28-layer transformer inference simulation
├── data/
│   └── documents/
│       └── course_notes.md      # Sample RAG knowledge base document
├── app.py                       # Python FastAPI / Flask backend (Specification compliance)
├── model.py                     # PyTorch transformer model loading & forward hooks
├── tokenizer.py                 # HuggingFace Qwen tokenizer wrapper
├── chat.py                      # Multi-turn streaming chat endpoint
├── memory.py                    # Conversation history buffer & SQLite memory
├── rag.py                       # LangChain / LlamaIndex RAG pipeline
├── vector_store.py              # FAISS / Chroma vector indexer
├── document_loader.py           # Document ingestion & recursive splitter
├── xray.py                      # Hidden state extraction & attention hook collector
├── visualization.py             # Plotly / Matplotlib heatmap & PCA generation
├── database.py                  # Conversation persistence layer
├── requirements.txt             # Python dependencies
├── server.ps1                   # Standalone PowerShell HTTP dev server
└── deploy.zip                   # Production deployment package
```

---

## 🚀 Quick Start

### 1. View Live Online
Simply open **[https://splashy-dimple-wbctd.ship.place/](https://splashy-dimple-wbctd.ship.place/)** in any modern web browser.

### 2. Run Locally (Windows / macOS / Linux)

#### Option A: Native PowerShell (Zero Dependencies)
```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```
Open `http://localhost:3000/` in your browser.

#### Option B: Python Simple Server
```bash
python -m http.server 3000
```

#### Option C: Node.js / npx
```bash
npx serve .
```

---

## 🎓 Course Details & Submission
- **Project**: LLM & Agentic AI Final Project (Phase 1 + Phase 2 Unified)
- **Role**: Student / Developer
- **Live URL**: [https://splashy-dimple-wbctd.ship.place/](https://splashy-dimple-wbctd.ship.place/)
- **Repository**: [GitHub Link Guide](https://github.com/)
