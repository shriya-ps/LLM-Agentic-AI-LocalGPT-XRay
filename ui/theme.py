"""
ui/theme.py - Theme Manager & Styling Injector
Loads dark/light CSS tokens and brand styling
Follows Phase 3 Step 9 Specification
"""

import os
import streamlit as st

def load_css(theme: str = "dark"):
    """Reads assets/style.css and injects it into Streamlit with theme attribute"""
    css_path = os.path.join("assets", "style.css")
    css_content = ""
    if os.path.exists(css_path):
        with open(css_path, "r", encoding="utf-8") as f:
            css_content = f.read()

    theme_attr = f'data-theme="{theme}"'
    html = f"""
    <style>
      {css_content}
    </style>
    <script>
      document.documentElement.setAttribute('data-theme', '{theme}');
    </script>
    """
    st.markdown(html, unsafe_allow_html=True)

def get_current_theme() -> str:
    """Gets theme from session state or user preference"""
    if "theme" in st.session_state:
        return st.session_state.theme
    user = st.session_state.get("user")
    if user and isinstance(user, dict):
        try:
            from database import Database
            db = Database()
            u = db.get_user(user.get("uid"))
            if u and u.get("theme"):
                st.session_state.theme = u["theme"]
                return u["theme"]
        except Exception:
            pass
    return "dark"

def toggle_theme():
    """Toggles theme between dark and light"""
    current = get_current_theme()
    new_theme = "light" if current == "dark" else "dark"
    st.session_state.theme = new_theme
    user = st.session_state.get("user")
    if user and isinstance(user, dict):
        try:
            from database import Database
            db = Database()
            db.update_user_profile(user["uid"], theme=new_theme)
        except Exception:
            pass
    return new_theme

