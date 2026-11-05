"""
pages/profile.py - User Profile, Preferences & Data Privacy Controls
Handles display name editing, per-user generation hyperparameters, theme selection,
and secure data wiping (Delete All Chats / Delete Account)
Follows Phase 3 Step 10 Specification
"""

import os
import shutil
import streamlit as st
from auth.guards import require_login
from auth.auth import logout
from database import Database
from ui.theme import load_css, get_current_theme, toggle_theme
from ui.components import render_toast

# 1. Protect Page
user = require_login()
uid = user["uid"]

st.set_page_config(
    page_title="User Profile · LocalGPT Pro",
    page_icon="⚙️",
    layout="wide"
)

theme = get_current_theme()
load_css(theme)

db = Database()
db_user = db.get_user(uid) or {}
settings = db.get_user_settings(uid)

# Top Bar
col_back, col_title = st.columns([1, 6])
with col_back:
    if st.button("← Back to Chat"):
        try:
            st.switch_page("pages/workspace.py")
        except Exception:
            pass
with col_title:
    st.title("⚙️ Profile & Model Preferences")

st.markdown("---")

col_left, col_right = st.columns([1, 2])

# Left Column: User Card Info
with col_left:
    st.subheader("User Identity")
    avatar_url = user.get("picture") or f"https://api.dicebear.com/7.x/bottts/svg?seed={uid}"
    st.image(avatar_url, width=110)
    
    st.markdown(f"**Name:** {db_user.get('display_name') or user.get('name') or 'LocalGPT User'}")
    st.markdown(f"**Email:** {user.get('email')}")
    st.markdown(f"**Provider:** `{user.get('provider', 'Firebase')}`")
    st.markdown(f"**Member Since:** {db_user.get('created_at', 'Today')}")
    st.markdown(f"**Last Sign In:** {db_user.get('last_login', 'Active now')}")
    
    email_ver = "✅ Verified" if user.get("email_verified", True) else "⚠️ Unverified"
    st.markdown(f"**Email Status:** {email_ver}")

# Right Column: Edit Profile & Hyperparameters
with col_right:
    st.subheader("Personalize Workspace")
    
    # 1. Edit Display Name
    current_name = db_user.get("display_name") or user.get("name") or ""
    new_name = st.text_input("Display Name", value=current_name)
    
    # 2. Theme Toggle
    st.markdown("**Theme Mode**")
    c_th1, c_th2 = st.columns([1, 3])
    with c_th1:
        theme_label = "Dark Mode 🌙" if theme == "dark" else "Light Mode ☀️"
        if st.button(theme_label):
            toggle_theme()
            st.rerun()

    # 3. Model Hyperparameters (Saved per user)
    st.markdown("---")
    st.subheader("Model Hyperparameters (Per-User)")
    st.caption("Settings persist automatically across all your chat sessions")
    
    default_sys_prompt = db_user.get("default_system_prompt") or "You are LocalGPT, a private, helpful AI assistant running locally."
    sys_prompt = st.text_area("Default System Prompt", value=default_sys_prompt, height=80)
    
    temp = st.slider("Temperature (Creativity vs Determinism)", 0.0, 2.0, float(settings.get("temperature", 0.75)), 0.05)
    top_p = st.slider("Top-P Nucleus Sampling", 0.0, 1.0, float(settings.get("top_p", 0.90)), 0.05)
    top_k = st.slider("Top-K Sampling", 1, 100, int(settings.get("top_k", 50)), 1)
    max_tokens = st.slider("Max Generated Tokens", 64, 1024, int(settings.get("max_tokens", 256)), 32)
    
    if st.button("💾 Save Preferences", type="primary"):
        db.update_user_profile(uid, display_name=new_name.strip() or None, default_system_prompt=sys_prompt.strip())
        db.update_user_settings(uid, temperature=temp, top_k=top_k, top_p=top_p, max_tokens=max_tokens)
        user["name"] = new_name.strip()
        st.session_state.user = user
        render_toast("Preferences saved successfully!", "✅")
        st.rerun()

st.markdown("---")

# ================= DANGER ZONE =================
st.subheader("🔒 Privacy & Data Removal (Data Isolation Guarantee)")
st.caption("Erase your personal chats, documents, and vector store indices:")

col_d1, col_d2 = st.columns(2)

with col_d1:
    with st.popover("🗑 Clear All My Chats"):
        st.warning("Are you sure? This permanently deletes all your conversation threads and messages.")
        if st.button("Yes, Delete All My Chats", type="primary"):
            db.delete_all_user_chats(uid)
            st.session_state.active_chat_id = None
            render_toast("All chat history wiped.", "🗑")
            st.rerun()

with col_d2:
    with st.popover("⚠️ Delete Entire Account & Data"):
        st.error("This permanently destroys your user profile, all chats, all uploaded files, and your FAISS vector index.")
        if st.button("Permanently Erase Everything", type="primary"):
            # Purge database
            db.delete_user_account(uid)
            # Purge isolated disk files
            user_data_path = os.path.join("data", "users", uid)
            if os.path.exists(user_data_path):
                shutil.rmtree(user_data_path, ignore_errors=True)
            # Log out
            logout()
            try:
                st.switch_page("pages/login.py")
            except Exception:
                pass
            st.rerun()

