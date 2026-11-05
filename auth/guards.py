"""
auth/guards.py - Route Protection Guard
Enforces authentication for all protected pages (workspace, documents, profile)
Follows Step 6 Specification
"""

import streamlit as st

def require_login():
    """
    Guards protected pages. If user is not authenticated:
    Redirects to pages/login.py and halts further script execution.
    """
    user = st.session_state.get("user", None)
    if not user or not isinstance(user, dict) or "uid" not in user:
        try:
            st.switch_page("pages/login.py")
        except Exception:
            # Fallback if switch_page is called outside multipage context
            st.warning("⚠️ Access Denied. Please sign in to access your private workspace.")
            st.info("Navigate to the Login page to continue.")
        st.stop()
    return user

