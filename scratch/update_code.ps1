$filePath = "js/phase3.js"
$content = [System.IO.File]::ReadAllText($filePath)

# 1. Update bindTopBarEvents to wire btn-top-voice
$oldTopBar = "    // Stop generating button`n    document.getElementById('btn-stop-generating')?.addEventListener('click', () => {`n      this.stopGeneration();`n    });`n  }"
$newTopBar = "    // Stop generating button`n    document.getElementById('btn-stop-generating')?.addEventListener('click', () => {`n      this.stopGeneration();`n    });`n`n    // Top Bar Voice button`n    document.getElementById('btn-top-voice')?.addEventListener('click', () => {`n      this.toggleVoiceAssistant();`n    });`n  }"

if ($content.Contains($oldTopBar)) {
    $content = $content.Replace($oldTopBar, $newTopBar)
    Write-Host "Updated bindTopBarEvents successfully."
} else {
    Write-Host "bindTopBarEvents anchor not found with LF, checking..."
}

# 2. Update bindInputEvents to wire btn-mic-input, btn-quick-ppt, and topic-pptx mode
$oldInputEvents = "        if (mode.startsWith('voice')) {`n          this.startVoiceAssistant();`n        }`n      });`n    });"
$newInputEvents = "        if (mode.startsWith('voice')) {`n          this.startVoiceAssistant();`n        } else if (mode === 'topic-pptx') {`n          const input = document.getElementById('chat-input');`n          if (input) {`n            input.placeholder = 'Enter presentation topic (e.g. Artificial Intelligence, Cloud Security)...';`n            input.focus();`n          }`n        }`n      });`n    });`n`n    // Dedicated Voice Mic button`n    document.getElementById('btn-mic-input')?.addEventListener('click', () => {`n      this.toggleVoiceAssistant();`n    });`n`n    // Dedicated Quick PPT button`n    document.getElementById('btn-quick-ppt')?.addEventListener('click', () => {`n      this.activeMode = 'topic-pptx';`n      const currentModeLabel = document.getElementById('current-mode-label');`n      if (currentModeLabel) currentModeLabel.textContent = '📊 Topic -> PPT (.pptx)';`n      document.querySelectorAll('.mode-menu-item').forEach(m => {`n        m.classList.toggle('active', m.getAttribute('data-mode') === 'topic-pptx');`n      });`n      const input = document.getElementById('chat-input');`n      if (input) {`n        input.placeholder = 'Enter presentation topic (e.g. Artificial Intelligence, Clinical Robotics)...';`n        input.focus();`n      }`n      this.showToast('📊 PPT Mode Active: Enter any topic to generate presentation!', 'info');`n    });"

if ($content.Contains($oldInputEvents)) {
    $content = $content.Replace($oldInputEvents, $newInputEvents)
    Write-Host "Updated bindInputEvents successfully."
} else {
    Write-Host "bindInputEvents anchor not found."
}

# 3. Update renderCurrentMessages for Image Card & Presentation Card
$oldRenderAssistant = "        // Export callout bar`n        const exportCalloutHtml = `"
$newRenderAssistant = "        // Image Card (if present)`n        let imageCardHtml = '';`n        if (msg.imageData) {`n          imageCardHtml = ``<div class=`"ai-image-card`"><div class=`"ai-image-header`"><span>🎨 Athena Vision · AI Render</span><span>${this.escapeHtml(msg.imageData.subject)}</span></div><div class=`"ai-image-preview-wrap`"><img src=`"${msg.imageData.url}`" alt=`"${this.escapeHtml(msg.imageData.subject)}`" onerror=`"this.onerror=null; this.src='${msg.imageData.fallback}';`" class=`"ai-generated-img`"></div><div class=`"ai-image-footer`"><span class=`"ai-image-prompt-text`" style=`"font-size:11.5px; color:#9ca3af;`">Prompt: ${this.escapeHtml(msg.imageData.prompt)}</span><a href=`"${msg.imageData.url}`" target=`"_blank`" download=`"${encodeURIComponent(msg.imageData.subject)}.jpg`" class=`"ai-image-btn`">⬇️ Download Full HD</a></div></div>``;`n        }`n`n        // Presentation Download Card (if present)`n        let presentationCardHtml = '';`n        if (msg.presentationData) {`n          const topicEsc = this.escapeHtml(msg.presentationData.topic);`n          presentationCardHtml = ``<div class=`"presentation-download-card`"><div class=`"presentation-card-header`"><div class=`"presentation-badge`">📊 PPTX GENERATED</div><div class=`"presentation-meta`">6 Slides · 16:9 Widescreen · Native OpenXML</div></div><div class=`"presentation-card-title`">${topicEsc} — Complete Presentation Deck</div><div class=`"presentation-slides-preview`"><span class=`"slide-pill`">1. Title</span><span class=`"slide-pill`">2. Introduction</span><span class=`"slide-pill`">3. Core Concepts</span><span class=`"slide-pill`">4. Applications</span><span class=`"slide-pill`">5. Challenges &amp; Risks</span><span class=`"slide-pill`">6. Conclusion &amp; Roadmap</span></div><button type=`"button`" class=`"btn-download-pptx-primary btn-dl-topic-pptx`" data-topic=`"${topicEsc}`"><span>⬇️ Download PowerPoint Presentation (.pptx)</span></button></div>``;`n        }`n`n        // Export callout bar`n        const exportCalloutHtml = `"`

if ($content.Contains($oldRenderAssistant)) {
    $content = $content.Replace($oldRenderAssistant, $newRenderAssistant)
    Write-Host "Updated renderCurrentMessages cards successfully."
} else {
    Write-Host "renderCurrentMessages cards anchor not found."
}

# 4. Insert imageCardHtml & presentationCardHtml into msgWrapper.innerHTML
$oldMsgWrap = "            <div class=`"assistant-body`" id=`"body-`${msg.id}`">`n              `${this.renderMarkdown(msg.content)}`n            </div>`n            `${citationHtml}`n            `${exportCalloutHtml}`"
$newMsgWrap = "            <div class=`"assistant-body`" id=`"body-`${msg.id}`">`n              `${this.renderMarkdown(msg.content)}`n            </div>`n            `${imageCardHtml}`n            `${presentationCardHtml}``n            `${citationHtml}``n            `${exportCalloutHtml}`"

if ($content.Contains($oldMsgWrap)) {
    $content = $content.Replace($oldMsgWrap, $newMsgWrap)
    Write-Host "Updated msgWrapper.innerHTML successfully."
} else {
    Write-Host "msgWrapper.innerHTML anchor not found."
}

# 5. Wire btn-dl-topic-pptx click in renderCurrentMessages
$oldPptxWire = "        // PPTX Exporters`n        const doPptx = () => this.exportAsPPTX(msg.content);`n        msgWrapper.querySelector('.btn-dl-pptx')?.addEventListener('click', doPptx);`n        msgWrapper.querySelector('.btn-export-ppt')?.addEventListener('click', doPptx);"
$newPptxWire = "        // PPTX Exporters`n        const doPptx = () => this.exportAsPPTX(msg.content);`n        msgWrapper.querySelector('.btn-dl-pptx')?.addEventListener('click', doPptx);`n        msgWrapper.querySelector('.btn-export-ppt')?.addEventListener('click', doPptx);`n        msgWrapper.querySelector('.btn-dl-topic-pptx')?.addEventListener('click', (e) => {`n          const topic = e.currentTarget.getAttribute('data-topic') || (msg.presentationData && msg.presentationData.topic) || 'Presentation';`n          this.downloadPresentation(topic);`n        });"

if ($content.Contains($oldPptxWire)) {
    $content = $content.Replace($oldPptxWire, $newPptxWire)
    Write-Host "Updated PPTX wiring successfully."
} else {
    Write-Host "PPTX wiring anchor not found."
}

# 6. Update generateResponseStream to pass assistantMsg
$oldStreamCall = "    // Stream the response tokens`n    const targetText = this.generateSmartResponse(prompt);"
$newStreamCall = "    // Stream the response tokens`n    const targetText = this.generateSmartResponse(prompt, assistantMsg);"

if ($content.Contains($oldStreamCall)) {
    $content = $content.Replace($oldStreamCall, $newStreamCall)
    Write-Host "Updated generateResponseStream call successfully."
} else {
    Write-Host "generateResponseStream anchor not found."
}

[System.IO.File]::WriteAllText($filePath, $content)
Write-Host "Pass 1 completed."
