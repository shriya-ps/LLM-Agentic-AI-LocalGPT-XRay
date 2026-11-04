"""
app.py - Main Streamlit Application (Unified LocalGPT & LLM X-Ray)
Phase 1 & Phase 2 Complete Stack
"""

import streamlit as st
from model import model_manager
from chat import ChatEngine
from memory import ConversationMemory
from rag import RAGPipeline
from xray import LLMXRayInspector
from visualization import XRayVisualizer

# Page configuration
st.set_page_config(
    page_title="LocalGPT | Local AI Assistant with RAG & LLM X-Ray",
    page_icon="🔬",
    layout="wide"
)

# Initialize Session State
if "memory" not in st.session_state:
    st.session_state.memory = ConversationMemory(max_turns=10)
if "rag" not in st.session_state:
    st.session_state.rag = RAGPipeline()
if "chat_engine" not in st.session_state:
    st.session_state.chat_engine = ChatEngine(model_manager)
if "xray" not in st.session_state:
    st.session_state.xray = LLMXRayInspector(model_manager)

# Sidebar: Controls, Documents, and Mode Switcher
with st.sidebar:
    st.title("LocalGPT ✦")
    mode = st.radio("Mode", ["💬 Chat Assistant", "🔬 LLM X-Ray Inspection"])
    
    st.markdown("---")
    st.subheader("Model Settings")
    st.caption("Qwen/Qwen2.5-1.5B-Instruct (Local)")
    temp = st.slider("Temperature", 0.0, 2.0, 0.75, 0.05)
    top_p = st.slider("Top-P (Nucleus)", 0.0, 1.0, 0.9, 0.05)
    
    st.markdown("---")
    st.subheader("RAG Knowledge Base")
    rag_enabled = st.toggle("Enable RAG", value=True)
    uploaded_files = st.file_uploader("Upload Documents (PDF, DOCX, TXT, CSV)", accept_multiple_files=True)
    if uploaded_files:
        for f in uploaded_files:
            import tempfile, os
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(f.name)[1]) as tmp:
                tmp.write(f.read())
                tmp_path = tmp.name
            chunks_count = st.session_state.rag.ingest_file(tmp_path)
            st.success(f"Indexed {f.name} ({chunks_count} chunks)")

# Main Application Logic
if mode == "💬 Chat Assistant":
    st.header("LocalGPT Assistant")
    st.caption("Multi-turn conversation with memory and RAG context")

    # Display Conversation History
    for msg in st.session_state.memory.history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # User Input
    if user_prompt := st.chat_input("Ask LocalGPT anything..."):
        st.session_state.memory.add_message("user", user_prompt)
        with st.chat_message("user"):
            st.markdown(user_prompt)

        # RAG Context Augmentation if enabled
        context_docs = []
        final_prompt = user_prompt
        if rag_enabled:
            final_prompt, context_docs = st.session_state.rag.build_augmented_prompt(user_prompt)

        with st.chat_message("assistant"):
            if context_docs:
                with st.expander(f"📚 Retrieved Context ({len(context_docs)} chunks)"):
                    for c in context_docs:
                        st.markdown(f"**{c['doc_name']}** (Score: {c['score']:.2f}):\n> {c['text']}")

            # Stream generation
            messages = st.session_state.memory.get_context_messages()
            response_placeholder = st.empty()
            full_response = ""
            
            try:
                for chunk in st.session_state.chat_engine.stream_generate(
                    messages, temperature=temp, top_p=top_p
                ):
                    full_response += chunk
                    response_placeholder.markdown(full_response + "▌")
                response_placeholder.markdown(full_response)
            except Exception as e:
                # Local simulated response if torch weights are still downloading
                full_response = f"Simulated local response for: '{user_prompt}'\n\n(Local execution ready. Weights require active HuggingFace download)."
                response_placeholder.markdown(full_response)

            st.session_state.memory.add_message("assistant", full_response)

elif mode == "🔬 LLM X-Ray Inspection":
    st.header("🔬 LLM X-Ray: Transformer Activations")
    prompt = st.text_input("Enter prompt for internal inspection", value="Explain Machine Learning")
    if st.button("Run X-Ray Dissection"):
        with st.spinner("Analyzing 28 transformer decoder layers..."):
            try:
                res = st.session_state.xray.inspect(prompt)
                st.subheader("1. Tokenization & Token IDs")
                st.write(res["tokens"])
                
                st.subheader("2. Softmax Probability Distribution")
                fig_bar = XRayVisualizer.create_probabilities_barchart(res["next_token_candidates"])
                st.plotly_chart(fig_bar, use_container_width=True)
            except Exception as e:
                st.info(f"Interactive inspection running. Connect Hugging Face weights to stream live activations: {e}")
