"""
ui/sidebar.py - Navigation & Conversation Management Sidebar
Handles chat search, pinning, date grouping, rename, delete, and user card menu
Follows Phase 3 Step 9 Specification
"""

import streamlit as st
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from database import Database
from auth.auth import logout

def group_chats_by_date(chats: List[Dict[str, Any]]):
    """Groups chats into Pinned, Today, Yesterday, Previous 7 days, and Older"""
    pinned = []
    today = []
    yesterday = []
    last_7_days = []
    older = []

    now = datetime.utcnow()
    today_date = now.date()
    yesterday_date = today_date - timedelta(days=1)
    seven_days_ago = today_date - timedelta(days=7)

    for c in chats:
        if c.get("pinned"):
            pinned.append(c)
            continue

        try:
            # Parse updated_at
            dt_str = c.get("updated_at") or c.get("created_at")
            if dt_str:
                chat_dt = datetime.strptime(dt_str.split(".")[0], "%Y-%m-%d %H:%M:%S")
                chat_date = chat_dt.date()
                if chat_date == today_date:
                    today.append(c)
                elif chat_date == yesterday_date:
                    yesterday.append(c)
                elif chat_date >= seven_days_ago:
                    last_7_days.append(c)
                else:
                    older.append(c)
            else:
                older.append(c)
        except Exception:
            older.append(c)

    return pinned, today, yesterday, last_7_days, older

def render_sidebar(current_user: Dict[str, Any], db: Database) -> Optional[str]:
    """
    Renders sidebar elements.
    Returns selected chat_id or None.
    """
    uid = current_user["uid"]

    with st.sidebar:
        # App Header Brand
        col_logo, col_title = st.columns([1, 4])
        with col_logo:
            st.markdown("""
            <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              ◆
            </div>
            """, unsafe_allow_html=True)
        with col_title:
            st.markdown("<h3 style='margin:0; padding-top:4px;'>LocalGPT Pro</h3>", unsafe_allow_html=True)

        st.caption("Secure Local AI Assistant")

        # Action: New Chat
        if st.button("➕ New Chat", use_container_width=True, type="primary"):
            new_cid = db.create_chat(uid=uid, title="New Chat")
            st.session_state.active_chat_id = new_cid
            st.rerun()

        # Search Chats Input
        search_query = st.text_input("🔍 Search chats", placeholder="Filter by title...", key="chat_search_input")

        # Chat List
        chats = db.get_user_chats(uid=uid, search_query=search_query)
        pinned, today, yesterday, last_7, older = group_chats_by_date(chats)

        active_id = st.session_state.get("active_chat_id")
        # If no active chat, select first available or create
        if not active_id and chats:
            st.session_state.active_chat_id = chats[0]["chat_id"]
            active_id = chats[0]["chat_id"]

        def render_chat_section(title: str, chat_group: List[Dict[str, Any]]):
            if not chat_group:
                return
            st.markdown(f"<div style='font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin: 12px 0 4px 4px;'>{title}</div>", unsafe_allow_html=True)
            for c in chat_group:
                cid = c["chat_id"]
                title_text = c.get("title", "Untitled Chat")
                is_active = (cid == active_id)
                pin_icon = "📌 " if c.get("pinned") else ""
                
                # Active indicator
                prefix = "▶ " if is_active else ""
                btn_label = f"{prefix}{pin_icon}{title_text[:24]}"
                
                col_btn, col_actions = st.columns([5, 2])
                with col_btn:
                    if st.button(btn_label, key=f"sel_{cid}", use_container_width=True):
                        st.session_state.active_chat_id = cid
                        st.rerun()
                with col_actions:
                    with st.popover("⚙️"):
                        st.markdown(f"**Manage Chat**")
                        # Pin / Unpin
                        pin_text = "Unpin" if c.get("pinned") else "Pin"
                        if st.button(pin_text, key=f"pin_{cid}"):
                            db.toggle_chat_pin(cid, uid)
                            st.rerun()
                        # Rename
                        new_name = st.text_input("Rename", value=title_text, key=f"ren_input_{cid}")
                        if st.button("Save", key=f"ren_btn_{cid}"):
                            if new_name.strip():
                                db.update_chat_title(cid, uid, new_name.strip())
                                st.rerun()
                        # Delete
                        if st.button("🗑 Delete", key=f"del_{cid}"):
                            db.delete_chat(cid, uid)
                            if st.session_state.get("active_chat_id") == cid:
                                st.session_state.active_chat_id = None
                            st.rerun()

        # Render sections
        render_chat_section("📌 Pinned", pinned)
        render_chat_section("Today", today)
        render_chat_section("Yesterday", yesterday)
        render_chat_section("Previous 7 Days", last_7)
        render_chat_section("Older", older)

        if not chats:
            st.caption("No conversations yet. Click New Chat to begin.")

        st.markdown("---")

        # Page Links
        col_nav1, col_nav2 = st.columns(2)
        with col_nav1:
            if st.button("📁 Documents", use_container_width=True):
                try:
                    st.switch_page("pages/documents.py")
                except Exception:
                    pass
        with col_nav2:
            if st.button("⚙️ Profile", use_container_width=True):
                try:
                    st.switch_page("pages/profile.py")
                except Exception:
                    pass

        # User Card at Bottom
        name = current_user.get("name") or "LocalGPT User"
        email = current_user.get("email") or ""
        avatar = current_user.get("picture") or f"https://api.dicebear.com/7.x/bottts/svg?seed={uid}"

        st.markdown(f"""
        <div class="user-sidebar-card">
          <img src="{avatar}" class="user-sidebar-avatar" alt="Avatar"/>
          <div class="user-sidebar-info">
            <div class="user-sidebar-name">{name}</div>
            <div class="user-sidebar-email">{email}</div>
          </div>
        </div>
        """, unsafe_allow_html=True)

        if st.button("🚪 Log Out", use_container_width=True):
            logout()
            try:
                st.switch_page("pages/login.py")
            except Exception:
                pass
            st.rerun()

    return st.session_state.get("active_chat_id")

