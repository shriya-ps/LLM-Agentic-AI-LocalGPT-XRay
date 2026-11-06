"""
Phase 3 — FastAPI Main Application
Provides REST + SSE streaming endpoints for:
  - User auth (register, login, Google OAuth, password reset)
  - Conversations (CRUD)
  - Messages (chat, streaming, feedback, edit, regenerate)
  - File upload & RAG search
  - User profile & settings
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import List, Optional, AsyncGenerator
import json
import secrets
from datetime import datetime, timezone, timedelta

from config import settings
from database import get_db, init_db, User, Conversation, Message, Document
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_optional_user,
    generate_reset_token, hash_reset_token,
    get_google_auth_url, exchange_google_code,
)
from schemas import (
    UserRegister, UserLogin, TokenResponse, UserProfile, UserSettingsUpdate,
    ConversationCreate, ConversationUpdate, ConversationOut,
    ChatRequest, MessageFeedback, MessageOut, MessageEdit,
    DocumentOut, PasswordResetRequest, PasswordReset,
)
from llm_client import stream_chat_completion, generate_conversation_title, list_available_models
from rag_engine import rag_store, extract_text_from_file, chunk_text, build_rag_context

# ─────────────────────────────────────────────────────
# App Initialization
# ─────────────────────────────────────────────────────
app = FastAPI(
    title="ChatGPT Platform — Phase 3 API",
    description="Multi-user AI chat platform with auth, persistent history, RAG, and hosted LLM streaming",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "https://fluffy-draw-f2y11.ship.place",
        "https://splashy-dimple-wbctd.ship.place",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:5500",
        "null",  # file:// origins
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()


# ─────────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "3.0.0",
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.LLM_MODEL,
    }


@app.get("/models")
async def get_models():
    return {"models": list_available_models()}


# ═══════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user with email/password."""
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
        is_verified=True,  # auto-verify for now (add email flow later)
        auth_provider="email",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, user=UserProfile.model_validate(user))


@app.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with email/password."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    # Update last_login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, user=UserProfile.model_validate(user))


@app.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout — client just discards token (stateless JWT)."""
    return {"message": "Logged out successfully"}


@app.post("/auth/password-reset/request")
async def request_password_reset(data: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    """Request a password reset token."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user:
        raw_token = generate_reset_token()
        user.reset_token = hash_reset_token(raw_token)
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()
        # In production: send email with raw_token
        # For demo: return in response (remove in prod!)
        return {"message": "Password reset link sent", "debug_token": raw_token}

    # Always return success (don't leak email existence)
    return {"message": "If that email exists, a reset link was sent"}


@app.post("/auth/password-reset/confirm")
async def confirm_password_reset(data: PasswordReset, db: AsyncSession = Depends(get_db)):
    """Confirm password reset with token."""
    hashed = hash_reset_token(data.token)
    result = await db.execute(
        select(User).where(
            User.reset_token == hashed,
            User.reset_token_expires > datetime.now(timezone.utc)
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()

    return {"message": "Password reset successfully"}


# ─────────────────────────────────────────────────────
# Google OAuth
# ─────────────────────────────────────────────────────

@app.get("/auth/google")
async def google_login():
    """Redirects to Google OAuth consent screen."""
    state = secrets.token_urlsafe(16)
    url = get_google_auth_url(state)
    return {"auth_url": url, "state": state}


@app.get("/auth/google/callback")
async def google_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Handles Google OAuth2 callback, creates or logs in user."""
    google_user = await exchange_google_code(code)

    google_id = google_user.get("id")
    email = google_user.get("email")
    name = google_user.get("name", email)
    picture = google_user.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Could not get email from Google")

    # Find or create user
    result = await db.execute(
        select(User).where(or_(User.google_id == google_id, User.email == email))
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            username=name,
            google_id=google_id,
            avatar_url=picture,
            is_verified=True,
            auth_provider="google",
        )
        db.add(user)
    else:
        user.google_id = google_id
        user.avatar_url = picture
        user.auth_provider = "google"
        user.last_login = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email)
    # Redirect to frontend with token
    frontend_url = f"{settings.FRONTEND_URL}?token={token}&user={user.username}"
    return RedirectResponse(url=frontend_url)


# ═══════════════════════════════════════════════════════
# USER PROFILE & SETTINGS
# ═══════════════════════════════════════════════════════

@app.get("/user/profile", response_model=UserProfile)
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserProfile.model_validate(current_user)


@app.patch("/user/profile", response_model=UserProfile)
async def update_profile(
    data: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.username is not None:
        current_user.username = data.username
    if data.system_prompt is not None:
        current_user.system_prompt = data.system_prompt
    if data.temperature is not None:
        current_user.temperature = data.temperature
    if data.max_tokens is not None:
        current_user.max_tokens = data.max_tokens
    if data.preferred_model is not None:
        current_user.preferred_model = data.preferred_model

    await db.commit()
    await db.refresh(current_user)
    return UserProfile.model_validate(current_user)


# ═══════════════════════════════════════════════════════
# CONVERSATIONS
# ═══════════════════════════════════════════════════════

@app.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Conversation).where(
        Conversation.user_id == current_user.id,
        Conversation.is_archived == False
    )
    if search:
        query = query.where(Conversation.title.ilike(f"%{search}%"))
    query = query.order_by(desc(Conversation.updated_at)).limit(limit).offset(offset)

    result = await db.execute(query)
    conversations = result.scalars().all()

    # Add message counts
    out = []
    for conv in conversations:
        count_result = await db.execute(
            select(func.count()).where(Message.conversation_id == conv.id)
        )
        count = count_result.scalar() or 0
        conv_out = ConversationOut.model_validate(conv)
        conv_out.message_count = count
        out.append(conv_out)

    return out


@app.post("/conversations", response_model=ConversationOut, status_code=201)
async def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = Conversation(
        user_id=current_user.id,
        title=data.title,
        model=data.model or current_user.preferred_model,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return ConversationOut.model_validate(conv)


@app.get("/conversations/{conv_id}/messages", response_model=List[MessageOut])
async def get_messages(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == current_user.id
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_result = await db.execute(
        select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)
    )
    return [MessageOut.model_validate(m) for m in msg_result.scalars().all()]


@app.patch("/conversations/{conv_id}", response_model=ConversationOut)
async def update_conversation(
    conv_id: str,
    data: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == current_user.id
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if data.title is not None:
        conv.title = data.title
    if data.is_archived is not None:
        conv.is_archived = data.is_archived
    if data.pinned is not None:
        conv.pinned = data.pinned

    await db.commit()
    await db.refresh(conv)
    return ConversationOut.model_validate(conv)


@app.delete("/conversations/{conv_id}", status_code=204)
async def delete_conversation(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == current_user.id
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conv)
    await db.commit()


# ═══════════════════════════════════════════════════════
# CHAT — STREAMING SSE ENDPOINT
# ═══════════════════════════════════════════════════════

@app.post("/chat/stream")
async def chat_stream(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Streams AI response as Server-Sent Events (SSE).
    Frontend listens with EventSource or fetch + ReadableStream.
    """
    # Verify conversation ownership
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == data.conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Load conversation history
    msg_result = await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at)
    )
    history = msg_result.scalars().all()

    # RAG retrieval
    rag_sources = []
    rag_context = ""
    if data.rag_enabled:
        store = rag_store.get_store(current_user.id)
        results = store.search(data.message, top_k=3)
        if results:
            rag_sources = [
                {
                    "doc_id": r["doc_id"],
                    "doc_name": r["doc_name"],
                    "text": r["text"][:300],
                    "score": round(r["score"], 3),
                    "page": r.get("page", 1),
                }
                for r in results
            ]
            rag_context = build_rag_context(results)

    # Build messages list for LLM
    system_prompt = current_user.system_prompt or (
        "You are a helpful, accurate, and concise AI assistant. "
        "Provide clear, well-structured responses with markdown formatting."
    )
    if rag_context:
        system_prompt += (
            f"\n\n[RETRIEVED KNOWLEDGE BASE CONTEXT]\n{rag_context}\n\n"
            "Answer using both your knowledge and the retrieved context. "
            "Cite sources when referencing the context (e.g., [Source 1])."
        )

    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-20:]:  # last 20 messages for context window
        llm_messages.append({"role": msg.role, "content": msg.content})
    llm_messages.append({"role": "user", "content": data.message})

    # Save user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=data.message,
    )
    db.add(user_msg)

    # Auto-title on first message
    if len(history) == 0:
        try:
            title = await generate_conversation_title(data.message)
            conv.title = title
        except Exception:
            pass

    await db.commit()

    model = data.model or conv.model or current_user.preferred_model
    temperature = data.temperature if data.temperature is not None else current_user.temperature
    max_tokens = data.max_tokens or current_user.max_tokens

    # Stream SSE
    async def generate() -> AsyncGenerator[str, None]:
        full_response = ""
        # Send RAG sources first if any
        if rag_sources:
            yield f"data: {json.dumps({'type': 'rag_sources', 'sources': rag_sources})}\n\n"

        try:
            async for chunk in stream_chat_completion(
                messages=llm_messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            ):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            full_response = f"[Error: {str(e)}]"

        # Save assistant message
        async with db as session:
            assistant_msg = Message(
                conversation_id=conv.id,
                role="assistant",
                content=full_response,
                model=model,
                rag_sources=rag_sources if rag_sources else None,
            )
            session.add(assistant_msg)
            conv.updated_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(assistant_msg)

        yield f"data: {json.dumps({'type': 'done', 'message_id': assistant_msg.id})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ═══════════════════════════════════════════════════════
# MESSAGE ACTIONS
# ═══════════════════════════════════════════════════════

@app.patch("/messages/{msg_id}/feedback")
async def message_feedback(
    msg_id: str,
    data: MessageFeedback,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Message)
        .join(Conversation)
        .where(Message.id == msg_id, Conversation.user_id == current_user.id)
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.feedback = data.feedback
    await db.commit()
    return {"feedback": msg.feedback}


@app.patch("/messages/{msg_id}/edit", response_model=MessageOut)
async def edit_message(
    msg_id: str,
    data: MessageEdit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Message)
        .join(Conversation)
        .where(Message.id == msg_id, Conversation.user_id == current_user.id)
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if not msg.is_edited:
        msg.original_content = msg.content
    msg.content = data.content
    msg.is_edited = True
    await db.commit()
    await db.refresh(msg)
    return MessageOut.model_validate(msg)


@app.delete("/messages/{msg_id}", status_code=204)
async def delete_message(
    msg_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Message)
        .join(Conversation)
        .where(Message.id == msg_id, Conversation.user_id == current_user.id)
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    await db.delete(msg)
    await db.commit()


# ═══════════════════════════════════════════════════════
# DOCUMENT UPLOAD & RAG
# ═══════════════════════════════════════════════════════

@app.post("/documents/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed_types = {"pdf", "docx", "txt", "csv", "json"}
    ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""

    if ext not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Allowed: {', '.join(allowed_types)}"
        )

    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Extract text and chunk
    try:
        full_text, page_chunks = extract_text_from_file(file_bytes, file.filename)
        chunks = chunk_text(full_text, chunk_size=400, overlap=60, page_chunks=page_chunks)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not process file: {str(e)}")

    # Save document record
    doc = Document(
        user_id=current_user.id,
        filename=file.filename,
        file_type=ext,
        file_size=file_size,
        chunks_count=len(chunks),
        is_indexed=True,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Index in RAG store
    store = rag_store.get_store(current_user.id)
    store.add_document(doc.id, file.filename, chunks)

    return DocumentOut.model_validate(doc)


@app.get("/documents", response_model=List[DocumentOut])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.user_id == current_user.id).order_by(desc(Document.created_at))
    )
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@app.delete("/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from vector store
    store = rag_store.get_store(current_user.id)
    store.remove_document(doc_id)

    await db.delete(doc)
    await db.commit()

