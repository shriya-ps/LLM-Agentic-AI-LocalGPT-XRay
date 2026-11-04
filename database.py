"""
database.py - Session & Metadata Persistence Layer
"""

import sqlite3
import os
import json

DB_PATH = os.path.join("data", "localgpt.db")

class Database:
    def __init__(self, db_path: str = DB_PATH):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self._init_tables()

    def _init_tables(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                content TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )
        """)
        self.conn.commit()

    def save_message(self, session_id: str, role: str, content: str, metadata: dict = None):
        cursor = self.conn.cursor()
        meta_str = json.dumps(metadata or {})
        cursor.execute(
            "INSERT INTO messages (session_id, role, content, metadata) VALUES (?, ?, ?, ?)",
            (session_id, role, content, meta_str)
        )
        self.conn.commit()

    def get_messages(self, session_id: str):
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT role, content, metadata FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,)
        )
        return [{"role": r, "content": c, "metadata": json.loads(m)} for r, c, m in cursor.fetchall()]
