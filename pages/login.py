"""
pages/login.py - Full-Screen Authentication Page
Handles Google Sign-In, Email/Password Login & Signup, and Password Reset
Follows Phase 3 Step 4 & Step 8 Specifications
"""

import os
import streamlit as st
import streamlit.components.v1 as components
from auth.auth import login, is_logged_in
from auth.firebase_config import get_firebase_web_config
from ui.theme import load_css, get_current_theme

# Page Setup
st.set_page_config(
    page_title="Sign in · LocalGPT Pro",
    page_icon="◆",
    layout="centered",
    initial_sidebar_state="collapsed"
)

theme = get_current_theme()
load_css(theme)

# If already logged in, redirect to workspace
if is_logged_in():
    try:
        st.switch_page("pages/workspace.py")
    except Exception:
        st.success("You are logged in! Navigate to Workspace.")
        st.stop()

# Load declare_component for custom bidirectional auth iframe
component_dir = os.path.join(os.path.dirname(__file__), "..", "auth", "login_component")
component_dir = os.path.abspath(component_dir)

try:
    auth_component = components.declare_component("firebase_login", path=component_dir)
    firebase_config = get_firebase_web_config()
    token_result = auth_component(firebaseConfig=firebase_config, default=None)
except Exception as e:
    token_result = None

# If token returned by custom component, log user in
if token_result:
    user = login(token_result)
    if user:
        st.toast(f"Welcome back, {user.get('name')}!", icon="🎉")
        try:
            st.switch_page("pages/workspace.py")
        except Exception:
            st.rerun()

# Fallback Native UI for instant accessibility
with st.expander("🛠️ Quick Access / Offline Login Panel", expanded=False):
    st.caption("For rapid evaluation and offline testing:")
    col_u1, col_u2 = st.columns(2)
    with col_u1:
        if st.button("👩‍💻 Sign In as Priya Sharma (Account A)", use_container_width=True):
            user = login({
                "uid": "priya_sharma_uid",
                "email": "priya@gmail.com",
                "name": "Priya Sharma",
                "provider": "google.com"
            })
            try:
                st.switch_page("pages/workspace.py")
            except Exception:
                st.rerun()
    with col_u2:
        if st.button("👨‍💻 Sign In as Tarun Kumar (Account B)", use_container_width=True):
            user = login({
                "uid": "tarun_kumar_uid",
                "email": "tarun@gmail.com",
                "name": "Tarun Kumar",
                "provider": "google.com"
            })
            try:
                st.switch_page("pages/workspace.py")
            except Exception:
                st.rerun()

