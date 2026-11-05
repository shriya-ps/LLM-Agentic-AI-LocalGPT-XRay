"""
auth/auth.py - Authentication Session Management
Exposes login(), signup(), logout(), verify_token()
"""

import os
import streamlit as st
from typing import Optional, Dict, Any
from auth.firebase_admin_init import verify_token
from auth.firebase_config import get_firebase_web_config

def init_user_directories(uid: str):
    """Ensures isolated data directories exist for the user"""
    base_user_dir = os.path.join("data", "users", uid)
    for folder in ["documents", "faiss_index", "exports"]:
        os.makedirs(os.path.join(base_user_dir, folder), exist_ok=True)
    return base_user_dir

def login(token_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Validates token and logs user into st.session_state.
    Inserts or updates the user in the database.
    """
    if not token_data:
        return None

    id_token = token_data.get("id_token")
    if not id_token:
        # Fallback to direct claims if provided by frontend
        uid = token_data.get("uid")
        if not uid:
            return None
        claims = {
            "uid": uid,
            "email": token_data.get("email", ""),
            "name": token_data.get("name", "LocalGPT User"),
            "picture": token_data.get("picture", ""),
            "email_verified": token_data.get("email_verified", True),
            "firebase": {"sign_in_provider": token_data.get("provider", "password")}
        }
    else:
        # Verify token cryptographically
        claims = verify_token(id_token)

    uid = claims["uid"]
    email = claims.get("email", "")
    name = claims.get("name") or token_data.get("name") or email.split("@")[0]
    picture = claims.get("picture") or token_data.get("picture") or f"https://api.dicebear.com/7.x/bottts/svg?seed={uid}"
    email_verified = claims.get("email_verified", True)
    provider = claims.get("firebase", {}).get("sign_in_provider", token_data.get("provider", "password"))

    user_obj = {
        "uid": uid,
        "email": email,
        "name": name,
        "picture": picture,
        "email_verified": email_verified,
        "provider": provider
    }

    # Store in session state
    st.session_state.user = user_obj
    
    # Ensure per-user isolated directory
    init_user_directories(uid)

    # Sync with database
    try:
        from database import Database
        db = Database()
        db.upsert_user(
            uid=uid,
            email=email,
            display_name=name,
            photo_url=picture,
            provider=provider
        )
    except Exception as e:
        print(f"User sync error in database: {e}")

    return user_obj

def logout():
    """Logs out current user and clears session state"""
    st.session_state.user = None
    if "active_chat_id" in st.session_state:
        del st.session_state["active_chat_id"]
    if "rag_engine" in st.session_state:
        del st.session_state["rag_engine"]
    if "search_query" in st.session_state:
        del st.session_state["search_query"]

def get_current_user() -> Optional[Dict[str, Any]]:
    """Returns currently authenticated user or None"""
    return st.session_state.get("user", None)

def is_logged_in() -> bool:
    """Checks whether valid user session exists"""
    user = get_current_user()
    return user is not None and "uid" in user

