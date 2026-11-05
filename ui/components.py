"""
ui/components.py - Reusable Streamlit UI Components
Avatars, Chat Bubbles, Welcome Cards, Toast Notifications, and Loading Skeletons
Follows Phase 3 Step 9 Specification
"""

import streamlit as st
from datetime import datetime
from typing import List, Dict, Any, Optional

def render_welcome_screen(user_name: str = "there"):
    """Renders personalized welcome screen with 4 suggested prompt cards"""
    hour = datetime.now().hour
    greeting = "Good morning" if 5 <= hour < 12 else ("Good afternoon" if 12 <= hour < 18 else "Good evening")

    st.markdown(f"""
    <div class="welcome-container">
      <div class="welcome-heading">{greeting}, {user_name} 👋</div>
      <div class="welcome-sub">How can LocalGPT assist your research, coding, and document analysis today?</div>
    </div>
    """, unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    prompt_selected = None

    with col1:
        if st.button("🧠 Explain Transformers\n\nWalk through self-attention, multi-head queries, and SwiGLU", key="prompt_btn_1", use_container_width=True):
            prompt_selected = "Explain the architecture of Transformer models, specifically how multi-head self-attention and SwiGLU work."
        if st.button("📄 Search Document Notes\n\nAnalyze vector embeddings and retrieve knowledge from files", key="prompt_btn_2", use_container_width=True):
            prompt_selected = "Summarize the key concepts found in my uploaded documents and provide source references."

    with col2:
        if st.button("🐍 Python Code Architect\n\nDesign clean, modular software solutions with type hints", key="prompt_btn_3", use_container_width=True):
            prompt_selected = "Act as a Python Software Architect. Explain best practices for building an agentic RAG system."
        if st.button("🔬 LLM Internal Activations\n\nInspect next-token logits and attention weights layer by layer", key="prompt_btn_4", use_container_width=True):
            prompt_selected = "How does the Qwen 2.5 transformer output layer compute next-token probabilities using RMSNorm and Softmax?"

    return prompt_selected

def render_source_chips(sources: List[Dict[str, Any]]):
    """Renders interactive badges for retrieved RAG chunks"""
    if not sources:
        return

    st.markdown("**📚 Verified Citations:**")
    for idx, s in enumerate(sources):
        doc_name = s.get("doc_name", "Document")
        page = s.get("page", 1)
        score = s.get("score", 0.0)
        snippet = s.get("text", "")

        score_text = f" · Match: {score:.2f}" if score > 0 else ""
        with st.expander(f"📄 {doc_name} · Page {page}{score_text}"):
            st.markdown(f"> {snippet}")

def render_skeleton():
    """Renders loading skeleton animation while model runs"""
    st.markdown("""
    <div style="display: flex; gap: 12px; margin-bottom: 20px;">
      <div class="skeleton-box" style="width: 34px; height: 34px; border-radius: 8px;"></div>
      <div style="flex: 1;">
        <div class="skeleton-box" style="width: 40%; height: 16px; margin-bottom: 8px;"></div>
        <div class="skeleton-box" style="width: 80%; height: 14px; margin-bottom: 6px;"></div>
        <div class="skeleton-box" style="width: 60%; height: 14px;"></div>
      </div>
    </div>
    """, unsafe_allow_html=True)

def render_toast(message: str, icon: str = "✅"):
    """Displays friendly toast message"""
    try:
        st.toast(message, icon=icon)
    except Exception:
        st.info(f"{icon} {message}")

def render_token_chips(candidates: List[Dict[str, Any]]):
    """Renders token chips colored by softmax probability"""
    if not candidates:
        return
    chips_html = '<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">'
    for c in candidates:
        token = c.get("token", "").replace(" ", "␣")
        prob = c.get("probability", 0.0) * 100
        # Color gradient based on probability
        if prob > 50:
            bg = "rgba(16, 185, 129, 0.25)"
            border = "rgba(16, 185, 129, 0.6)"
            color = "#6ee7b7"
        elif prob > 20:
            bg = "rgba(59, 130, 246, 0.25)"
            border = "rgba(59, 130, 246, 0.6)"
            color = "#93c5fd"
        else:
            bg = "rgba(148, 163, 184, 0.2)"
            border = "rgba(148, 163, 184, 0.4)"
            color = "#cbd5e1"

        chips_html += f'<span class="token-chip" style="background: {bg}; border-color: {border}; color: {color};"><b>{token}</b> ({prob:.1f}%)</span>'
    chips_html += '</div>'
    st.markdown(chips_html, unsafe_allow_html=True)

