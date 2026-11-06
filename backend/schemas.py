"""
Phase 3 — Pydantic Schemas (request / response models)
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime


# ───────────────────────────────────────────
# Auth Schemas
# ───────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserProfile"


# ───────────────────────────────────────────
# User Schemas
# ───────────────────────────────────────────

class UserProfile(BaseModel):
    id: str
    email: str
    username: str
    avatar_url: Optional[str] = None
    is_verified: bool
    auth_provider: str
    system_prompt: Optional[str] = None
    temperature: float = 0.75
    max_tokens: int = 1024
    preferred_model: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    username: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=64, le=4096)
    preferred_model: Optional[str] = None


# ───────────────────────────────────────────
# Conversation Schemas
# ───────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: str = "New Chat"
    model: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_archived: Optional[bool] = None
    pinned: Optional[bool] = None


class ConversationOut(BaseModel):
    id: str
    title: str
    model: str
    is_archived: bool
    pinned: bool
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ───────────────────────────────────────────
# Message Schemas
# ───────────────────────────────────────────

class MessageCreate(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    rag_enabled: bool = True
    model: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=64, le=4096)


class MessageFeedback(BaseModel):
    feedback: str  # up | down


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    model: Optional[str] = None
    tokens_used: Optional[int] = None
    rag_sources: Optional[Any] = None
    reasoning_trace: Optional[Any] = None
    feedback: Optional[str] = None
    is_edited: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class MessageEdit(BaseModel):
    content: str


# ───────────────────────────────────────────
# Document Schemas
# ───────────────────────────────────────────

class DocumentOut(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    chunks_count: int
    is_indexed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ───────────────────────────────────────────
# RAG / Search
# ───────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(3, ge=1, le=10)


class SearchResult(BaseModel):
    doc_id: str
    doc_name: str
    chunk_text: str
    score: float
    page: Optional[int] = None

