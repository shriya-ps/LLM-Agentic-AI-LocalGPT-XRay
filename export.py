"""
export.py - Chat Export Engine
Exports conversations to Markdown (.md) and PDF (.pdf)
Saves outputs to data/users/<uid>/exports/
Follows Phase 3 Step 11 Specification
"""

import os
import io
from datetime import datetime
from typing import List, Dict, Any

def get_user_exports_dir(uid: str) -> str:
    export_dir = os.path.join("data", "users", uid, "exports")
    os.makedirs(export_dir, exist_ok=True)
    return export_dir

def export_to_markdown(chat_title: str, messages: List[Dict[str, Any]], user_name: str = "User") -> str:
    """Formats chat history into clean GitHub Flavored Markdown"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        f"# 🤖 LocalGPT Pro - Conversation Export",
        f"**Topic**: {chat_title}  ",
        f"**User**: {user_name}  ",
        f"**Exported At**: {timestamp}  ",
        f"---\n"
    ]

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        sources = msg.get("sources", [])

        if role == "user":
            lines.append(f"### 👤 {user_name}\n\n{content}\n")
        else:
            lines.append(f"### ◆ LocalGPT Assistant\n\n{content}\n")
            if sources:
                lines.append("**📚 Verified Citations:**")
                for s in sources:
                    doc = s.get("doc_name", "Document")
                    page = s.get("page", 1)
                    lines.append(f"- *{doc}* (Page {page}): > {s.get('text', '')}")
                lines.append("")
        lines.append("---\n")

    return "\n".join(lines)

def export_to_pdf(chat_title: str, messages: List[Dict[str, Any]], user_name: str = "User") -> bytes:
    """Exports chat conversation to formatted PDF using ReportLab"""
    buffer = io.BytesIO()
    
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=45,
            leftMargin=45,
            topMargin=45,
            bottomMargin=45
        )

        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'ExportTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=6
        )
        meta_style = ParagraphStyle(
            'ExportMeta',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=14
        )
        user_header = ParagraphStyle(
            'UserHeader',
            parent=styles['Heading3'],
            fontSize=12,
            textColor=colors.HexColor("#2563eb"),
            spaceBefore=10,
            spaceAfter=4
        )
        assistant_header = ParagraphStyle(
            'AssistantHeader',
            parent=styles['Heading3'],
            fontSize=12,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=10,
            spaceAfter=4
        )
        body_style = ParagraphStyle(
            'ChatBody',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor("#334155"),
            leading=14,
            spaceAfter=8
        )
        citation_style = ParagraphStyle(
            'Citation',
            parent=styles['Normal'],
            fontSize=8.5,
            textColor=colors.HexColor("#0284c7"),
            leading=11,
            leftIndent=15,
            spaceAfter=4
        )

        elements = []
        # Header
        elements.append(Paragraph(f"LocalGPT Pro — {chat_title}", title_style))
        elements.append(Paragraph(f"Exported for <b>{user_name}</b> on {datetime.now().strftime('%b %d, %Y at %I:%M %p')}", meta_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=14))

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "").replace("\n", "<br/>")
            sources = msg.get("sources", [])

            if role == "user":
                elements.append(Paragraph(f"👤 {user_name}", user_header))
                elements.append(Paragraph(content, body_style))
            else:
                elements.append(Paragraph("◆ LocalGPT Assistant", assistant_header))
                elements.append(Paragraph(content, body_style))
                if sources:
                    elements.append(Spacer(1, 4))
                    for s in sources:
                        doc_name = s.get("doc_name", "Document")
                        page = s.get("page", 1)
                        snippet = s.get("text", "")[:120].replace("\n", " ")
                        elements.append(Paragraph(f"• <i>{doc_name} (p.{page})</i>: {snippet}...", citation_style))

            elements.append(Spacer(1, 6))
            elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=10))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    except Exception as e:
        # Fallback PDF generator if reportlab is not available
        md_text = export_to_markdown(chat_title, messages, user_name)
        return md_text.encode("utf-8")

def save_export_to_disk(uid: str, chat_title: str, file_ext: str, data: Any) -> str:
    """Saves exported file into data/users/<uid>/exports/"""
    export_dir = get_user_exports_dir(uid)
    sanitized_title = "".join(c for c in chat_title if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{sanitized_title}_{timestamp}.{file_ext}"
    full_path = os.path.join(export_dir, filename)

    if isinstance(data, str):
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(data)
    else:
        with open(full_path, "wb") as f:
            f.write(data)

    return full_path

