/**
 * Main Application Controller for LocalGPT & LLM X-Ray
 * Seamlessly integrates:
 * - Phase 1: LLM X-Ray (9-stage interactive transformer pipeline)
 * - Phase 1: Token Stream (BPE tokenizer & compression metrics)
 * - Phase 2: LocalGPT (ChatGPT-style multi-turn conversational AI with streaming, memory, RAG, and document QA)
 * - Phase 1 & 2: Project Specifications Document Sheet (Photos 1 to 5)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  const state = {
    currentPhase: "chat", // "chat" (LocalGPT), "xray", "tokens", "doc"
    currentTab: "tab-prompt",
    activePrompt: "Explain Machine Learning",
    attentionLayer: 12,
    attentionHead: 4,
    selectedHiddenLayer: 28,
    inferenceData: null,
    isStreaming: false,
    streamingIntervalId: null,
    editingMessageId: null,
    activeSpecPhase: 2 // 1 = LLM X-Ray, 2 = LocalGPT
  };

  // DOM Elements - Master Header
  const btnViewChat = document.getElementById("btn-view-chat");
  const btnViewXray = document.getElementById("btn-view-xray");
  const btnViewTokens = document.getElementById("btn-view-tokens");
  const btnViewDoc = document.getElementById("btn-view-doc");

  const viewChat = document.getElementById("view-chat");
  const viewXray = document.getElementById("view-xray");
  const viewDoc = document.getElementById("view-doc");

  // Document Specs Elements
  const btnSpecPhase1 = document.getElementById("btn-spec-phase-1");
  const btnSpecPhase2 = document.getElementById("btn-spec-phase-2");
  const specP1Container = document.getElementById("spec-phase-1-container");
  const specP2Container = document.getElementById("spec-phase-2-container");
  const docActiveTitle = document.getElementById("doc-active-spec-title");
  const btnDocLaunchChat = document.getElementById("btn-doc-launch-chat");
  const btnDocP2Launch = document.getElementById("btn-doc-p2-launch");

  // Chat Elements
  const chatMessagesList = document.getElementById("chat-messages-list");
  const chatInput = document.getElementById("chat-input");
  const btnSendChat = document.getElementById("btn-send-chat");
  const stopGeneratingWrap = document.getElementById("stop-generating-wrap");
  const btnStopGenerating = document.getElementById("btn-stop-generating");
  const ragTogglePill = document.getElementById("rag-toggle-pill");
  const ragStatusText = document.getElementById("rag-status-text");
  const docsBadge = document.getElementById("docs-badge");
  const docsCount = document.getElementById("docs-count");
  const chatCurrentTitle = document.getElementById("chat-current-title");
  const btnBackToChat = document.getElementById("btn-back-to-chat");
  const btnChatXrayJump = document.getElementById("btn-chat-xray-jump");

  // Chat Modals & Dropdowns
  const docModal = document.getElementById("doc-modal");
  const btnCloseDocModal = document.getElementById("btn-close-doc-modal");
  const btnAttach = document.getElementById("btn-attach");
  const fileUploadInput = document.getElementById("file-upload-input");
  const dropZone = document.getElementById("drop-zone");
  const docItemsPreview = document.getElementById("doc-items-preview");

  const settingsModal = document.getElementById("settings-modal");
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const btnSidebarSettings = document.getElementById("btn-sidebar-settings");
  const btnChatSettingsTrigger = document.getElementById("btn-chat-settings-trigger");
  const btnCloseSettingsModal = document.getElementById("btn-close-settings-modal");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const selectSysPromptPreset = document.getElementById("select-sys-prompt-preset");
  const customSysPromptWrap = document.getElementById("custom-sys-prompt-wrap");
  const textareaCustomSysPrompt = document.getElementById("textarea-custom-sys-prompt");
  const settingsSliderTemp = document.getElementById("settings-slider-temp");
  const settingsValTemp = document.getElementById("settings-val-temp");
  const selectMemoryTurns = document.getElementById("select-memory-turns");

  // X-Ray Sliders & Inputs (Phase 1)
  const sliderTemp = document.getElementById("slider-temperature");
  const valTemp = document.getElementById("val-temperature");
  const sliderTopK = document.getElementById("slider-topk");
  const valTopK = document.getElementById("val-topk");
  const sliderTopP = document.getElementById("slider-topp");
  const valTopP = document.getElementById("val-topp");
  const sliderMaxTokens = document.getElementById("slider-maxtokens");
  const valMaxTokens = document.getElementById("val-maxtokens");
  const selectModel = document.getElementById("select-model");
  const selectDtype = document.getElementById("select-dtype");
  const inputPrompt = document.getElementById("input-prompt");
  const selectPreset = document.getElementById("select-preset");
  const btnRunXray = document.getElementById("btn-run-xray");
  const xrayStatus = document.getElementById("xray-status");

  // Token Stream additions
  const inputAddToken = document.getElementById("input-add-token");
  const btnAddToken = document.getElementById("btn-add-token");
  const btnClearTokens = document.getElementById("btn-clear-tokens");

  // ==========================================
  // 1. Master Navigation & View Switching
  // ==========================================
  function switchPhase(phaseKey) {
    state.currentPhase = phaseKey;

    [btnViewChat, btnViewXray, btnViewTokens, btnViewDoc].forEach(b => b?.classList.remove("active"));
    [viewChat, viewXray, viewDoc].forEach(v => v?.classList.remove("active-view"));

    if (phaseKey === "chat") {
      btnViewChat?.classList.add("active");
      viewChat?.classList.add("active-view");
      renderChatMessages();
    } else if (phaseKey === "xray") {
      btnViewXray?.classList.add("active");
      viewXray?.classList.add("active-view");
      activatePipelineTab("tab-prompt");
    } else if (phaseKey === "tokens") {
      btnViewTokens?.classList.add("active");
      viewXray?.classList.add("active-view");
      activatePipelineTab("tab-tokenizer");
    } else if (phaseKey === "doc") {
      btnViewDoc?.classList.add("active");
      viewDoc?.classList.add("active-view");
    }
  }

  btnViewChat?.addEventListener("click", () => switchPhase("chat"));
  btnViewXray?.addEventListener("click", () => switchPhase("xray"));
  btnViewTokens?.addEventListener("click", () => switchPhase("tokens"));
  btnViewDoc?.addEventListener("click", () => switchPhase("doc"));

  btnBackToChat?.addEventListener("click", () => switchPhase("chat"));
  btnChatXrayJump?.addEventListener("click", () => {
    switchPhase("xray");
    const convo = window.conversationMemory.getActiveConversation();
    const lastUserPrompt = convo.filter(m => m.role === "user").slice(-1)[0]?.content || "Explain Machine Learning";
    executeXray(lastUserPrompt);
  });

  // ==========================================
  // 2. Specifications View (Phase 1 & Phase 2)
  // ==========================================
  let currentDocPage = 1;

  function setSpecPhase(phaseNum) {
    state.activeSpecPhase = phaseNum;
    if (phaseNum === 2) {
      btnSpecPhase2?.classList.add("active");
      btnSpecPhase1?.classList.remove("active");
      if (specP2Container) specP2Container.style.display = "block";
      if (specP1Container) specP1Container.style.display = "none";
      if (docActiveTitle) docActiveTitle.textContent = "Project Specification Sheet (Phase 2 — LocalGPT)";
    } else {
      btnSpecPhase1?.classList.add("active");
      btnSpecPhase2?.classList.remove("active");
      if (specP1Container) specP1Container.style.display = "block";
      if (specP2Container) specP2Container.style.display = "none";
      if (docActiveTitle) docActiveTitle.textContent = "Project Specification Sheet (Phase 1 — LLM X-Ray)";
    }
    window.switchDocPage(1);
  }

  btnSpecPhase1?.addEventListener("click", () => setSpecPhase(1));
  btnSpecPhase2?.addEventListener("click", () => setSpecPhase(2));

  window.switchDocPage = function(pageNum) {
    if (pageNum < 1) pageNum = 1;
    if (pageNum > 5) pageNum = 5;
    currentDocPage = pageNum;

    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`btn-doc-page-${i}`);
      if (btn) {
        if (i === pageNum) btn.classList.add("active");
        else btn.classList.remove("active");
      }

      if (state.activeSpecPhase === 2) {
        const sheet = document.getElementById(`doc-p2-sheet-${i}`);
        if (sheet) sheet.style.display = (i === pageNum) ? "block" : "none";
      } else {
        const sheet = document.getElementById(`doc-sheet-${i}`);
        if (sheet) sheet.style.display = (i === pageNum) ? "block" : "none";
      }
    }

    const docContainer = document.querySelector(".doc-view-container");
    if (docContainer) docContainer.scrollTop = 0;
  };

  document.getElementById("btn-doc-prev")?.addEventListener("click", () => window.switchDocPage(currentDocPage - 1));
  document.getElementById("btn-doc-next")?.addEventListener("click", () => window.switchDocPage(currentDocPage + 1));
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`btn-doc-page-${i}`)?.addEventListener("click", () => window.switchDocPage(i));
  }

  btnDocLaunchChat?.addEventListener("click", () => switchPhase("chat"));
  btnDocP2Launch?.addEventListener("click", () => switchPhase("chat"));

  // ==========================================
  // 3. Phase 2: LocalGPT Multi-Turn Engine
  // ==========================================

  function renderSidebarHistory() {
    const historyScroll = document.getElementById("chat-history-scroll");
    if (!historyScroll) return;

    const conversations = window.conversationMemory.conversations;
    const activeKey = window.conversationMemory.activeChatKey;
    const keys = Object.keys(conversations);

    // Group keys: first 4 in TODAY, rest in YESTERDAY
    const todayKeys = keys.slice(0, 4);
    const yesterdayKeys = keys.slice(4);

    historyScroll.innerHTML = `
      <div class="history-group">
        <div class="history-group-title">TODAY</div>
        ${todayKeys.map(k => renderHistoryItemHtml(k, k === activeKey)).join("")}
      </div>
      ${yesterdayKeys.length > 0 ? `
        <div class="history-group">
          <div class="history-group-title">YESTERDAY</div>
          ${yesterdayKeys.map(k => renderHistoryItemHtml(k, k === activeKey)).join("")}
        </div>
      ` : ""}
    `;

    // Attach listeners
    historyScroll.querySelectorAll(".history-item").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".history-action-btn")) return; // handled separately
        const key = item.dataset.chatKey;
        if (key) {
          window.conversationMemory.activeChatKey = key;
          if (chatCurrentTitle) chatCurrentTitle.textContent = key;
          renderSidebarHistory();
          renderChatMessages();
        }
      });
    });

    historyScroll.querySelectorAll(".btn-rename-chat").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const oldTitle = btn.dataset.chatKey;
        const newTitle = prompt("Rename chat:", oldTitle);
        if (newTitle && newTitle.trim()) {
          window.conversationMemory.renameConversation(oldTitle, newTitle.trim());
          if (chatCurrentTitle && window.conversationMemory.activeChatKey === newTitle.trim()) {
            chatCurrentTitle.textContent = newTitle.trim();
          }
          renderSidebarHistory();
        }
      });
    });

    historyScroll.querySelectorAll(".btn-delete-chat").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const title = btn.dataset.chatKey;
        if (confirm(`Delete "${title}"?`)) {
          window.conversationMemory.deleteConversation(title);
          if (chatCurrentTitle) chatCurrentTitle.textContent = window.conversationMemory.activeChatKey;
          renderSidebarHistory();
          renderChatMessages();
        }
      });
    });
  }

  function renderHistoryItemHtml(title, isActive) {
    return `
      <div class="history-item ${isActive ? 'active' : ''}" data-chat-key="${escapeHtml(title)}">
        <div class="history-item-left">
          <span class="history-icon">💬</span>
          <span class="history-text">${escapeHtml(title)}</span>
        </div>
        <div class="history-item-actions">
          <button class="history-action-btn btn-rename-chat" data-chat-key="${escapeHtml(title)}" title="Rename chat">✏️</button>
          <button class="history-action-btn btn-delete-chat" data-chat-key="${escapeHtml(title)}" title="Delete chat">🗑️</button>
        </div>
      </div>
    `;
  }

  // Render Messages in Active Chat
  function renderChatMessages() {
    if (!chatMessagesList) return;
    const conversation = window.conversationMemory.getActiveConversation();
    chatMessagesList.innerHTML = "";

    conversation.forEach((msg, idx) => {
      const msgWrapper = document.createElement("div");

      if (msg.role === "user") {
        msgWrapper.className = "chat-message user-message";
        const isEditing = state.editingMessageId === msg.id;

        if (isEditing) {
          msgWrapper.innerHTML = `
            <div class="message-avatar user-avatar">S</div>
            <div class="message-content">
              <div class="user-edit-container">
                <textarea id="edit-textarea-${msg.id}" class="user-edit-textarea">${escapeHtml(msg.content)}</textarea>
                <div class="user-edit-actions">
                  <button class="btn-edit-cancel" data-id="${msg.id}">Cancel</button>
                  <button class="btn-edit-save" data-id="${msg.id}" data-idx="${idx}">Save &amp; Submit</button>
                </div>
              </div>
            </div>
          `;
        } else {
          msgWrapper.innerHTML = `
            <div class="message-avatar user-avatar">S</div>
            <div class="message-content">
              <div class="message-header">
                <div class="message-header-left">
                  <span>You</span>
                  <span class="assistant-time">${msg.timestamp || ""}</span>
                </div>
                <button class="history-action-btn btn-edit-msg" data-id="${msg.id}" title="Edit this message">✏️ Edit</button>
              </div>
              <div class="message-body">
                <p>${escapeHtml(msg.content)}</p>
              </div>
            </div>
          `;
        }

        // Attach edit listeners
        msgWrapper.querySelector(".btn-edit-msg")?.addEventListener("click", () => {
          state.editingMessageId = msg.id;
          renderChatMessages();
        });

        msgWrapper.querySelector(".btn-edit-cancel")?.addEventListener("click", () => {
          state.editingMessageId = null;
          renderChatMessages();
        });

        msgWrapper.querySelector(".btn-edit-save")?.addEventListener("click", () => {
          const textarea = document.getElementById(`edit-textarea-${msg.id}`);
          if (textarea && textarea.value.trim()) {
            const newText = textarea.value.trim();
            window.conversationMemory.updateMessage(msg.id, newText);
            window.conversationMemory.truncateAfter(idx);
            state.editingMessageId = null;
            renderChatMessages();
            // Automatically regenerate assistant response from this edited prompt
            generateAssistantResponse(newText);
          }
        });

      } else {
        // Assistant Message
        msgWrapper.className = "chat-message assistant-message";

        let reasoningHtml = "";
        if (msg.reasoningTrace && msg.reasoningTrace.length > 0) {
          reasoningHtml = `
            <div class="agentic-reasoning-card">
              <div class="agentic-reasoning-header">
                <span>🧠 Agentic ReAct Chain (${msg.reasoningTrace.length} steps)</span>
                <span>▼</span>
              </div>
              <div class="agentic-steps" style="display:none;">
                ${msg.reasoningTrace.map(st => `
                  <div class="agentic-step-item">
                    <span class="step-badge">${escapeHtml(st.step)}:</span>
                    <span>${escapeHtml(st.detail)}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        }

        let ragSourcesHtml = "";
        if (msg.retrievedChunks && msg.retrievedChunks.length > 0) {
          ragSourcesHtml = `
            <div class="rag-sources-card">
              <div class="rag-sources-header">
                <span>📚 Retrieved Context (${msg.retrievedChunks.length} documents)</span>
                <span>▼</span>
              </div>
              <div class="rag-sources-list" style="display:none;">
                ${msg.retrievedChunks.map(c => `
                  <div class="rag-source-item">
                    <strong>${escapeHtml(c.docName)}</strong> (${(c.score * 100).toFixed(1)}% match):
                    <div>"${escapeHtml(c.text.slice(0, 150))}..."</div>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        }

        msgWrapper.innerHTML = `
          <div class="message-avatar assistant-avatar">✦</div>
          <div class="message-content">
            <div class="message-header">
              <div class="message-header-left">
                <span>LocalGPT</span>
                <span class="model-tag">${msg.model || "qwen-2.5-1.5b-local"}</span>
                <span class="assistant-time">${msg.timestamp || ""}</span>
              </div>
            </div>
            ${ragSourcesHtml}
            ${reasoningHtml}
            <div class="message-body" id="body-${msg.id}">
              ${formatMarkdown(msg.content)}
            </div>
            <div class="message-actions">
              <button class="action-btn-pill btn-copy-msg" data-id="${msg.id}" title="Copy response">
                <span>📋</span>
                <span>Copy</span>
              </button>
              <button class="action-btn-pill btn-regenerate-msg" data-idx="${idx}" title="Regenerate this response">
                <span>🔄</span>
                <span>Regenerate</span>
              </button>
              <button class="action-btn-pill highlight-xray btn-xray-msg" data-prompt="${escapeHtml(msg.promptUsed || '')}" title="Dissect with 28-layer LLM X-Ray">
                <span>🔬</span>
                <span>LLM X-Ray</span>
              </button>
            </div>
          </div>
        `;

        // Toggle reasoning details
        msgWrapper.querySelector(".agentic-reasoning-header")?.addEventListener("click", (e) => {
          const steps = e.currentTarget.nextElementSibling;
          if (steps) steps.style.display = steps.style.display === "none" ? "flex" : "none";
        });

        // Toggle RAG sources
        msgWrapper.querySelector(".rag-sources-header")?.addEventListener("click", (e) => {
          const list = e.currentTarget.nextElementSibling;
          if (list) list.style.display = list.style.display === "none" ? "flex" : "none";
        });

        // Copy button
        msgWrapper.querySelector(".btn-copy-msg")?.addEventListener("click", (e) => {
          navigator.clipboard.writeText(msg.content);
          const btn = e.currentTarget;
          const orig = btn.innerHTML;
          btn.innerHTML = `<span>✓</span><span>Copied</span>`;
          setTimeout(() => { btn.innerHTML = orig; }, 2000);
        });

        // Regenerate button
        msgWrapper.querySelector(".btn-regenerate-msg")?.addEventListener("click", () => {
          const convo = window.conversationMemory.getActiveConversation();
          const targetPrompt = msg.promptUsed || convo.filter(m => m.role === "user").slice(-1)[0]?.content;
          if (targetPrompt) {
            // Remove this assistant message
            window.conversationMemory.truncateAfter(idx - 1);
            renderChatMessages();
            generateAssistantResponse(targetPrompt);
          }
        });

        // Prominent LLM X-Ray Link
        msgWrapper.querySelector(".btn-xray-msg")?.addEventListener("click", (e) => {
          const prompt = e.currentTarget.dataset.prompt || msg.promptUsed || "Explain Machine Learning";
          switchPhase("xray");
          executeXray(prompt);
        });
      }

      chatMessagesList.appendChild(msgWrapper);
    });

    attachCodeBlockCopyButtons();
    chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  }

  // Copy code blocks
  function attachCodeBlockCopyButtons() {
    document.querySelectorAll(".code-block-copy-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const pre = btn.closest(".code-block-container")?.querySelector(".code-block-pre");
        if (pre) {
          navigator.clipboard.writeText(pre.textContent);
          btn.textContent = "✓ Copied";
          setTimeout(() => { btn.textContent = "Copy"; }, 2000);
        }
      });
    });
  }

  // Assistant Streaming Generator (Photo 2 & Photo 5)
  async function generateAssistantResponse(userPrompt) {
    if (state.isStreaming) return;
    state.isStreaming = true;

    if (stopGeneratingWrap) stopGeneratingWrap.style.display = "block";
    if (btnSendChat) btnSendChat.disabled = true;

    // Build multi-turn context
    const convoHistory = window.conversationMemory.getActiveConversation();
    const agentResult = await window.ragAgent.processAgenticQuery(userPrompt, convoHistory);

    // Create placeholder assistant message
    const assistantMsg = window.conversationMemory.addMessage("assistant", "", {
      model: "qwen-2.5-1.5b-local",
      promptUsed: userPrompt,
      reasoningTrace: agentResult.reasoningTrace,
      retrievedChunks: agentResult.retrievedChunks
    });

    renderChatMessages();

    // Stream text token-by-token
    const fullText = agentResult.text;
    const bodyEl = document.getElementById(`body-${assistantMsg.id}`);
    const words = fullText.split(" ");
    let currentWordIdx = 0;
    let accumulatedText = "";

    state.streamingIntervalId = setInterval(() => {
      if (currentWordIdx < words.length) {
        accumulatedText += (currentWordIdx === 0 ? "" : " ") + words[currentWordIdx];
        if (bodyEl) {
          bodyEl.innerHTML = formatMarkdown(accumulatedText) + `<span class="streaming-cursor">▌</span>`;
          chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
        }
        currentWordIdx++;
      } else {
        finishStreaming(assistantMsg.id, fullText);
      }
    }, 28); // realistic token streaming speed (~35 tokens/sec)
  }

  function finishStreaming(msgId, finalText) {
    clearInterval(state.streamingIntervalId);
    state.isStreaming = false;
    state.streamingIntervalId = null;

    if (stopGeneratingWrap) stopGeneratingWrap.style.display = "none";
    if (btnSendChat) btnSendChat.disabled = false;

    window.conversationMemory.updateMessage(msgId, finalText);
    renderChatMessages();
  }

  // Stop Generating button
  btnStopGenerating?.addEventListener("click", () => {
    if (state.isStreaming) {
      clearInterval(state.streamingIntervalId);
      state.isStreaming = false;
      state.streamingIntervalId = null;
      if (stopGeneratingWrap) stopGeneratingWrap.style.display = "none";
      if (btnSendChat) btnSendChat.disabled = false;
      renderChatMessages();
    }
  });

  // Handle user send
  function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text || state.isStreaming) return;

    window.conversationMemory.addMessage("user", text);
    chatInput.value = "";
    chatInput.style.height = "24px";
    renderChatMessages();

    generateAssistantResponse(text);
  }

  btnSendChat?.addEventListener("click", handleSendMessage);
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Auto-resize chat textarea
  chatInput?.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  });

  // New Chat Button (Ctrl+N)
  document.getElementById("btn-new-chat")?.addEventListener("click", () => {
    const title = window.conversationMemory.createConversation();
    if (chatCurrentTitle) chatCurrentTitle.textContent = title;
    renderSidebarHistory();
    renderChatMessages();
  });

  // Search Chats Button (Ctrl+K)
  document.getElementById("btn-search-chats")?.addEventListener("click", () => {
    const q = prompt("Search chat titles or messages:", "");
    if (q) {
      const keys = Object.keys(window.conversationMemory.conversations);
      const match = keys.find(k => k.toLowerCase().includes(q.toLowerCase()));
      if (match) {
        window.conversationMemory.activeChatKey = match;
        if (chatCurrentTitle) chatCurrentTitle.textContent = match;
        renderSidebarHistory();
        renderChatMessages();
      } else {
        alert("No conversations found matching '" + q + "'");
      }
    }
  });

  // Keyboard Shortcuts (Ctrl+N, Ctrl+K)
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      document.getElementById("btn-new-chat")?.click();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("btn-search-chats")?.click();
    }
  });

  // RAG Toggle Pill
  if (ragTogglePill) {
    ragTogglePill.addEventListener("click", () => {
      const isNowOn = !window.ragAgent.isRagEnabled;
      window.ragAgent.setRagEnabled(isNowOn);

      if (isNowOn) {
        ragTogglePill.classList.remove("rag-off");
        ragStatusText.textContent = "RAG ON";
      } else {
        ragTogglePill.classList.add("rag-off");
        ragStatusText.textContent = "RAG OFF";
      }
    });
  }

  // Documents Modal
  function updateDocsBadge() {
    const count = window.ragAgent.documents.length;
    if (docsCount) docsCount.textContent = count;
  }
  updateDocsBadge();

  docsBadge?.addEventListener("click", () => {
    renderDocItems();
    docModal?.classList.add("active-modal");
  });

  btnAttach?.addEventListener("click", () => {
    renderDocItems();
    docModal?.classList.add("active-modal");
  });

  btnCloseDocModal?.addEventListener("click", () => {
    docModal?.classList.remove("active-modal");
  });

  docModal?.addEventListener("click", (e) => {
    if (e.target === docModal) docModal.classList.remove("active-modal");
  });

  function renderDocItems() {
    if (!docItemsPreview) return;
    docItemsPreview.innerHTML = "";
    window.ragAgent.documents.forEach(doc => {
      const row = document.createElement("div");
      row.className = "doc-item-row";
      row.innerHTML = `
        <div>
          <strong>📄 ${escapeHtml(doc.name)}</strong>
          <span style="font-size:11px; color:#9ca3af; margin-left:8px;">(${doc.chunksCount} chunks, ${(doc.size / 1024).toFixed(1)} KB)</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:#10b981; font-size:11px; font-weight:700;">Vector Indexed</span>
          <button class="doc-item-delete" data-id="${doc.id}" title="Delete document">✕</button>
        </div>
      `;

      row.querySelector(".doc-item-delete")?.addEventListener("click", () => {
        window.ragAgent.deleteDocument(doc.id);
        updateDocsBadge();
        renderDocItems();
      });

      docItemsPreview.appendChild(row);
    });
  }

  // File Upload Handlers (PDF, DOCX, TXT, CSV, JSON, MD)
  dropZone?.addEventListener("click", () => fileUploadInput?.click());
  fileUploadInput?.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files && files.length > 0) processUploadedFiles(files);
  });

  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files) processUploadedFiles(e.dataTransfer.files);
  });

  function processUploadedFiles(files) {
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        window.ragAgent.ingestDocument(file.name, event.target.result);
        updateDocsBadge();
        renderDocItems();
      };
      reader.readAsText(file);
    }
  }

  // Settings Modal Handlers
  function openSettings() {
    if (selectSysPromptPreset) selectSysPromptPreset.value = window.conversationMemory.currentSystemPromptKey;
    if (customSysPromptWrap) {
      customSysPromptWrap.style.display = window.conversationMemory.currentSystemPromptKey === "custom" ? "flex" : "none";
    }
    if (textareaCustomSysPrompt) textareaCustomSysPrompt.value = window.conversationMemory.customSystemPrompt;
    if (settingsValTemp) settingsValTemp.textContent = window.transformerEngine.hyperparams.temperature;
    if (settingsSliderTemp) settingsSliderTemp.value = window.transformerEngine.hyperparams.temperature;
    settingsModal?.classList.add("active-modal");
  }

  btnOpenSettings?.addEventListener("click", openSettings);
  btnSidebarSettings?.addEventListener("click", openSettings);
  btnChatSettingsTrigger?.addEventListener("click", openSettings);
  btnCloseSettingsModal?.addEventListener("click", () => settingsModal?.classList.remove("active-modal"));
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove("active-modal");
  });

  selectSysPromptPreset?.addEventListener("change", (e) => {
    if (customSysPromptWrap) {
      customSysPromptWrap.style.display = e.target.value === "custom" ? "flex" : "none";
    }
  });

  settingsSliderTemp?.addEventListener("input", (e) => {
    if (settingsValTemp) settingsValTemp.textContent = Number(e.target.value).toFixed(2);
  });

  btnSaveSettings?.addEventListener("click", () => {
    const preset = selectSysPromptPreset.value;
    const custom = textareaCustomSysPrompt.value.trim();
    window.conversationMemory.setSystemPrompt(preset, custom);

    const temp = parseFloat(settingsSliderTemp.value);
    window.transformerEngine.hyperparams.temperature = temp;
    if (sliderTemp) sliderTemp.value = temp;
    if (valTemp) valTemp.textContent = temp.toFixed(2);

    const turns = parseInt(selectMemoryTurns.value);
    window.conversationMemory.maxContextTurns = turns;

    settingsModal?.classList.remove("active-modal");
    alert("Settings saved successfully!");
  });

  // ==========================================
  // 4. Phase 1: LLM X-Ray Engine (Preserved)
  // ==========================================
  const pipelineTabs = document.querySelectorAll(".pipeline-tab");
  const pipelinePanels = document.querySelectorAll(".pipeline-content-panel");

  function activatePipelineTab(tabId) {
    state.currentTab = tabId;
    pipelineTabs.forEach(tab => {
      if (tab.dataset.target === tabId) tab.classList.add("active-tab");
      else tab.classList.remove("active-tab");
    });
    pipelinePanels.forEach(panel => {
      if (panel.id === tabId) panel.classList.add("active-panel");
      else panel.classList.remove("active-panel");
    });
  }

  pipelineTabs.forEach(tab => {
    tab.addEventListener("click", () => activatePipelineTab(tab.dataset.target));
  });

  function setupSlider(slider, label, isFloat = false) {
    if (!slider || !label) return;
    slider.addEventListener("input", (e) => {
      label.textContent = isFloat ? Number(e.target.value).toFixed(2) : e.target.value;
      if (window.transformerEngine) {
        window.transformerEngine.hyperparams[slider.dataset.param] = Number(e.target.value);
      }
    });
  }

  setupSlider(sliderTemp, valTemp, true);
  setupSlider(sliderTopK, valTopK, false);
  setupSlider(sliderTopP, valTopP, true);
  setupSlider(sliderMaxTokens, valMaxTokens, false);

  selectPreset?.addEventListener("change", (e) => {
    if (e.target.value && inputPrompt) {
      inputPrompt.value = e.target.value;
      executeXray(e.target.value);
    }
  });

  selectModel?.addEventListener("change", (e) => {
    if (window.transformerEngine) {
      window.transformerEngine.setModel(e.target.value);
      const archSummary = document.getElementById("sidebar-arch-summary");
      if (archSummary) {
        const cfg = window.transformerEngine.getModelConfig();
        archSummary.textContent = `${cfg.layers} Layers • ${cfg.heads} Heads • ${cfg.hiddenDim} Dim • ${cfg.posEmb} • ${cfg.norm}`;
      }
      executeXray(inputPrompt.value);
    }
  });

  btnRunXray?.addEventListener("click", () => {
    const prompt = inputPrompt.value.trim() || "Explain Machine Learning";
    executeXray(prompt);
  });

  function executeXray(prompt) {
    state.activePrompt = prompt;
    if (inputPrompt) inputPrompt.value = prompt;

    const displayPromptText = document.getElementById("display-prompt-text");
    if (displayPromptText) displayPromptText.textContent = prompt;

    const displaySysPrompt = document.getElementById("display-system-prompt");
    if (displaySysPrompt) displaySysPrompt.textContent = window.conversationMemory.getSystemPrompt();

    if (xrayStatus) {
      xrayStatus.innerHTML = `
        <div class="status-spinner"></div>
        <div>Loading <strong>Qwen/Qwen2.5-1.5B-Instruct</strong> and dissecting activations for <em>"${escapeHtml(prompt)}"</em>...</div>
      `;
    }

    setTimeout(() => {
      state.inferenceData = window.transformerEngine.runInference(prompt, {
        temperature: sliderTemp ? parseFloat(sliderTemp.value) : 0.75,
        topK: sliderTopK ? parseInt(sliderTopK.value) : 50,
        topP: sliderTopP ? parseFloat(sliderTopP.value) : 0.90,
        maxNewTokens: sliderMaxTokens ? parseInt(sliderMaxTokens.value) : 30
      });

      renderXrayVisualizations();

      if (xrayStatus) {
        xrayStatus.innerHTML = `
          <span style="color:#10b981; font-weight:700;">✓</span>
          <div>X-Ray Complete for <strong>Qwen 2.5-1.5B</strong>! (${state.inferenceData.records.length} tokens parsed, 28 layers traversed, KV-Cache: ${state.inferenceData.generation.kvCacheSizeKB})</div>
        `;
      }
    }, 250);
  }

  function renderXrayVisualizations() {
    if (!state.inferenceData) return;
    const { records, metrics, attentionMatrix, layerProfiles, logits, generation } = state.inferenceData;

    renderTokenPills(records);
    renderTokenTable(records);
    renderCompressionMetrics(metrics);
    renderTokenIdsMatrix(records);
    renderEmbeddings(records);
    renderLayersArchitecture(layerProfiles);
    renderAttentionHeatmap(records, attentionMatrix);
    renderHiddenStates(records);
    renderLogits(logits);
    renderGeneration(generation);
  }

  function renderTokenPills(records) {
    const flowContainer = document.getElementById("token-pills-flow");
    if (!flowContainer) return;
    flowContainer.innerHTML = "";
    records.forEach((rec) => {
      const pill = document.createElement("div");
      pill.className = `token-pill ${rec.isSpecial ? "pill-special" : "pill-regular"}`;
      pill.title = `Index: ${rec.index}\nToken: "${rec.rawText}"\nID: ${rec.tokenId}\nBytes: ${rec.utf8Bytes}`;
      pill.innerHTML = `
        <span class="pill-index">[${rec.index}]</span>
        <span class="pill-text">${escapeHtml(rec.displayStr)}</span>
        <span class="pill-id">(${rec.tokenId})</span>
      `;
      pill.addEventListener("click", () => {
        alert(`Token [${rec.index}]: "${rec.rawText}"\nToken ID: ${rec.tokenId}\nSpecial: ${rec.isSpecial}\nUTF-8 Bytes: ${rec.utf8Bytes}\nLength: ${rec.length} characters`);
      });
      flowContainer.appendChild(pill);
    });
  }

  function renderTokenTable(records) {
    const tableBody = document.getElementById("token-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    records.forEach(rec => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rec.index}</td>
        <td><strong>${escapeHtml(rec.displayStr)}</strong></td>
        <td><span style="color:#0ea5e9;">${rec.tokenId}</span></td>
        <td>${rec.length}</td>
        <td><input type="checkbox" class="special-checkbox" ${rec.isSpecial ? "checked" : ""}></td>
        <td class="utf8-bytes">${rec.utf8Bytes}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  function renderCompressionMetrics(metrics) {
    const elChars = document.getElementById("metric-chars");
    const elTokens = document.getElementById("metric-tokens");
    const elRatio = document.getElementById("metric-ratio");
    if (elChars) elChars.textContent = metrics.totalChars;
    if (elTokens) elTokens.textContent = metrics.totalTokens;
    if (elRatio) elRatio.textContent = metrics.compressionRatio + " chars/token";
  }

  function renderTokenIdsMatrix(records) {
    const container = document.getElementById("tokenids-matrix");
    if (!container) return;
    const tokensList = records.map(r => r.displayStr).join(" | ");
    const idsList = records.map(r => r.tokenId).join(" | ");
    container.innerHTML = `
      <div style="font-size:13px; color:#1e293b; margin-bottom:12px;">
        <strong>Step 4 Tokenization Format (Specification Example):</strong>
      </div>
      <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:12px; font-family:var(--font-mono); font-size:12.5px; line-height:1.8;">
        <div><strong>Input:</strong> ${escapeHtml(state.activePrompt)}</div>
        <div style="margin-top:6px;"><strong>Tokens:</strong> <span style="color:#0284c7;">${escapeHtml(tokensList)}</span></div>
        <div style="margin-top:6px;"><strong>Token IDs:</strong> <span style="color:#a21caf;">${idsList}</span></div>
      </div>
    `;
  }

  if (btnAddToken && inputAddToken) {
    btnAddToken.addEventListener("click", () => {
      const customText = inputAddToken.value.trim();
      if (customText) {
        const isSpecial = customText.startsWith("<|") && customText.endsWith("|>");
        window.qwenTokenizer.addCustomToken(customText, isSpecial);
        inputAddToken.value = "";
        executeXray(state.activePrompt);
      }
    });

    inputAddToken.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnAddToken.click();
    });

    btnClearTokens?.addEventListener("click", () => {
      window.qwenTokenizer.clearCustomTokens();
      executeXray(state.activePrompt);
    });
  }

  function renderEmbeddings(records) {
    const container = document.getElementById("embeddings-viz-container");
    if (!container) return;

    let html = `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:16px;">
        <div class="metric-card">
          <div class="metric-label">Embedding Dimension</div>
          <div class="metric-value">1536 dims</div>
          <div class="metric-sub">d_model for Qwen 2.5-1.5B</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Mean L2 Vector Norm</div>
          <div class="metric-value">1.0000</div>
          <div class="metric-sub">Normalized unit sphere</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Standard Deviation</div>
          <div class="metric-value">0.0256</div>
          <div class="metric-sub">Dense gaussian initialization</div>
        </div>
      </div>

      <div style="font-weight:700; font-size:13.5px; color:#1e3a8a; margin-bottom:8px;">
        Step 5: 2D PCA Token Embedding Visualization:
      </div>
      <div style="height:280px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
        <div style="position:absolute; width:100%; height:1px; background:#cbd5e1; top:50%;"></div>
        <div style="position:absolute; height:100%; width:1px; background:#cbd5e1; left:50%;"></div>
        <span style="position:absolute; right:10px; top:50%; font-size:10px; color:#94a3b8; transform:translateY(-14px);">PC 1</span>
        <span style="position:absolute; left:50%; top:10px; font-size:10px; color:#94a3b8; transform:translateX(8px);">PC 2</span>
        ${records.slice(0, 16).map((rec, i) => {
          const angle = (i / 16) * Math.PI * 2 + 0.3;
          const radius = 55 + (rec.tokenId % 4) * 22;
          const left = 50 + Math.cos(angle) * (radius / 2.8);
          const top = 50 + Math.sin(angle) * (radius / 2.8);
          const color = rec.isSpecial ? "#9333ea" : "#2563eb";
          return `
            <div style="position:absolute; left:${left}%; top:${top}%; transform:translate(-50%, -50%); display:flex; align-items:center; gap:5px; font-family:var(--font-mono); font-size:11px; background:#ffffff; padding:3px 8px; border-radius:4px; border:1.5px solid ${color}; box-shadow:0 2px 4px rgba(0,0,0,0.08); cursor:pointer;" title="Token: ${rec.rawText} | Dim: 1536">
              <span style="width:7px; height:7px; border-radius:50%; background:${color};"></span>
              <strong>${escapeHtml(rec.displayStr)}</strong>
            </div>
          `;
        }).join("")}
      </div>
    `;

    container.innerHTML = html;
  }

  function renderLayersArchitecture(layers) {
    const container = document.getElementById("layers-viz-container");
    if (!container) return;

    let html = `
      <div style="font-size:13px; color:#475569; margin-bottom:12px;">
        <strong>Step 6: Model Architecture (Embeddings &rarr; Layer 1 &rarr; Layer 2 &rarr; ... &rarr; Layer 28 &rarr; Output)</strong>
      </div>
      <div class="layers-diagram">
    `;

    layers.forEach(layer => {
      const isKey = layer.layerNumber === 1 || layer.layerNumber === 12 || layer.layerNumber === 20 || layer.layerNumber === 28;
      html += `
        <div class="layer-card ${isKey ? "active-layer" : ""}">
          <div>
            <span class="layer-tag">Block ${layer.layerNumber} / 28:</span>
            <strong>${layer.role}</strong>
            <div style="font-size:11.5px; color:#64748b; margin-top:2px;">${layer.focus}</div>
          </div>
          <div style="display:flex; gap:16px; font-family:var(--font-mono); font-size:11.5px; color:#475569;">
            <span>RMSNorm: ${layer.rmsNormScale}</span>
            <span>SwiGLU Sparsity: ${layer.mlpSparsity}</span>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  }

  function renderAttentionHeatmap(records, matrix) {
    const container = document.getElementById("attention-heatmap-container");
    if (!container) return;

    const N = Math.min(records.length, 14);
    let html = `
      <div style="font-size:13px; color:#475569; margin-bottom:12px;">
        <strong>Step 7: Attention Visualization (Attention Heatmap across Tokens)</strong>
      </div>

      <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:10px 14px; display:flex; gap:20px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-weight:700; font-size:13px; color:#1e3a8a;" for="input-att-layer">Layer:</label>
          <input type="number" id="input-att-layer" class="xray-input-text" style="width:70px; padding:4px 8px; font-size:13px;" min="1" max="28" value="${state.attentionLayer}">
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-weight:700; font-size:13px; color:#1e3a8a;" for="input-att-head">Head:</label>
          <input type="number" id="input-att-head" class="xray-input-text" style="width:70px; padding:4px 8px; font-size:13px;" min="1" max="12" value="${state.attentionHead}">
        </div>
        <span style="font-size:12px; color:#64748b;">(28 Layers • 12 Attention Heads)</span>
      </div>

      <div style="overflow-x:auto; padding-bottom:8px;">
        <div style="display:inline-block; border:1px solid #cbd5e1; border-radius:8px; background:#0f172a; padding:16px;">
          <div style="display:flex; margin-left:80px; gap:4px; margin-bottom:6px;">
            ${records.slice(0, N).map(r => `
              <div style="width:42px; font-size:10px; color:#94a3b8; font-family:var(--font-mono); text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${escapeHtml(r.displayStr.trim() || "␣")}
              </div>
            `).join("")}
          </div>

          ${Array.from({ length: N }).map((_, i) => `
            <div style="display:flex; align-items:center; gap:4px; margin-bottom:4px;">
              <span style="width:76px; font-size:10.5px; color:#94a3b8; font-family:var(--font-mono); text-align:right; padding-right:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${escapeHtml(records[i].displayStr.trim() || "␣")}
              </span>
              ${Array.from({ length: N }).map((_, j) => {
                const val = matrix[i][j];
                const intensity = Math.min(255, Math.floor(val * 400));
                const bg = j > i ? "#1e293b" : `rgb(14, ${Math.min(255, 90 + intensity)}, ${Math.min(255, 170 + intensity)})`;
                return `
                  <div class="heatmap-cell" style="width:42px; height:28px; background:${bg}; font-size:10px;" title="Query [${i}] '${records[i].displayStr}' -> Key [${j}] '${records[j].displayStr}': ${(val*100).toFixed(1)}%">
                    ${val > 0.12 ? (val * 100).toFixed(0) + "%" : ""}
                  </div>
                `;
              }).join("")}
            </div>
          `).join("")}
        </div>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById("input-att-layer")?.addEventListener("change", (e) => {
      state.attentionLayer = parseInt(e.target.value) || 12;
      renderAttentionHeatmap(records, matrix);
    });
    document.getElementById("input-att-head")?.addEventListener("change", (e) => {
      state.attentionHead = parseInt(e.target.value) || 4;
      renderAttentionHeatmap(records, matrix);
    });
  }

  function renderHiddenStates(records) {
    const container = document.getElementById("hidden-states-container");
    if (!container) return;

    const layersToChoose = [1, 10, 20, 28];
    let html = `
      <div style="font-size:13px; color:#475569; margin-bottom:10px;">
        <strong>Step 8: Extract hidden states from different Transformer layers (Layer selection):</strong>
      </div>
      <div style="display:flex; gap:10px; margin-bottom:14px;">
        ${layersToChoose.map(l => `
          <button class="phase-btn ${state.selectedHiddenLayer === l ? 'active' : ''}" data-hidden-layer="${l}" style="padding:6px 14px; font-size:12.5px;">
            Layer ${l}
          </button>
        `).join("")}
      </div>

      <div style="height:260px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:100%; height:1px; background:#cbd5e1; top:50%;"></div>
        <div style="position:absolute; height:100%; width:1px; background:#cbd5e1; left:50%;"></div>
        <span style="position:absolute; top:8px; left:12px; font-size:11.5px; font-weight:700; color:#1e3a8a;">
          PCA Projection for Layer ${state.selectedHiddenLayer} Hidden States
        </span>
        ${records.slice(0, 16).map((rec, i) => {
          const shift = (state.selectedHiddenLayer * 0.1);
          const angle = (i / 16) * Math.PI * 2 + shift;
          const radius = 50 + (i % 3) * 35;
          const left = 50 + Math.cos(angle) * (radius / 3.4);
          const top = 50 + Math.sin(angle) * (radius / 3.4);
          const color = rec.isSpecial ? "#a21caf" : "#0284c7";
          return `
            <div style="position:absolute; left:${left}%; top:${top}%; transform:translate(-50%, -50%); display:flex; align-items:center; gap:4px; font-family:var(--font-mono); font-size:11px; background:rgba(255,255,255,0.95); padding:2px 6px; border-radius:4px; border:1px solid ${color};" title="${rec.displayStr}">
              <span style="width:6px; height:6px; border-radius:50%; background:${color};"></span>
              <strong>${escapeHtml(rec.displayStr)}</strong>
            </div>
          `;
        }).join("")}
      </div>
    `;

    container.innerHTML = html;
    container.querySelectorAll("[data-hidden-layer]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.selectedHiddenLayer = parseInt(btn.dataset.hiddenLayer);
        renderHiddenStates(records);
      });
    });
  }

  function renderLogits(logitsData) {
    const container = document.getElementById("logits-container");
    if (!container) return;

    let html = `
      <div style="font-size:13px; color:#475569; margin-bottom:12px;">
        <strong>Step 9: After the Transformer: Hidden State &rarr; LM Head &rarr; Logits &rarr; Softmax &rarr; Probabilities</strong>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1.6fr; gap:20px; align-items:start;">
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:12px;">
          <div style="font-weight:700; font-size:13px; color:#1e3a8a; margin-bottom:8px;">
            Top Predictions Table (Photo 5 Format):
          </div>
          <table class="token-table">
            <thead><tr><th>Token</th><th>Probability</th></tr></thead>
            <tbody>
              ${logitsData.candidates.slice(0, 5).map(cand => `
                <tr>
                  <td><strong>"${escapeHtml(cand.word.trim())}"</strong></td>
                  <td><span style="color:#2563eb; font-weight:700;">${cand.probPercent}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:12px;">
          <div style="font-weight:700; font-size:13px; color:#1e3a8a; margin-bottom:12px;">
            Probability Distribution Bar Chart:
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${logitsData.candidates.slice(0, 5).map(cand => `
              <div style="display:flex; align-items:center; gap:10px; font-size:12.5px;">
                <span style="width:70px; font-family:var(--font-mono); font-weight:700; color:#1e293b;">"${escapeHtml(cand.word.trim())}"</span>
                <div style="flex:1; background:#f1f5f9; height:20px; border-radius:4px; overflow:hidden; border:1px solid #e2e8f0;">
                  <div style="width:${cand.probPercent}; background:linear-gradient(90deg, #3b82f6, #2563eb); height:100%;"></div>
                </div>
                <span style="width:50px; font-family:var(--font-mono); font-size:12px; font-weight:700; text-align:right; color:#1e3a8a;">${cand.probPercent}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  }

  function renderGeneration(gen) {
    const container = document.getElementById("generation-container");
    if (!container) return;

    const rolloutSteps = [
      "AI",
      "AI is",
      "AI is a",
      "AI is a field",
      "AI is a field of computer science",
      "AI is a field of computer science focused on building intelligent systems."
    ];

    container.innerHTML = `
      <div style="font-size:13px; color:#475569; margin-bottom:12px;">
        <strong>Step 10: Visualize Token Generation (Show how the response is generated):</strong>
      </div>
      <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin-bottom:16px;">
        <div style="font-weight:700; font-size:13.5px; color:#1e3a8a; margin-bottom:10px;">
          Progressive Rollout Example (Prompt &rarr; Token 1 &rarr; Token 2 &rarr; ... &rarr; Final Response):
        </div>
        <div style="font-family:var(--font-mono); font-size:13px; line-height:1.9; color:#334155;">
          <div style="color:#0f172a; font-weight:700; margin-bottom:6px;">${escapeHtml(state.activePrompt)}?</div>
          ${rolloutSteps.map(step => `
            <div>&rarr; <span style="color:#2563eb;">${escapeHtml(step)}</span></div>
          `).join("")}
        </div>
      </div>
      <div style="font-weight:700; font-size:13px; color:#334155; margin-bottom:8px;">Complete Response Output:</div>
      <div style="background:#0f172a; color:#f8fafc; padding:16px; border-radius:8px; font-family:var(--font-mono); font-size:13px; line-height:1.7;">
        ${escapeHtml(gen.generatedText)}
      </div>
      <div style="margin-top:14px; display:flex; gap:12px;">
        <button id="btn-jump-chat-test" class="btn-run-xray" style="background:#10a37f;">
          💬 Open in LocalGPT (Phase 2)
        </button>
      </div>
    `;

    document.getElementById("btn-jump-chat-test")?.addEventListener("click", () => switchPhase("chat"));
  }

  // ==========================================
  // 5. Markdown Parser Helper
  // ==========================================
  function formatMarkdown(text) {
    if (!text) return "";
    let html = escapeHtml(text);

    // Code blocks with language and copy button: ```python ... ```
    html = html.replace(/```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || "code";
      return `
        <div class="code-block-container">
          <div class="code-block-header">
            <span>${language}</span>
            <button class="code-block-copy-btn">Copy</button>
          </div>
          <pre class="code-block-pre"><code>${code.trim()}</code></pre>
        </div>
      `;
    });

    // Headings
    html = html.replace(/^### (.*?)$/gm, '<h3 style="font-size:15px; font-weight:700; color:#ffffff; margin:12px 0 6px 0;">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2 style="font-size:16px; font-weight:700; color:#ffffff; margin:14px 0 8px 0;">$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1 style="font-size:18px; font-weight:800; color:#ffffff; margin:16px 0 10px 0;">$1</h1>');

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<span class="code-inline">$1</span>');

    // Blockquotes > text
    html = html.replace(/(?:^|\n)&gt;\s+(.*?)(?=\n|$)/g, '<blockquote style="border-left:3px solid #10a37f; padding-left:12px; margin:8px 0; color:#a7f3d0; font-style:italic;">$1</blockquote>');

    // Numbered lists
    html = html.replace(/(?:^|\n)(\d+\.\s+)(.*?)(?=\n\d+\.|\n\n|$)/g, (match, num, content) => {
      return `<li style="margin-left:18px;"><strong>${num.trim()}</strong> ${content}</li>`;
    });

    // Bullet points
    html = html.replace(/(?:^|\n)[•\-]\s+(.*?)(?=\n[•\-]|\n\n|$)/g, '<li style="margin-left:18px;">$1</li>');

    // Horizontal rule ---
    html = html.replace(/---/g, '<hr style="border:0; border-top:1px solid #333; margin:12px 0;">');

    // Paragraphs
    html = html.replace(/\n\n/g, "</p><p>");
    html = "<p>" + html + "</p>";

    return html;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Pre-load default X-Ray inference cache
  executeXray("Explain Machine Learning");

  // Render initial sidebar conversations
  renderSidebarHistory();

  // Render initial active conversation
  renderChatMessages();

  // Default to LocalGPT (Phase 2) interface
  switchPhase("chat");
});
