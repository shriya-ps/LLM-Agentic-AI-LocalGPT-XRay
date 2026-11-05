# 🤖 LocalGPT Pro & LLM X-Ray | Secure Multi-User AI Assistant

[![Live Demo](https://img.shields.io/badge/Live_Demo-ship.place-success?style=for-the-badge&logo=cloudflare)](https://splashy-dimple-wbctd.ship.place/)
[![Phase 3](https://img.shields.io/badge/Phase_3-LocalGPT_Pro-orange?style=for-the-badge)](pages/workspace.py)
[![Model](https://img.shields.io/badge/Model-Qwen_2.5--1.5B--Instruct-purple?style=for-the-badge)](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)
[![Auth](https://img.shields.io/badge/Auth-Firebase_Identity-yellow?style=for-the-badge)](auth/auth.py)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

An end-to-end, enterprise-grade AI system unifying:
- **Phase 1: LLM X-Ray** – Interactive 28-layer transformer inspection engine (attention heatmaps, token embeddings, SwiGLU FFN, logits).
- **Phase 2: LocalGPT** – ChatGPT-style dark interface with streaming generation, sliding context memory, and client/server agentic RAG.
- **Phase 3: LocalGPT Pro** – Secure multi-user product with Firebase Authentication (Google Sign-In & Email), per-user isolated SQLite database, per-user FAISS vector indices, protected routes, dark/light theme, inline X-Ray drawer, and chat export (Markdown & PDF).

The LLM stays local on your laptop (`Qwen/Qwen2.5-1.5B-Instruct`), and Firebase is used **strictly for identity**. No prompts, responses, or documents are ever sent to any external LLM API.

---

## 🌟 Deployments & Access

- **🌐 Live Production Web URL**: [https://splashy-dimple-wbctd.ship.place/](https://splashy-dimple-wbctd.ship.place/)
- **💻 Local Web Demo**: `http://localhost:3000/` (via `server.ps1`)
- **🚀 Local Streamlit Multi-User Pro App**: `http://localhost:8501/` (via `streamlit run app.py`)

---

## 📸 Key Features by Phase

### 🔐 Phase 3: LocalGPT Pro (Multi-User & Enterprise UI)
1. **Firebase Authentication**:
   - Google Sign-In with popup (`signInWithPopup + GoogleAuthProvider`).
   - Email + Password login and signup with password strength validator (min 8 characters).
   - Email verification (`sendEmailVerification`) and password reset email.
   - Persistent login session (`browserLocalPersistence`) and secure logout.
   - ⚡ Built-in **Instant Test Accounts** ("Priya Sharma" & "Tarun Kumar") for rapid evaluator demonstration.
2. **Strict Per-User Data Isolation**:
   - Every database query in `database.py` filters by `uid = current_user.uid`.
   - Separate per-user document folders: `data/users/<uid>/documents/`.
   - Separate per-user FAISS vector indices: `data/users/<uid>/faiss_index/`.
   - Separate per-user exports: `data/users/<uid>/exports/`.
   - **User A can never see User B's chats, documents, or retrieval results**.
3. **Protected Routes (`auth/guards.py`)**:
   - Unauthenticated visitors are automatically stopped and routed to `pages/login.py`.
   - Model weights load once via `@st.cache_resource` and are shared securely across all local user sessions.
4. **Redesigned Advanced UI**:
   - Dark / Light mode toggle saved per user.
   - Sidebar conversation search, pinned chats, and date grouping (Today, Yesterday, Last 7 days, Older).
   - Hover / popup actions: Rename, Pin, Delete with confirm dialog.
   - Personal welcome screen: *"Good morning/evening, <name>"* with 4 interactive suggested prompt cards.
   - Streaming responses with dynamic cursor (`▌`) and instant stop support.
   - Response action buttons: Copy, Regenerate, Edit, 👍 / 👎, and 🔬 LLM X-Ray.
5. **Collapsible Inline X-Ray Drawer**:
   - Inspect activations per response without navigating away.
   - 6 tabs: **Tokens | Embeddings | Layers | Attention | Hidden States | Logits**.
   - Token chips colored dynamically by softmax probability.
6. **Per-User Document Manager (`pages/documents.py`)**:
   - Drag-and-drop upload for PDF, DOCX, TXT, MD, CSV, JSON (20 MB limit).
   - Animated 4-step progress bar (Extract ➔ Chunk ➔ Embed ➔ Index).
   - Verified source citations (`filename · page`) expandable in chat.
   - Interactive vector retrieval testing playground.
7. **Chat Export (`export.py`)**:
   - Export any chat to GitHub Flavored **Markdown (.md)** or formatted **PDF (.pdf)** using ReportLab.
8. **User Profile & Privacy (`pages/profile.py`)**:
   - Edit display name, view member status and sign-in provider.
   - User-saved model hyperparameters (Temperature, Top-P, Top-K, Max Tokens, Default System Prompt).
   - "Delete all my chats" and "Delete my account" complete data wipe.

---

### 💬 Phase 2: LocalGPT Core Engine
- Real-time token streaming with autoregressive Qwen 2.5 generation.
- Dynamic sliding context window with conversation pruning.
- Agentic RAG pipeline with cosine similarity vector retrieval.

---

### 🔬 Phase 1: LLM X-Ray Transformer Engine
- 28-layer transformer forward-pass inspection of Qwen 2.5-1.5B-Instruct.
- Causal self-attention heatmap visualization (Layer 12, Head 4).
- 1536-dimensional RoPE embeddings with 2D PCA projection scatter plots.
- Top-K softmax next-token probability distribution bar charts.

---

## 📂 Project Architecture

```text
project 2/
├── app.py                     # Master entry point, routes to login or workspace
├── auth/                      # Firebase Authentication Layer
│   ├── firebase_config.py     # Loads Firebase Web App config from .env
│   ├── firebase_admin_init.py # Initializes Firebase Admin SDK & token verification
│   ├── auth_component.html    # Mirror reference of authentication component
│   ├── login_component/       # Bidirectional Streamlit component
│   │   └── index.html         # Firebase JS SDK: Google popup, email forms, test accounts
│   ├── auth.py                # High-level auth: login(), logout(), get_current_user()
│   └── guards.py              # Route guard: require_login() for protected pages
├── pages/                     # Streamlit Multipage Views
│   ├── login.py               # Full-screen login, signup, forgot password, quick test logins
│   ├── workspace.py           # Main chat workspace, streaming, RAG toggle, inline X-Ray
│   ├── documents.py           # Per-user document manager, drag-and-drop, FAISS indexer
│   └── profile.py             # User profile, theme toggle, model settings, danger zone
├── ui/                        # UI Tokens & Components
│   ├── theme.py               # Dark/light theme manager & CSS injector
│   ├── components.py          # Welcome screen, source chips, token chips, skeleton
│   └── sidebar.py             # Date-grouped chats, search, pinning, user card menu
├── assets/                    # Static UI Assets
│   ├── style.css              # Custom brand styles, bubbles, responsive layout
│   └── logo.svg               # LocalGPT Pro vector brand logo
├── export.py                  # Conversation export to Markdown (.md) and PDF (.pdf)
├── database.py                # SQLite multi-user DB (users, chats, messages, documents, settings)
├── rag.py                     # User-isolated RAG pipeline (extract -> chunk -> embed -> index)
├── vector_store.py            # User-isolated FAISS vector store with disk persistence
├── document_loader.py         # Multi-format document loader with page tracking
├── embeddings.py              # SentenceTransformers & fallback vector encoder
├── model.py                   # HuggingFace Qwen 2.5 PyTorch model loader & singleton
├── tokenizer.py               # HuggingFace Qwen tokenizer wrapper
├── chat.py                    # Multi-turn streaming chat engine
├── xray.py                    # 28-layer hidden state & attention hook extractor
├── visualization.py           # Plotly interactive heatmaps & PCA scatter plots
├── .env                       # Firebase web configuration (keep private)
├── serviceAccountKey.json     # Firebase admin private key (keep private)
├── .gitignore                 # Excludes secrets, databases, and user files
├── requirements.txt           # Unified Phase 1, 2, and 3 dependencies
├── server.ps1                 # Native HTTP dev server for static web frontend
├── index.html                 # Phase 1 & Phase 2 static web application
├── css/ & js/                 # Web application assets
└── data/                      # Isolated Storage Root
    └── users/                 # Per-User Private Storage
        └── <uid>/
            ├── documents/     # User's uploaded files
            ├── faiss_index/   # User's FAISS index & chunk metadata
            └── exports/       # User's exported chat PDFs and Markdown
```

---

## 🚀 Quick Start Guide

### 1. Install Requirements
```bash
pip install -r requirements.txt
```

### 2. Configure Firebase (Optional for Testing)
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project named `localgpt-pro`.
2. Under **Authentication ➔ Sign-in method**, enable **Google** and **Email/Password**.
3. Under **Authentication ➔ Settings ➔ Authorized domains**, ensure `localhost` is listed.
4. Under **Project settings ➔ General ➔ Your apps**, add a **Web app**, and copy the config values into `.env`.
5. Under **Project settings ➔ Service accounts**, click **Generate new private key**, and save it as `serviceAccountKey.json`.

*(Note: If testing without a live Firebase account, the application includes built-in instant test accounts for **Priya Sharma** and **Tarun Kumar** that verify full multi-user data isolation immediately).*

### 3. Run the Multi-User Pro App
```bash
streamlit run app.py
```
Open **`http://localhost:8501/`** in your browser.

### 4. Run the Local Web Server (Phase 1 & Phase 2 Static Stack)
```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```
Open **`http://localhost:3000/`** or view online at **[https://splashy-dimple-wbctd.ship.place/](https://splashy-dimple-wbctd.ship.place/)**.

---

## 🧪 Multi-User Data Isolation Verification (User A vs User B)

To verify that user data is strictly separated:
1. Open **`http://localhost:8501/`** and sign in as **Priya Sharma** (Account A).
2. Start a new chat titled *"Priya's Research Notes"* and upload a document in **Documents**.
3. Confirm that the document appears in Priya's document library.
4. Click **Log Out** in the sidebar.
5. Sign in as **Tarun Kumar** (Account B).
6. Notice that Tarun has an entirely clean workspace:
   - Priya's chat history is **not visible**.
   - Priya's uploaded documents are **not in Tarun's Document Library**.
   - RAG queries run by Tarun will **never retrieve or leak chunks** from Priya's documents.
7. Log back in as Priya; all of Priya's chats, documents, and settings are intact.

---

## 🔒 Security Checklist Verification

- [x] `serviceAccountKey.json` and `.env` are listed in `.gitignore`.
- [x] Every page calls `require_login()`.
- [x] Every database query filters by verified `uid`.
- [x] Uploaded file names are sanitized; file size is checked (20 MB limit).
- [x] Passwords are never stored by the local app (handled exclusively by Firebase).
- [x] Tested with two accounts: zero data leakage.
