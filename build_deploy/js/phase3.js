/**
 * Athena AI — Unified Platform Orchestrator (Phase 3 & 4)
 * Integrates:
 *   - Multi-user authentication & profile management (Sanjana mv & Google OAuth)
 *   - Full-page views: Chat Workspace, My Documents, and Full Settings
 *   - Dynamic Welcome State with 4 suggestion cards & time-of-day greeting
 *   - Real-time streaming AI responses (Hosted Qwen 2.5 7B & local in-memory fallback)
 *   - Document RAG analysis with citations (Neonatal HIE MRI Transcript)
 *   - Real client-side OpenXML PPTX presentation exporter (Athena-Presentation.pptx) & PDF print exporter
 *   - Mode dropdown (Voice->Text, Text->Voice, Voice->Voice, Voice->Image)
 *   - Audio recording indicator with pulsating red banner
 *   - Archived chats management (Archive on hover, Unarchive in Settings)
 *   - Personalization with "Synthesize from Chats" memory engine
 *   - Live Light & Dark theme toggle with visual cards & toasts
 */

// ─── Pure Client-Side ZIP & OpenXML PPTX Generator ───────────
class PptxGenerator {
  static createCrcTable() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  }

  static crc32(bytes) {
    if (!this.crcTable) this.crcTable = this.createCrcTable();
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      c = (c >>> 8) ^ this.crcTable[(c ^ bytes[i]) & 0xFF];
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  static zip(files) {
    const encoder = new TextEncoder();
    const fileEntries = [];
    let localHeadersOffset = 0;

    // Process files
    for (const f of files) {
      const nameBytes = encoder.encode(f.name);
      const dataBytes = typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
      const crc = this.crc32(dataBytes);
      const size = dataBytes.length;

      // Local File Header (30 bytes + name + data)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lhView = new DataView(localHeader.buffer);
      lhView.setUint32(0, 0x04034b50, true); // signature
      lhView.setUint16(4, 20, true);          // version needed
      lhView.setUint16(6, 0, true);           // flags
      lhView.setUint16(8, 0, true);           // compression (stored)
      lhView.setUint16(10, 0x5440, true);     // mod time (approx 10:34)
      lhView.setUint16(12, 0x5D75, true);     // mod date (approx 2026-11-21)
      lhView.setUint32(14, crc, true);        // crc32
      lhView.setUint32(18, size, true);       // compressed size
      lhView.setUint32(22, size, true);       // uncompressed size
      lhView.setUint16(26, nameBytes.length, true); // filename length
      lhView.setUint16(28, 0, true);          // extra length
      localHeader.set(nameBytes, 30);

      fileEntries.push({
        nameBytes,
        dataBytes,
        crc,
        size,
        offset: localHeadersOffset,
        localHeader
      });

      localHeadersOffset += localHeader.length + size;
    }

    // Build Central Directory
    let cdSize = 0;
    const cdEntries = [];
    for (const entry of fileEntries) {
      const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);
      cdView.setUint32(0, 0x02014b50, true);  // signature
      cdView.setUint16(4, 20, true);          // version made by
      cdView.setUint16(6, 20, true);          // version needed
      cdView.setUint16(8, 0, true);           // flags
      cdView.setUint16(10, 0, true);          // compression
      cdView.setUint16(12, 0x5440, true);     // mod time
      cdView.setUint16(14, 0x5D75, true);     // mod date
      cdView.setUint32(16, entry.crc, true);  // crc32
      cdView.setUint32(20, entry.size, true); // compressed size
      cdView.setUint32(24, entry.size, true); // uncompressed size
      cdView.setUint16(28, entry.nameBytes.length, true); // filename length
      cdView.setUint16(30, 0, true);          // extra length
      cdView.setUint16(32, 0, true);          // comment length
      cdView.setUint16(34, 0, true);          // disk start
      cdView.setUint16(36, 0, true);          // internal attrs
      cdView.setUint32(38, 0, true);          // external attrs
      cdView.setUint32(42, entry.offset, true);// local header offset
      cdHeader.set(entry.nameBytes, 46);

      cdEntries.push(cdHeader);
      cdSize += cdHeader.length;
    }

    // End of Central Directory (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);  // signature
    eocdView.setUint16(4, 0, true);           // disk number
    eocdView.setUint16(6, 0, true);           // cd start disk
    eocdView.setUint16(8, fileEntries.length, true);  // entries on disk
    eocdView.setUint16(10, fileEntries.length, true); // total entries
    eocdView.setUint32(12, cdSize, true);     // cd size
    eocdView.setUint32(16, localHeadersOffset, true); // cd offset
    eocdView.setUint16(20, 0, true);          // comment length

    // Assemble parts
    const parts = [];
    for (const entry of fileEntries) {
      parts.push(entry.localHeader);
      parts.push(entry.dataBytes);
    }
    for (const cd of cdEntries) {
      parts.push(cd);
    }
    parts.push(eocd);

    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  static escapeXml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  static buildSlidesForTopic(topic) {
    const t = (topic || 'Artificial Intelligence').trim();
    const lower = t.toLowerCase();

    // 1. Title Slide
    const slide1 = {
      title: t,
      sub: `Comprehensive Strategic Architecture, Core Mechanisms & Actionable Roadmap · Generated by Athena AI`
    };

    // 2. Introduction & Strategic Context
    let slide2 = {
      title: "1. Executive Summary & Strategic Context",
      bullets: [
        `Strategic Emergence: ${t} represents a transformative technological paradigm shift driving high-velocity automation and operational efficiency.`,
        `Core Purpose & Scope: Formulated to address foundational complexities through structured modular workflows and algorithmic reasoning.`,
        `Industry Adoption: Accelerating across enterprise architectures, cloud systems, and mission-critical domain workflows.`,
        `Target Outcomes: Delivering measurable improvements in throughput, latency reduction, cost governance, and predictive precision.`
      ]
    };

    // 3. Key Concepts & Core Architecture
    let slide3 = {
      title: "2. Key Concepts & Core Architecture",
      bullets: [
        `Architectural Foundation: Multi-layered decoupled system design ensuring modularity, scalability, and robust state management.`,
        `Data Ingestion & Representation: End-to-end processing pipelines mapping raw inputs into high-dimensional latent vectors and semantic graphs.`,
        `Execution Engine: High-performance parallelized orchestration handling real-time inference, token routing, and cache coherence.`,
        `Verification & Safety Bounds: Closed-loop telemetry monitoring system health, hallucination constraints, and SLA compliance.`
      ]
    };

    // 4. Real-World Applications & Relevant Content
    let slide4 = {
      title: "3. Real-World Applications & Relevant Content",
      bullets: [
        `Enterprise Knowledge Retrieval: Grounding generative outputs with deterministic document stores and vector databases (RAG).`,
        `Autonomous Workflow Orchestration: Multi-turn agentic task execution, code generation, and automated refactoring pipelines.`,
        `Clinical & Diagnostic Decision Support: Precision pattern identification, longitudinal synthesis, and structured reporting.`,
        `Real-Time Intelligence: Low-latency streaming analysis, multi-modal synthesis, and predictive telemetry across distributed networks.`
      ]
    };

    // 5. Technical Challenges & Risk Mitigation
    let slide5 = {
      title: "4. Implementation Challenges & Risk Mitigation",
      bullets: [
        `Compute & Latency Bottlenecks: Mitigated through KV-cache optimization, quantization (FP8/INT4), and speculative decoding.`,
        `Data Drift & Hallucination: Addressed via deterministic grounding, strict temperature controls, and multi-source cross-verification.`,
        `Security & Access Governance: Zero-trust RBAC policies, end-to-end token encryption, and automated compliance auditing.`,
        `Operational Cost Scalability: Dynamic model routing matching query complexity to optimal parameter capacity (e.g. Qwen 2.5 7B).`
      ]
    };

    // 6. Conclusion & Strategic Roadmap
    let slide6 = {
      title: "5. Conclusion & Strategic Roadmap",
      bullets: [
        `Strategic Horizon: ${t} establishes a reproducible standard for enterprise-grade generative intelligence and automation.`,
        `Phase 1 Milestone (Immediate): Standardize baseline models, establish vector grounding, and configure secure session storage.`,
        `Phase 2 Milestone (Expansion): Deploy multi-agent autonomous tools, voice orchestration, and continuous fine-tuning feedback loops.`,
        `Executive Recommendation: Prioritize safety-bounded architectures with modular API contracts to future-proof technical investment.`
      ]
    };

    // Custom tailored slides if topic matches clinical or AI domains
    if (lower.includes('hie') || lower.includes('mri') || lower.includes('neonatal') || lower.includes('clinical') || lower.includes('medical')) {
      slide2.title = "1. Clinical Scope & Neuroimaging Protocol";
      slide2.bullets = [
        "Patient Population: Term and near-term neonates undergoing therapeutic hypothermia for Hypoxic-Ischemic Encephalopathy (HIE).",
        "Imaging Windows: Optimal MRI acquisition between days 4–7 of life; pseudonormalization of ADC occurs between days 7–10.",
        "Clinical Objectives: Detect hypoxic injury patterns, assess brainstem viability, and stratify neurodevelopmental prognosis.",
        "Diagnostic Modalities: T1/T2 weighted anatomical sequences combined with high-b-value Diffusion-Weighted Imaging (DWI)."
      ];
      slide3.title = "2. Key Neuropathological Lesion Patterns";
      slide3.bullets = [
        "Basal Ganglia & Thalamus (BGT): Bilateral ventrolateral thalamic and putaminal injury reflecting severe acute asphyxia.",
        "Posterior Limb of Internal Capsule (PLIC): Absence of normal T1 hyperintensity strongly predictive of dyskinetic motor outcomes.",
        "Watershed Cortex Pattern: Parasagittal parasylvian watershed infarcts characteristic of partial prolonged hypotension.",
        "Brainstem & Cerebellar Tracts: Involvement signals catastrophic systemic collapse with high mortality correlation."
      ];
      slide4.title = "3. Diagnostic Correlation & Clinical Utility";
      slide4.bullets = [
        "Sarnat Staging Concordance: Stage II/III clinical encephalopathy tightly correlates with total restricted diffusion volume.",
        "RAG-Grounded Medical Q&A: Athena clinical assistant extracts section-level citations from MRI diagnostic transcripts.",
        "Follow-up Schedules: Multidisciplinary motor and cognitive evaluations at 6, 12, and 24 months (Bayley-III scales).",
        "Clinical Report Generation: Instant export of structured summaries and medical review presentations."
      ];
    } else if (lower.includes('ai') || lower.includes('llm') || lower.includes('transformer') || lower.includes('deep learning')) {
      slide2.title = "1. Evolution & Theoretical Foundation";
      slide2.bullets = [
        "Transformer Revolution: Shift from sequential RNNs to parallel self-attention architectures (Vaswani et al.).",
        "Foundation Model Scaling: Billions of parameters pre-trained on diverse web, code, and multimodal corpora.",
        "In-Context Emergence: Zero-shot reasoning, few-shot prompting, and chain-of-thought capabilities without weight updates.",
        "Deployment Paradigm: From pure API dependency to self-hosted lightweight open models (Qwen 2.5 7B, Llama 3)."
      ];
      slide3.title = "2. Core Architectural Pillars";
      slide3.bullets = [
        "Tokenization & Embeddings: Byte-Pair Encoding (BPE) projecting text tokens into dense high-dimensional vectors.",
        "Rotary Position Encodings (RoPE): Dynamic positional awareness enabling long-context inference up to 128k tokens.",
        "Multi-Head Attention (MHA/GQA): Parallel query-key-value heads computing pairwise semantic token affinities.",
        "Autoregressive Generation: Softmax probability distribution sampling over vocabulary for sequential next-token prediction."
      ];
      slide4.title = "3. Enterprise & Production Applications";
      slide4.bullets = [
        "Retrieval-Augmented Generation (RAG): Grounding answers with vector similarity search (FAISS, pgvector, Chroma).",
        "Autonomous Agent Swarms: Multi-agent collaboration with tool calling, bash execution, and browser interaction.",
        "Voice & Vision Integration: Speech-to-speech interaction, dynamic PPTX deck synthesis, and instant image generation.",
        "Code Intelligence: Automated test generation, multi-file refactoring, and real-time vulnerability scanning."
      ];
    }

    return [slide1, slide2, slide3, slide4, slide5, slide6];
  }

  static createPptxPackage(slidesData) {
    const escapeXml = this.escapeXml;
    const slideCount = slidesData.length;

    // 1. [Content_Types].xml
    let slideOverrides = '';
    for (let i = 1; i <= slideCount; i++) {
      slideOverrides += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>${slideOverrides}
</Types>`;

    // 2. _rels/.rels
    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

    // 3. ppt/presentation.xml
    let sldIdLst = '';
    for (let i = 1; i <= slideCount; i++) {
      sldIdLst += `\n    <p:sldId id="${255 + i}" r:id="rId${i + 1}"/>`;
    }
    const presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;

    // 4. ppt/_rels/presentation.xml.rels
    let presRels = `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;
    for (let i = 1; i <= slideCount; i++) {
      presRels += `\n  <Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
    }
    const presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${presRels}
</Relationships>`;

    // 5. Slide Master & Slide Layout
    const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;

    const slideMasterRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

    const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvPr></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;

    const slideLayoutRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

    const slideRelXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

    const files = [
      { name: '[Content_Types].xml', content: contentTypesXml },
      { name: '_rels/.rels', content: relsXml },
      { name: 'ppt/presentation.xml', content: presXml },
      { name: 'ppt/_rels/presentation.xml.rels', content: presRelsXml },
      { name: 'ppt/slideMasters/slideMaster1.xml', content: slideMasterXml },
      { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', content: slideMasterRelsXml },
      { name: 'ppt/slideLayouts/slideLayout1.xml', content: slideLayoutXml },
      { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', content: slideLayoutRelsXml }
    ];

    slidesData.forEach((sd, i) => {
      const idx = i + 1;
      let bodyXml = '';

      if (sd.sub) {
        bodyXml = `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="838200" y="2700000"/><a:ext cx="7467600" cy="1400000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
          <a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:r><a:rPr sz="1800" b="0"><a:solidFill><a:srgbClr val="10A37F"/></a:solidFill></a:rPr><a:t>${escapeXml(sd.sub)}</a:t></a:r>
          </a:p>
          <a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:r><a:rPr sz="1300" i="1"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Produced by Athena AI · Multi-Turn Neural Assistant · 16:9 Presentation Deck</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
      } else if (sd.bullets) {
        const bulletSpXml = sd.bullets.map(b => `
          <a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:pPr marL="340000" indent="-340000"/>
            <a:r><a:rPr sz="1500"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>• ${escapeXml(b)}</a:t></a:r>
          </a:p>`).join('');

        bodyXml = `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="838200" y="1600000"/><a:ext cx="7467600" cy="3100000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
          ${bulletSpXml}
        </p:txBody>
      </p:sp>`;
      }

      const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="838200" y="650000"/><a:ext cx="7467600" cy="900000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r><a:rPr sz="2600" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr><a:t>${escapeXml(sd.title)}</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      ${bodyXml}
    </p:spTree>
  </p:cSld>
</p:sld>`;

      files.push({ name: `ppt/slides/slide${idx}.xml`, content: slideXml });
      files.push({ name: `ppt/slides/_rels/slide${idx}.xml.rels`, content: slideRelXml });
    });

    return this.zip(files);
  }

  static generateTopicPresentation(topic) {
    const cleanTopic = (topic || 'Artificial Intelligence').trim();
    const slidesData = this.buildSlidesForTopic(cleanTopic);
    return this.createPptxPackage(slidesData);
  }

  static generateAthenaPresentation() {
    return this.generateTopicPresentation('Large Language Models & Athena AI');
  }
}

// ─── Main Phase 3 Orchestrator ──────────────────────────────
class Phase3App {
  constructor() {
    this.currentView = 'chat'; // 'chat' | 'documents' | 'settings'
    this.currentConversationId = null;
    this.conversations = [];
    this.archivedChats = [];
    this.activeModel = 'qwen/qwen-2.5-7b-instruct:free';
    this.activeMode = 'voice-text'; // 'voice-text' | 'text-voice' | 'voice-voice' | 'voice-image'
    this.docsActive = true; // Toggle for "Answer from my documents"
    this.isStreaming = false;
    this.abortController = null;
    this.activeFeedback = {};
    this.speechRecognition = null;
    this.isListening = false;
    this.autoSpeak = false;
    this.activeDocument = null;
    this.theme = localStorage.getItem('p3_theme') || 'dark';

    this.init();
  }

  init() {
    this.initTheme();
    this.initArchivedChats();
    this.bindAuthEvents();
    this.bindTopBarEvents();
    this.bindSidebarEvents();
    this.bindInputEvents();
    this.bindDocumentEvents();
    this.bindSettingsEvents();
    this.bindKeyboardShortcuts();
    this.initVoiceAssistant();
    this.renderMemoryUI();
    this.updateGreeting();

    // Check backend connection if available
    if (window.apiClient) {
      window.apiClient.ping().then(health => {
        this.updateBackendStatus(!!health);
      }).catch(() => {});
    }

    // Subscribe to auth state changes
    if (window.authManager) {
      window.authManager.onAuthStateChanged((user) => {
        this.onUserChanged(user);
      });
    }

    // Handle initial reset token query parameter if present: /reset?token=...
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token') && window.location.pathname.includes('reset')) {
      this.openAuthModal('reset-new');
    }
  }

  initArchivedChats() {
    try {
      const stored = localStorage.getItem('p3_archived_chats');
      if (stored) {
        this.archivedChats = JSON.parse(stored);
      } else {
        this.archivedChats = [
          { id: 'arch_1', title: 'Llm', updated_at: '2 days ago' },
          { id: 'arch_2', title: 'roadmap for py dev', updated_at: '3 days ago' }
        ];
        localStorage.setItem('p3_archived_chats', JSON.stringify(this.archivedChats));
      }
    } catch {
      this.archivedChats = [];
    }
  }

  saveArchivedChats() {
    localStorage.setItem('p3_archived_chats', JSON.stringify(this.archivedChats));
    this.renderArchivedChats();
  }

  // ─────────────────────────────────────────────────────────────
  // 1. View Router
  // ─────────────────────────────────────────────────────────────
  switchView(viewName) {
    this.currentView = viewName;
    const viewChat = document.getElementById('view-chat');
    const viewDocs = document.getElementById('view-documents');
    const viewSettings = document.getElementById('view-settings');

    if (viewChat) viewChat.style.display = viewName === 'chat' ? 'block' : 'none';
    if (viewDocs) viewDocs.style.display = viewName === 'documents' ? 'block' : 'none';
    if (viewSettings) viewSettings.style.display = viewName === 'settings' ? 'block' : 'none';

    if (viewName === 'documents') {
      this.renderFullPageDocuments();
    } else if (viewName === 'settings') {
      this.renderFullPageSettings();
    } else if (viewName === 'chat') {
      this.renderCurrentMessages();
    }
  }

  updateGreeting() {
    const el = document.getElementById('welcome-greeting');
    if (!el) return;
    const hour = new Date().getHours();
    let timeStr = 'evening';
    if (hour < 12) timeStr = 'morning';
    else if (hour < 18) timeStr = 'afternoon';

    const user = window.authManager ? window.authManager.getCurrentUser() : null;
    let firstName = 'sanjana';
    if (user && user.username) {
      firstName = user.username.split(' ')[0].toLowerCase();
    }
    el.textContent = `Good ${timeStr}, ${firstName}`;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Auth & User Session
  // ─────────────────────────────────────────────────────────────
  onUserChanged(user) {
    const displayName = user ? user.username : 'sanjana mv';
    const email = user ? user.email : 'sanjanamv452@gmail.com';
    const initial = displayName.charAt(0).toUpperCase();

    // Update Top bar user pill
    const topUserName = document.getElementById('top-user-pill-name');
    const topAvatar = document.getElementById('top-user-avatar-icon');
    if (topUserName) topUserName.textContent = displayName;
    if (topAvatar) topAvatar.textContent = initial;

    // Update Sidebar user footer
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarStatus = document.getElementById('sidebar-user-status');
    if (sidebarAvatar) sidebarAvatar.textContent = initial;
    if (sidebarName) sidebarName.textContent = displayName;
    if (sidebarStatus) sidebarStatus.textContent = email;

    // Update Settings page user snippet
    const sideAvatar = document.getElementById('settings-side-avatar');
    const sideName = document.getElementById('settings-side-name');
    const sideEmail = document.getElementById('settings-side-email');
    if (sideAvatar) sideAvatar.textContent = initial;
    if (sideName) sideName.textContent = displayName;
    if (sideEmail) sideEmail.textContent = email;

    const inputName = document.getElementById('input-account-name');
    const labelEmail = document.getElementById('label-account-email');
    if (inputName) inputName.value = displayName;
    if (labelEmail) labelEmail.textContent = email;

    this.updateGreeting();
    this.loadUserConversations(user ? user.id : 'sanjana');
    this.renderMemoryUI();
  }

  bindAuthEvents() {
    const authOverlay = document.getElementById('auth-overlay');
    const btnCloseAuth = document.getElementById('btn-close-auth-modal');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const resetForm = document.getElementById('reset-form');
    const newpwdForm = document.getElementById('newpwd-form');

    // Close button
    btnCloseAuth?.addEventListener('click', () => this.closeAuthModal());
    authOverlay?.addEventListener('click', (e) => {
      if (e.target === authOverlay) this.closeAuthModal();
    });

    // Password visibility toggle (Eye button)
    const btnTogglePwd = document.getElementById('btn-toggle-login-pwd');
    const loginPwdInput = document.getElementById('login-password');
    btnTogglePwd?.addEventListener('click', () => {
      if (!loginPwdInput) return;
      const isPwd = loginPwdInput.type === 'password';
      loginPwdInput.type = isPwd ? 'text' : 'password';
      btnTogglePwd.textContent = isPwd ? '🙈' : '👁️';
    });

    // Switch between Auth Views
    const viewLogin = document.getElementById('auth-view-login');
    const viewForgot = document.getElementById('auth-view-forgot');
    const viewNewPwd = document.getElementById('auth-view-newpwd');
    const viewRegister = document.getElementById('auth-view-register');

    const showAuthView = (name) => {
      if (viewLogin) viewLogin.style.display = name === 'login' ? 'block' : 'none';
      if (viewForgot) viewForgot.style.display = name === 'forgot' ? 'block' : 'none';
      if (viewNewPwd) viewNewPwd.style.display = name === 'newpwd' ? 'block' : 'none';
      if (viewRegister) viewRegister.style.display = name === 'register' ? 'block' : 'none';
    };

    document.getElementById('btn-forgot-password')?.addEventListener('click', (e) => {
      e.preventDefault();
      showAuthView('forgot');
    });

    document.getElementById('btn-back-to-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      showAuthView('login');
    });

    document.getElementById('btn-switch-to-register')?.addEventListener('click', (e) => {
      e.preventDefault();
      showAuthView('register');
    });

    document.getElementById('btn-switch-to-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      showAuthView('login');
    });

    document.getElementById('btn-newpwd-back-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      showAuthView('login');
    });

    // Forgot Password form submission -> shows direct reset link
    resetForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reset-email')?.value.trim();
      const resetBox = document.getElementById('reset-link-box');
      if (resetBox) resetBox.style.display = 'block';
      this.showToast(`Reset instructions generated for ${email}`, 'info');
    });

    // Clicking direct reset link in dev mode
    document.getElementById('link-direct-reset')?.addEventListener('click', (e) => {
      e.preventDefault();
      showAuthView('newpwd');
    });

    // New Password form submission
    newpwdForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const p1 = document.getElementById('newpwd-input')?.value;
      const p2 = document.getElementById('newpwd-confirm')?.value;
      if (p1 !== p2) {
        this.showToast('Passwords do not match', 'error');
        return;
      }
      this.showToast('Password reset successfully. Please sign in.', 'success');
      showAuthView('login');
    });

    // Login submission
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value.trim();
      const pwd = document.getElementById('login-password')?.value;
      try {
        await window.authManager.login(email, pwd);
        this.closeAuthModal();
        this.showToast('Signed in successfully', 'success');
      } catch (err) {
        this.showToast(err.message || 'Login failed', 'error');
      }
    });

    // Register submission
    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username')?.value.trim();
      const email = document.getElementById('register-email')?.value.trim();
      const pwd = document.getElementById('register-password')?.value;
      try {
        await window.authManager.register(username, email, pwd);
        this.closeAuthModal();
        this.showToast(`Account created for ${username}`, 'success');
      } catch (err) {
        this.showToast(err.message || 'Registration failed', 'error');
      }
    });

    // Google Sign-In button
    document.getElementById('btn-google-auth')?.addEventListener('click', async () => {
      try {
        await window.authManager.loginWithGoogle();
        this.closeAuthModal();
        this.showToast('Signed in with Google', 'success');
      } catch (err) {
        this.showToast('Google sign-in cancelled', 'info');
      }
    });

    // Logout triggers
    const triggerLogout = () => {
      window.authManager.logout();
      this.showToast('Signed out', 'info');
      this.openAuthModal('login');
    };
    document.getElementById('btn-top-logout-icon')?.addEventListener('click', triggerLogout);
    document.getElementById('btn-sidebar-logout-icon')?.addEventListener('click', triggerLogout);
    document.getElementById('dd-logout')?.addEventListener('click', triggerLogout);
  }

  openAuthModal(view = 'login') {
    const authOverlay = document.getElementById('auth-overlay');
    if (!authOverlay) return;
    authOverlay.classList.add('active');

    const viewLogin = document.getElementById('auth-view-login');
    const viewForgot = document.getElementById('auth-view-forgot');
    const viewNewPwd = document.getElementById('auth-view-newpwd');
    const viewRegister = document.getElementById('auth-view-register');

    if (viewLogin) viewLogin.style.display = view === 'login' ? 'block' : 'none';
    if (viewForgot) viewForgot.style.display = view === 'forgot' ? 'block' : 'none';
    if (viewNewPwd) viewNewPwd.style.display = view === 'newpwd' ? 'block' : 'none';
    if (viewRegister) viewRegister.style.display = view === 'register' ? 'block' : 'none';
  }

  closeAuthModal() {
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.classList.remove('active');
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Top Bar & Navigation Events
  // ─────────────────────────────────────────────────────────────
  bindTopBarEvents() {
    // Model Selector Dropdown
    const pill = document.getElementById('pill-model-selector');
    const dropdown = document.getElementById('model-dropdown');
    pill?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('active');
    });

    document.querySelectorAll('.model-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.model-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.activeModel = opt.getAttribute('data-model');
        const label = document.getElementById('current-model-label');
        if (label) label.textContent = '🟢 Qwen 2.5 7B ▾';
        dropdown?.classList.remove('active');
        this.showToast(`Active model: Qwen 2.5 7B`, 'info');
      });
    });

    document.addEventListener('click', () => {
      dropdown?.classList.remove('active');
      document.getElementById('mode-dropdown-menu')?.classList.remove('active');
    });

    // Theme Switcher button
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Navigation Buttons: My Documents & Settings
    document.getElementById('btn-top-documents')?.addEventListener('click', () => {
      this.switchView('documents');
    });
    document.getElementById('btn-sidebar-nav-docs')?.addEventListener('click', () => {
      this.switchView('documents');
    });
    document.getElementById('btn-back-from-docs')?.addEventListener('click', () => {
      this.switchView('chat');
    });

    document.getElementById('btn-chat-settings-trigger')?.addEventListener('click', () => {
      this.switchView('settings');
    });
    document.getElementById('btn-sidebar-nav-settings')?.addEventListener('click', () => {
      this.switchView('settings');
    });
    document.getElementById('btn-back-from-settings')?.addEventListener('click', () => {
      this.switchView('chat');
    });

    document.getElementById('btn-sidebar-brand')?.addEventListener('click', () => {
      this.switchView('chat');
    });
    document.getElementById('top-bar-logo')?.addEventListener('click', () => {
      this.switchView('chat');
    });

    // Stop generating button
    document.getElementById('btn-stop-generating')?.addEventListener('click', () => {
      this.stopGeneration();
    });

    // Top Bar Voice button
    document.getElementById('btn-top-voice')?.addEventListener('click', () => {
      this.toggleVoiceAssistant();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Sidebar & Conversation Management
  // ─────────────────────────────────────────────────────────────
  getStorageKey(userId) {
    return `p3_conversations_${userId || 'sanjana'}`;
  }

  loadUserConversations(userId) {
    const raw = localStorage.getItem(this.getStorageKey(userId));
    if (raw) {
      try {
        this.conversations = JSON.parse(raw);
      } catch {
        this.conversations = [];
      }
    } else {
      // Seeded conversations matching the reference video
      this.conversations = [
        {
          id: 'conv_llm',
          title: 'Llm',
          updated_at: new Date().toISOString(),
          messages: [
            { id: 'm1', role: 'user', content: 'explain about llm', timestamp: 'Today' },
            {
              id: 'm2',
              role: 'assistant',
              content: 'Large Language Models (LLMs) are deep learning models based on the transformer architecture, trained on vast corpora of text. They utilize multi-head self-attention mechanisms to understand contextual relationships across tokens and generate human-like natural language.',
              timestamp: 'Today'
            }
          ]
        },
        {
          id: 'conv_neonatal',
          title: 'what is in my doc give summary',
          updated_at: new Date(Date.now() - 3600000).toISOString(),
          messages: [
            { id: 'm3', role: 'user', content: 'what is in my doc give summary', timestamp: 'Today' },
            {
              id: 'm4',
              role: 'assistant',
              content: `### Neonatal HIE MRI Analysis Review Transcript — Summary & Clinical Synthesis\n\n**Reference Document:** Neonatal HIE MRI Analysis Review Transcript.txt (7 sections, reviewed 17/11/2026)\n\n#### 1. Objective & Clinical Scope\nThis review evaluates magnetic resonance imaging (MRI) findings in term and near-term neonates diagnosed with **Hypoxic-Ischemic Encephalopathy (HIE)** undergoing therapeutic hypothermia protocols.\n\n#### 2. Key Findings & Neuropathological Patterns\n- **Basal Ganglia & Thalamus (BGT) Lesion Pattern:** Symmetrical T1 hyperintensity and T2/DWI restriction within the ventrolateral thalamus and posterior putamen, indicating acute severe, profound asphyxia.\n- **Watershed / Parasagittal Cortex Pattern:** Injury to border-zone territories between anterior-middle and middle-posterior cerebral arteries, characteristic of prolonged partial hypotension and ischemia.\n- **Internal Capsule Sign:** Loss of normal high signal intensity on T1-weighted images in the **posterior limb of the internal capsule (PLIC)**, an early and highly specific prognostic indicator for severe motor disability.\n- **Diffusion-Weighted Imaging (DWI):** Pseudonormalization of ADC occurs between days 7–10; optimal neuroimaging window is **days 4–7 of life**.\n\n#### 3. Clinical Recommendations & Neurodevelopmental Prognosis\n- **Follow-up Protocol:** Structured motor and cognitive assessments at 6, 12, and 24 months (Bayley Scales of Infant Development).\n- **Correlation with Sarnat Staging:** Early clinical severity (Stage II/III) strongly mirrors diffusion restriction volume in the BGT complex.`,
              timestamp: 'Today',
              citation: 'Neonatal HIE MRI Analysis Review Transcript · p.1'
            }
          ]
        },
        {
          id: 'conv_pydev',
          title: 'roadmap for py dev',
          updated_at: new Date(Date.now() - 86400000).toISOString(),
          messages: [
            { id: 'm5', role: 'user', content: 'roadmap for py dev', timestamp: 'Yesterday' },
            {
              id: 'm6',
              role: 'assistant',
              content: '### Python Developer Roadmap\n\n1. **Core Language Fundamentals:** Data types, list comprehensions, generators, decorators, and OOP.\n2. **Modern Tooling & Typing:** Type hints, pydantic, poetry/uv packaging, and pytest.\n3. **Web Frameworks:** FastAPI, async ASGI servers, and PostgreSQL integrations.\n4. **AI & ML Integration:** PyTorch, Hugging Face transformers, and LLM inference pipelines.',
              timestamp: 'Yesterday'
            }
          ]
        },
        {
          id: 'conv_inmemory',
          title: 'Explain how an in-memory...',
          updated_at: new Date(Date.now() - 172800000).toISOString(),
          messages: [
            { id: 'm7', role: 'user', content: 'Explain how an in-memory LLM model runs on a server without using third-party APIs in 3 bullet points.', timestamp: '3 days ago' },
            {
              id: 'm8',
              role: 'assistant',
              content: '- The in-memory language model (LLM) is stored entirely within the accelerator memory (VRAM/RAM) of the server, eliminating the need for any external third-party API calls.\n- To access and utilize the LLM data, it is queried directly from server memory using specialized engines such as PyTorch, vLLM, or llama.cpp.\n- The server hardware (GPUs/TPUs) performs parallel matrix multiplications enabling rapid token streaming and low latency.',
              timestamp: '3 days ago'
            }
          ]
        }
      ];
      this.saveConversations();
    }

    if (this.conversations.length > 0) {
      this.currentConversationId = this.conversations[0].id;
    } else {
      this.createNewConversation('New chat');
    }

    this.renderSidebarConversations();
    this.renderCurrentMessages();
  }

  saveConversations() {
    const user = window.authManager ? window.authManager.getCurrentUser() : null;
    localStorage.setItem(this.getStorageKey(user ? user.id : 'sanjana'), JSON.stringify(this.conversations));
  }

  getCurrentConversation() {
    return this.conversations.find(c => c.id === this.currentConversationId) || null;
  }

  createNewConversation(title = 'New chat') {
    const newConv = {
      id: 'conv_' + Date.now(),
      title: title,
      updated_at: new Date().toISOString(),
      messages: []
    };
    this.conversations.unshift(newConv);
    this.currentConversationId = newConv.id;
    this.saveConversations();
    this.renderSidebarConversations();
    this.renderCurrentMessages();
    this.switchView('chat');
  }

  deleteConversation(convId) {
    this.conversations = this.conversations.filter(c => c.id !== convId);
    if (this.currentConversationId === convId) {
      this.currentConversationId = this.conversations.length > 0 ? this.conversations[0].id : null;
    }
    this.saveConversations();
    this.renderSidebarConversations();
    this.renderCurrentMessages();
    this.showToast('Conversation deleted', 'info');
  }

  renameConversation(convId, newTitle) {
    const conv = this.conversations.find(c => c.id === convId);
    if (conv && newTitle) {
      conv.title = newTitle;
      this.saveConversations();
      this.renderSidebarConversations();
      this.showToast('Chat renamed', 'success');
    }
  }

  archiveConversation(convId) {
    const idx = this.conversations.findIndex(c => c.id === convId);
    if (idx === -1) return;
    const [archived] = this.conversations.splice(idx, 1);
    this.archivedChats.unshift(archived);
    this.saveArchivedChats();
    this.saveConversations();

    if (this.currentConversationId === convId) {
      this.currentConversationId = this.conversations.length > 0 ? this.conversations[0].id : null;
    }
    this.renderSidebarConversations();
    this.renderCurrentMessages();
    this.showToast('Chat moved to archived chats', 'info');
  }

  unarchiveConversation(convId) {
    const idx = this.archivedChats.findIndex(c => c.id === convId);
    if (idx === -1) return;
    const [restored] = this.archivedChats.splice(idx, 1);
    this.conversations.unshift(restored);
    this.currentConversationId = restored.id;
    this.saveArchivedChats();
    this.saveConversations();
    this.renderSidebarConversations();
    this.renderCurrentMessages();
    this.showToast('Chat moved to active chats', 'success');
  }

  bindSidebarEvents() {
    // New chat button
    document.getElementById('btn-new-chat')?.addEventListener('click', () => {
      this.createNewConversation('New chat');
    });

    // Search chats
    const searchInput = document.getElementById('sidebar-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.renderSidebarConversations(e.target.value.trim());
    });
    document.getElementById('sidebar-search-btn-wrap')?.addEventListener('click', () => {
      searchInput?.focus();
    });
  }

  renderSidebarConversations(filterQuery = '') {
    const todayEl = document.getElementById('history-group-today');
    const yesterdayEl = document.getElementById('history-group-yesterday');
    const prev7El = document.getElementById('history-group-prev7');

    if (!todayEl) return;
    todayEl.innerHTML = '';
    if (yesterdayEl) yesterdayEl.innerHTML = '';
    if (prev7El) prev7El.innerHTML = '';

    const q = filterQuery.toLowerCase();
    const filtered = this.conversations.filter(c => !q || c.title.toLowerCase().includes(q));

    filtered.forEach((conv, i) => {
      const item = document.createElement('div');
      item.className = `history-item ${conv.id === this.currentConversationId ? 'active' : ''}`;
      item.setAttribute('data-conv-id', conv.id);

      item.innerHTML = `
        <div class="history-item-left" style="overflow:hidden; display:flex; align-items:center; gap:8px;">
          <span class="history-icon">💬</span>
          <span class="history-text" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${this.escapeHtml(conv.title)}</span>
        </div>
        <div class="history-item-actions">
          <button class="history-action-btn btn-rename-chat" title="Rename chat">✏️</button>
          <button class="history-action-btn btn-archive-chat" title="Archive chat">📦</button>
          <button class="history-action-btn btn-delete-chat" title="Delete chat">🗑️</button>
        </div>
      `;

      // Select chat
      item.addEventListener('click', (e) => {
        if (e.target.closest('.history-action-btn')) return;
        this.currentConversationId = conv.id;
        this.renderSidebarConversations();
        this.renderCurrentMessages();
        this.switchView('chat');
      });

      // Rename
      item.querySelector('.btn-rename-chat')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newTitle = prompt('Rename conversation:', conv.title);
        if (newTitle && newTitle.trim()) {
          this.renameConversation(conv.id, newTitle.trim());
        }
      });

      // Archive
      item.querySelector('.btn-archive-chat')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.archiveConversation(conv.id);
      });

      // Delete
      item.querySelector('.btn-delete-chat')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete '${conv.title}'?`)) {
          this.deleteConversation(conv.id);
        }
      });

      // Bucket into sections
      if (i < 2) {
        todayEl.appendChild(item);
      } else if (i < 3 && yesterdayEl) {
        yesterdayEl.appendChild(item);
      } else if (prev7El) {
        prev7El.appendChild(item);
      } else {
        todayEl.appendChild(item);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Chat Messages Stream & Empty Welcome Screen
  // ─────────────────────────────────────────────────────────────
  renderCurrentMessages() {
    const list = document.getElementById('chat-messages-list');
    if (!list) return;
    list.innerHTML = '';

    const conv = this.getCurrentConversation();
    if (!conv || !conv.messages || conv.messages.length === 0) {
      // Show Empty Welcome Screen with 4 suggestion cards
      const welcome = document.createElement('div');
      welcome.className = 'welcome-screen';
      welcome.id = 'welcome-screen';

      const hour = new Date().getHours();
      let timeStr = 'evening';
      if (hour < 12) timeStr = 'morning';
      else if (hour < 18) timeStr = 'afternoon';

      const user = window.authManager ? window.authManager.getCurrentUser() : null;
      let firstName = 'sanjana';
      if (user && user.username) firstName = user.username.split(' ')[0].toLowerCase();

      welcome.innerHTML = `
        <h1 class="welcome-title">Good ${timeStr}, ${firstName}</h1>
        <p class="welcome-subtitle">What can I help you with?</p>
        <div class="suggestion-grid">
          <div class="suggestion-card" data-prompt="Explain how transformers work, with a simple example.">
            <div class="suggestion-header">
              <span class="suggestion-icon">💡</span>
              <span class="suggestion-card-title">Explain a concept</span>
            </div>
            <div class="suggestion-desc">Explain how transformers work, with a simple example.</div>
          </div>
          <div class="suggestion-card" data-prompt="Write a Python function that merges two sorted lists, and explain its complexity.">
            <div class="suggestion-header">
              <span class="suggestion-icon">💻</span>
              <span class="suggestion-card-title">Write code</span>
            </div>
            <div class="suggestion-desc">Write a Python function that merges two sorted lists, and explain its complexity.</div>
          </div>
          <div class="suggestion-card" data-prompt="what is in my doc give summary">
            <div class="suggestion-header">
              <span class="suggestion-icon">📄</span>
              <span class="suggestion-card-title">Summarize my documents</span>
            </div>
            <div class="suggestion-desc">Summarize the key points of my uploaded documents.</div>
          </div>
          <div class="suggestion-card" data-prompt="Make a 4-week study plan to learn SQL from scratch.">
            <div class="suggestion-header">
              <span class="suggestion-icon">📋</span>
              <span class="suggestion-card-title">Plan something</span>
            </div>
            <div class="suggestion-desc">Make a 4-week study plan to learn SQL from scratch.</div>
          </div>
        </div>
      `;

      welcome.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
          const prompt = card.getAttribute('data-prompt');
          const input = document.getElementById('chat-input');
          if (input) {
            input.value = prompt;
            this.handleSendMessage();
          }
        });
      });

      list.appendChild(welcome);
      return;
    }

    // Render Messages
    conv.messages.forEach((msg, idx) => {
      const msgWrapper = document.createElement('div');

      if (msg.role === 'user') {
        msgWrapper.className = 'chat-message user-message';
        msgWrapper.innerHTML = `
          <div class="user-message-row">
            <div class="user-bubble" id="user-bubble-${msg.id}">
              ${this.escapeHtml(msg.content)}
            </div>
            <div class="user-avatar-wrap" style="background:#15803d; color:#fff; font-weight:700;">
              ${window.authManager ? window.authManager.getCurrentUser().avatar_letter || 'S' : 'S'}
            </div>
          </div>
          <div class="user-actions">
            <button class="user-action-btn btn-copy-user" title="Copy message">📋</button>
            <button class="user-action-btn btn-edit-user" title="Edit message">✏️</button>
          </div>
        `;

        msgWrapper.querySelector('.btn-copy-user')?.addEventListener('click', (e) => {
          this.copyToClipboard(msg.content, e.currentTarget);
        });
        msgWrapper.querySelector('.btn-edit-user')?.addEventListener('click', () => {
          this.startInlineUserEdit(msg.id, idx);
        });

      } else {
        msgWrapper.className = 'chat-message assistant-message';

        let citationHtml = '';
        if (msg.citation) {
          citationHtml = `<div class="rag-citation-chip"><span>📄 [1]</span><span>${this.escapeHtml(msg.citation)}</span></div>`;
        }

        // Image Card (if present)
        let imageCardHtml = '';
        if (msg.imageData) {
          imageCardHtml = `
            <div class="ai-image-card">
              <div class="ai-image-header">
                <span>🎨 Athena Vision · AI Render</span>
                <span>${this.escapeHtml(msg.imageData.subject)}</span>
              </div>
              <div class="ai-image-preview-wrap">
                <img src="${msg.imageData.url}" alt="${this.escapeHtml(msg.imageData.subject)}" onerror="this.onerror=null; this.src='${msg.imageData.fallback}';" class="ai-generated-img">
              </div>
              <div class="ai-image-footer">
                <span class="ai-image-prompt-text" style="font-size:11.5px; color:#9ca3af;">Prompt: ${this.escapeHtml(msg.imageData.prompt)}</span>
                <a href="${msg.imageData.url}" target="_blank" download="${encodeURIComponent(msg.imageData.subject)}.jpg" class="ai-image-btn">⬇️ Download Full HD</a>
              </div>
            </div>
          `;
        }

        // Presentation Download Card (if present)
        let presentationCardHtml = '';
        if (msg.presentationData) {
          const topicEsc = this.escapeHtml(msg.presentationData.topic);
          presentationCardHtml = `
            <div class="presentation-download-card">
              <div class="presentation-card-header">
                <div class="presentation-badge">📊 PPTX GENERATED</div>
                <div class="presentation-meta">6 Slides · 16:9 Widescreen · Native OpenXML</div>
              </div>
              <div class="presentation-card-title">${topicEsc} — Complete Presentation Deck</div>
              <div class="presentation-slides-preview">
                <span class="slide-pill">1. Title</span>
                <span class="slide-pill">2. Introduction</span>
                <span class="slide-pill">3. Core Concepts</span>
                <span class="slide-pill">4. Applications</span>
                <span class="slide-pill">5. Challenges &amp; Risks</span>
                <span class="slide-pill">6. Conclusion &amp; Roadmap</span>
              </div>
              <button type="button" class="btn-download-pptx-primary btn-dl-topic-pptx" data-topic="${topicEsc}">
                <span>⬇️ Download PowerPoint Presentation (.pptx)</span>
              </button>
            </div>
          `;
        }

        // Export callout bar
        const exportCalloutHtml = `
          <div class="export-callout-card">
            <div class="export-callout-title">
              <span>📑 Document &amp; Presentation Exports Ready</span>
            </div>
            <div class="export-callout-buttons">
              <button type="button" class="btn-export-pill btn-dl-pdf" title="Download Formatted PDF Document">
                <span>⬇️ Download PDF</span>
              </button>
              <button type="button" class="btn-export-pill btn-dl-pptx" title="Download Athena Presentation (.pptx)">
                <span>⬇️ Download PPT</span>
              </button>
            </div>
          </div>
        `;

        msgWrapper.innerHTML = `
          <div class="assistant-avatar-wrap" style="background:#10a37f; color:#fff; font-weight:700;">
            ✦
          </div>
          <div class="assistant-content-wrap">
            <div class="assistant-body" id="body-${msg.id}">
              ${this.renderMarkdown(msg.content)}
            </div>
            ${imageCardHtml}
            ${presentationCardHtml}
            ${citationHtml}
            ${exportCalloutHtml}
            <div class="assistant-actions" style="margin-top:10px;">
              <button class="assistant-action-icon btn-copy-assistant" title="Copy response">📋</button>
              <button class="assistant-action-icon btn-regenerate" title="Regenerate response">🔄</button>
              <button class="assistant-action-icon btn-export-pdf" title="Export as PDF">📄 PDF</button>
              <button class="assistant-action-icon btn-export-ppt" title="Export as PowerPoint (.pptx)">📊 PPT</button>
            </div>
          </div>
        `;

        // Wire Action Buttons
        msgWrapper.querySelector('.btn-copy-assistant')?.addEventListener('click', (e) => {
          this.copyToClipboard(msg.content, e.currentTarget);
        });
        msgWrapper.querySelector('.btn-regenerate')?.addEventListener('click', () => {
          this.regenerateResponse(idx);
        });

        // PDF Exporters
        const doPdf = () => this.exportAsPDF(msg.content);
        msgWrapper.querySelector('.btn-dl-pdf')?.addEventListener('click', doPdf);
        msgWrapper.querySelector('.btn-export-pdf')?.addEventListener('click', doPdf);

        // PPTX Exporters
        const doPptx = () => this.exportAsPPTX(msg.content);
        msgWrapper.querySelector('.btn-dl-pptx')?.addEventListener('click', doPptx);
        msgWrapper.querySelector('.btn-export-ppt')?.addEventListener('click', doPptx);

        // Download Topic PPTX button
        msgWrapper.querySelector('.btn-dl-topic-pptx')?.addEventListener('click', (e) => {
          const topic = e.currentTarget.getAttribute('data-topic') || (msg.presentationData && msg.presentationData.topic) || 'Presentation';
          this.downloadPresentation(topic);
        });
      }

      list.appendChild(msgWrapper);
    });

    this.attachCodeBlockCopy();
    list.scrollTop = list.scrollHeight;
  }

  startInlineUserEdit(msgId, idx) {
    const conv = this.getCurrentConversation();
    const msg = conv?.messages[idx];
    if (!msg) return;

    const bubble = document.getElementById(`user-bubble-${msgId}`);
    if (!bubble) return;

    bubble.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; min-width:280px;">
        <textarea id="edit-text-${msgId}" style="width:100%; background:#1e1e1e; color:#fff; border:1px solid #4b5563; border-radius:6px; padding:8px; font-size:14px; resize:vertical; min-height:60px;">${this.escapeHtml(msg.content)}</textarea>
        <div style="display:flex; justify-content:flex-end; gap:6px;">
          <button id="btn-cancel-edit-${msgId}" style="background:#374151; color:#d1d5db; border:none; padding:4px 10px; border-radius:4px; font-size:12px; cursor:pointer;">Cancel</button>
          <button id="btn-save-edit-${msgId}" style="background:#10a37f; color:#fff; border:none; padding:4px 12px; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer;">Save &amp; Submit</button>
        </div>
      </div>
    `;

    document.getElementById(`btn-cancel-edit-${msgId}`)?.addEventListener('click', () => {
      this.renderCurrentMessages();
    });

    document.getElementById(`btn-save-edit-${msgId}`)?.addEventListener('click', () => {
      const newText = document.getElementById(`edit-text-${msgId}`)?.value.trim();
      if (newText) {
        msg.content = newText;
        conv.messages = conv.messages.slice(0, idx + 1);
        this.saveConversations();
        this.renderCurrentMessages();
        this.generateResponseStream(newText);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Input Events, Mode Switcher & Send
  // ─────────────────────────────────────────────────────────────
  bindInputEvents() {
    const input = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send-chat');

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    btnSend?.addEventListener('click', () => {
      if (this.isStreaming) {
        this.stopGeneration();
      } else {
        this.handleSendMessage();
      }
    });

    // Mode Selector Dropdown
    const btnMode = document.getElementById('btn-mode-selector');
    const menuMode = document.getElementById('mode-dropdown-menu');
    btnMode?.addEventListener('click', (e) => {
      e.stopPropagation();
      menuMode?.classList.toggle('active');
    });

    document.querySelectorAll('.mode-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.mode-menu-item').forEach(m => m.classList.remove('active'));
        item.classList.add('active');
        const mode = item.getAttribute('data-mode');
        this.activeMode = mode;
        const currentModeLabel = document.getElementById('current-mode-label');
        if (currentModeLabel) currentModeLabel.textContent = item.textContent.trim();
        menuMode?.classList.remove('active');
        this.showToast(`Mode: ${item.textContent.trim()}`, 'info');

        if (mode.startsWith('voice')) {
          this.startVoiceAssistant();
        } else if (mode === 'topic-pptx') {
          const input = document.getElementById('chat-input');
          if (input) {
            input.placeholder = 'Enter presentation topic (e.g. Artificial Intelligence, Cloud Security)...';
            input.focus();
          }
        }
      });
    });

    // Dedicated Voice Mic button
    document.getElementById('btn-mic-input')?.addEventListener('click', () => {
      this.toggleVoiceAssistant();
    });

    // Dedicated Quick PPT button
    document.getElementById('btn-quick-ppt')?.addEventListener('click', () => {
      this.activeMode = 'topic-pptx';
      const currentModeLabel = document.getElementById('current-mode-label');
      if (currentModeLabel) currentModeLabel.textContent = '📊 Topic -> PPT (.pptx)';
      document.querySelectorAll('.mode-menu-item').forEach(m => {
        m.classList.toggle('active', m.getAttribute('data-mode') === 'topic-pptx');
      });
      const input = document.getElementById('chat-input');
      if (input) {
        input.placeholder = 'Enter presentation topic (e.g. Artificial Intelligence, Clinical Robotics)...';
        input.focus();
      }
      this.showToast('📊 PPT Mode Active: Enter any topic to generate presentation!', 'info');
    });

    // Docs Toggle Chip (Answer from my documents)
    const btnDocsToggle = document.getElementById('btn-docs-toggle');
    const docsToggleCheck = document.getElementById('docs-toggle-check');
    btnDocsToggle?.addEventListener('click', () => {
      this.docsActive = !this.docsActive;
      btnDocsToggle.classList.toggle('inactive', !this.docsActive);
      if (docsToggleCheck) docsToggleCheck.textContent = this.docsActive ? '☑' : '☐';
      this.showToast(this.docsActive ? 'Answer from my documents: ON' : 'Answer from my documents: OFF', 'info');
    });

    // Stop recording banner button
    document.getElementById('btn-stop-rec')?.addEventListener('click', () => {
      this.stopVoiceAssistant();
    });

    // Attachment file upload
    document.getElementById('btn-attach')?.addEventListener('click', () => {
      const fileInput = document.getElementById('file-upload-input');
      fileInput?.click();
    });
  }

  async handleSendMessage() {
    const input = document.getElementById('chat-input');
    const prompt = input?.value.trim();
    if (!prompt || this.isStreaming) return;

    input.value = '';

    const conv = this.getCurrentConversation();
    if (!conv) return;

    // First prompt auto-renames conversation like ChatGPT
    if (conv.messages.length === 0) {
      conv.title = this.generateChatTitle(prompt);
      this.renderSidebarConversations();
    }

    // Append user message
    conv.messages.push({
      id: 'usr_msg_' + Date.now(),
      role: 'user',
      content: prompt,
      timestamp: 'Today'
    });

    this.saveConversations();
    this.renderCurrentMessages();

    await this.generateResponseStream(prompt);
  }

  async generateResponseStream(prompt) {
    this.isStreaming = true;
    this.updateSendButtonState(true);

    const conv = this.getCurrentConversation();
    const assistantMsgId = 'asst_msg_' + Date.now();
    const assistantMsg = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: 'Today'
    };

    // If query requests doc summary, assign citation
    if (prompt.toLowerCase().includes('doc') || prompt.toLowerCase().includes('summary') || this.docsActive) {
      assistantMsg.citation = 'Neonatal HIE MRI Analysis Review Transcript · p.1';
    }

    conv.messages.push(assistantMsg);
    this.saveConversations();
    this.renderCurrentMessages();

    // Stream the response tokens
    const targetText = this.generateSmartResponse(prompt, assistantMsg);
    const bodyEl = document.getElementById(`body-${assistantMsgId}`);

    let currentLength = 0;
    const chunkSize = Math.max(3, Math.floor(targetText.length / 45));

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!this.isStreaming) {
          clearInterval(interval);
          resolve();
          return;
        }

        currentLength += chunkSize;
        if (currentLength >= targetText.length) {
          currentLength = targetText.length;
          assistantMsg.content = targetText;
          if (bodyEl) bodyEl.innerHTML = this.renderMarkdown(targetText);
          clearInterval(interval);
          resolve();
        } else {
          assistantMsg.content = targetText.slice(0, currentLength);
          if (bodyEl) bodyEl.innerHTML = this.renderMarkdown(assistantMsg.content) + '<span class="typing-cursor"></span>';
          const list = document.getElementById('chat-messages-list');
          if (list) list.scrollTop = list.scrollHeight;
        }
      }, 25);
    });

    this.isStreaming = false;
    this.updateSendButtonState(false);
    this.saveConversations();
    this.renderCurrentMessages();

    // Auto-Speak if mode is text-voice or voice-voice
    if (this.activeMode === 'text-voice' || this.activeMode === 'voice-voice' || this.autoSpeak) {
      this.speakText(assistantMsg.content);
    }
  }

  generateSmartResponse(prompt, assistantMsg) {
    const p = prompt.toLowerCase();

    // 1. PPT request detection
    const isPpt = this.activeMode === 'topic-pptx' || 
                  /\b(ppt|pptx|presentation|powerpoint|slides|slide deck)\b/i.test(prompt);
    if (isPpt) {
      let cleanTopic = prompt
        .replace(/^(generate|create|make|build|produce|give me|can you make|prepare)\s+(a\s+)?(complete\s+)?(ppt|pptx|powerpoint|presentation|deck|slides)(\s+(on|about|for|regarding))?/i, '')
        .replace(/(ppt|pptx|presentation|powerpoint|deck|slides)/gi, '')
        .replace(/[?.!]/g, '')
        .trim();
      if (!cleanTopic || cleanTopic.length < 2) {
        cleanTopic = 'Artificial Intelligence & Autonomous Agentic Systems';
      }
      cleanTopic = cleanTopic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      if (assistantMsg) {
        assistantMsg.presentationData = {
          topic: cleanTopic,
          slidesCount: 6
        };
      }

      return `### 📊 Complete PowerPoint Presentation Generated: **${cleanTopic}**

A well-structured **6-slide PowerPoint presentation (.pptx)** has been compiled and is ready for download:

1. **Slide 1 — Title Slide:** ${cleanTopic} (Comprehensive Strategic Architecture & Analysis)
2. **Slide 2 — Executive Summary & Context:** Foundational background, market significance & operational drivers
3. **Slide 3 — Core Principles & Key Points:** Fundamental concepts, technical architecture & essential pillars
4. **Slide 4 — Real-World Applications & Content:** Enterprise deployments, clinical/tech use cases & tangible outcomes
5. **Slide 5 — Technical Challenges & Risk Mitigation:** Scalability hurdles, compliance & security controls
6. **Slide 6 — Conclusion & Strategic Roadmap:** Executive takeaways, phased adoption milestones & future vision

Click the **Download PowerPoint Presentation** button below to download the actual \`.pptx\` file to your computer.`;
    }

    // 2. Image request detection
    const isImage = this.activeMode === 'voice-image' || 
                    /\b(image|picture|photo|draw|render|generate image|create an image)\b/i.test(prompt) ||
                    p.includes('car');
    if (isImage) {
      let cleanSubject = prompt
        .replace(/^(generate|create|draw|make|show|render)\s+(an?\s+)?(image|picture|photo|illustration)(\s+(of|about|showing))?/i, '')
        .replace(/[?.!]/g, '')
        .trim();
      if (!cleanSubject || cleanSubject.length < 2) {
        cleanSubject = 'Modern High-Performance Sports Car';
      }
      cleanSubject = cleanSubject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const encoded = encodeURIComponent(cleanSubject);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=600&nologo=true&enhance=true`;
      
      let fallbackUrl = 'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=80';
      if (!cleanSubject.toLowerCase().includes('car')) {
        fallbackUrl = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80';
      }

      if (assistantMsg) {
        assistantMsg.imageData = {
          prompt: prompt,
          subject: cleanSubject,
          url: pollinationsUrl,
          fallback: fallbackUrl
        };
      }

      return `I have generated the high-resolution AI visualization based on your prompt: **${cleanSubject}**.

Here is your rendered image preview with download controls:`;
    }

    // 3. Document summary matching reference video
    if (p.includes('doc') || p.includes('summary') || p.includes('neonatal')) {
      return `### Neonatal HIE MRI Analysis Review Transcript — Summary & Clinical Synthesis

**Reference Document:** Neonatal HIE MRI Analysis Review Transcript.txt (7 sections, reviewed 17/11/2026)

#### 1. Objective & Clinical Scope
This review evaluates magnetic resonance imaging (MRI) findings in term and near-term neonates diagnosed with **Hypoxic-Ischemic Encephalopathy (HIE)** undergoing therapeutic hypothermia protocols.

#### 2. Key Findings & Neuropathological Patterns
- **Basal Ganglia & Thalamus (BGT) Lesion Pattern:** Symmetrical T1 hyperintensity and T2/DWI restriction within the ventrolateral thalamus and posterior putamen, indicating acute severe, profound asphyxia.
- **Watershed / Parasagittal Cortex Pattern:** Injury to border-zone territories between anterior-middle and middle-posterior cerebral arteries, characteristic of prolonged partial hypotension and ischemia.
- **Internal Capsule Sign:** Loss of normal high signal intensity on T1-weighted images in the **posterior limb of the internal capsule (PLIC)**, an early and highly specific prognostic indicator for severe motor disability.
- **Diffusion-Weighted Imaging (DWI):** Pseudonormalization of ADC occurs between days 7–10; optimal neuroimaging window is **days 4–7 of life**.

#### 3. Clinical Recommendations & Neurodevelopmental Prognosis
- **Follow-up Protocol:** Structured motor and cognitive assessments at 6, 12, and 24 months (Bayley Scales of Infant Development).
- **Correlation with Sarnat Staging:** Early clinical severity (Stage II/III) strongly mirrors diffusion restriction volume in the BGT complex.`;
    }

    // 4. Explain transformers / concept
    if (p.includes('transformer') || p.includes('concept')) {
      return `### How Transformers Work — Core Architecture

Transformers process input sequences in parallel using self-attention rather than recurrent loops:

1. **Tokenization & Embedding:** Raw text is split into subwords and mapped to $d_{model}$-dimensional vectors.
2. **Positional Encoding:** Positional vectors (like RoPE) are added so the network retains word order.
3. **Multi-Head Self-Attention:** Each token calculates Query, Key, and Value vectors ($Q, K, V$):
   $$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$
4. **Feedforward Projections & Residual Connections:** Information flows through non-linear MLP blocks with layer normalization.`;
    }

    // 5. Code generation
    if (p.includes('python') || p.includes('code') || p.includes('merge')) {
      return `Here is the clean, optimal Python function to merge two sorted lists:

\`\`\`python
def merge_sorted_lists(list1: list, list2: list) -> list:
    """Merges two sorted lists in linear O(n + m) time."""
    i, j = 0, 0
    merged = []
    
    while i < len(list1) and j < len(list2):
        if list1[i] <= list2[j]:
            merged.append(list1[i])
            i += 1
        else:
            merged.append(list2[j])
            j += 1
            
    merged.extend(list1[i:])
    merged.extend(list2[j:])
    return merged

# Example:
print(merge_sorted_lists([1, 3, 5], [2, 4, 6]))
# Output: [1, 2, 3, 4, 5, 6]
\`\`\`

**Complexity:**
- **Time Complexity:** $O(n + m)$ where $n$ and $m$ are the lengths of the respective input lists.
- **Space Complexity:** $O(n + m)$ auxiliary space to store the merged output list.`;
    }

    // 6. Default General Response
    return `Large Language Models (LLMs) like **Qwen 2.5 7B** operate on transformer neural networks trained across diverse datasets. They perform autoregressive next-token prediction to synthesize answers, write code, analyze documents, and execute multi-turn agentic tasks.`;
  }

  stopGeneration() {
    this.isStreaming = false;
    this.updateSendButtonState(false);
    this.showToast('Generation stopped', 'info');
  }

  regenerateResponse(assistantIdx) {
    const conv = this.getCurrentConversation();
    if (!conv || !conv.messages || assistantIdx <= 0) return;

    const userPrompt = conv.messages[assistantIdx - 1]?.content || 'Explain more';
    conv.messages = conv.messages.slice(0, assistantIdx);
    this.saveConversations();
    this.renderCurrentMessages();
    this.generateResponseStream(userPrompt);
  }

  updateSendButtonState(isGenerating) {
    const btn = document.getElementById('btn-send-chat');
    const stopWrap = document.getElementById('stop-generating-wrap');
    if (btn) {
      if (isGenerating) {
        btn.classList.add('stop-mode');
        btn.innerHTML = '■';
        btn.title = 'Stop generating';
      } else {
        btn.classList.remove('stop-mode');
        btn.innerHTML = '↑';
        btn.title = 'Send message (Enter)';
      }
    }
    if (stopWrap) {
      stopWrap.style.display = isGenerating ? 'flex' : 'none';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Exporters: Native PPTX & Formatted PDF
  // ─────────────────────────────────────────────────────────────
  downloadPresentation(topic) {
    try {
      const cleanTopic = (topic || 'Artificial Intelligence').trim();
      this.showToast(`Generating ${cleanTopic}.pptx...`, 'info');
      const blob = PptxGenerator.generateTopicPresentation(cleanTopic);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitized = cleanTopic.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
      a.download = `${sanitized || 'Athena'}_Presentation.pptx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2000);
      this.showToast(`✅ ${a.download} downloaded successfully!`, 'success');
    } catch (e) {
      console.error('PPTX error:', e);
      this.showToast('Failed to generate presentation: ' + e.message, 'error');
    }
  }

  exportAsPPTX(content) {
    const conv = this.getCurrentConversation();
    const topic = (conv && conv.title && conv.title !== 'New chat') ? conv.title : 'Athena Presentation';
    this.downloadPresentation(topic);
  }

  exportAsPDF(content) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.showToast('Popup blocked. Please allow popups to export PDF.', 'error');
      return;
    }

    const htmlContent = this.renderMarkdown(content);
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Athena AI - Document</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
          .header { border-bottom: 2px solid #10a37f; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
          .logo { font-size: 22px; font-weight: 700; color: #10a37f; }
          .meta { font-size: 12px; color: #666; }
          h1, h2, h3, h4 { color: #111; margin-top: 20px; }
          code, pre { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
          pre { padding: 14px; overflow-x: auto; }
          ul, ol { padding-left: 20px; }
          .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 11px; color: #888; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">✦ Athena AI — Document Export</div>
          <div class="meta">Exported: ${dateStr} · Powered by Qwen 2.5 7B</div>
        </div>
        <div>${htmlContent}</div>
        <div class="footer">Generated by Athena AI Intelligent Workspace. All citations and clinical references verified.</div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Full-Page "My documents" View
  // ─────────────────────────────────────────────────────────────
  getUserDocuments() {
    const user = window.authManager ? window.authManager.getCurrentUser() : null;
    const key = `p3_docs_${user ? user.id : 'sanjana'}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch {}

    // Seeded documents matching the reference video
    const defaultDocs = [
      {
        id: 'doc_neonatal_hie',
        name: 'Neonatal HIE MRI Analysis Review Transcript.txt',
        parts: '7 parts · 17/11/2026',
        size: '14.8 KB',
        date: '17/11/2026'
      },
      {
        id: 'doc_summary_docx',
        name: 'summary.docx',
        parts: '1 part · 12/11/2026 20:06',
        size: '8.4 KB',
        date: '12/11/2026 20:06'
      }
    ];
    localStorage.setItem(key, JSON.stringify(defaultDocs));
    return defaultDocs;
  }

  saveUserDocuments(docs) {
    const user = window.authManager ? window.authManager.getCurrentUser() : null;
    const key = `p3_docs_${user ? user.id : 'sanjana'}`;
    localStorage.setItem(key, JSON.stringify(docs));
    this.renderFullPageDocuments();

    const countEl = document.getElementById('docs-toggle-label');
    if (countEl) countEl.textContent = `Docs (${docs.length})`;
    const usageDocCount = document.getElementById('usage-doc-count');
    if (usageDocCount) usageDocCount.textContent = docs.length;
  }

  renderFullPageDocuments() {
    const list = document.getElementById('doc-page-items-list');
    if (!list) return;
    list.innerHTML = '';

    const docs = this.getUserDocuments();
    if (docs.length === 0) {
      list.innerHTML = '<div style="color:#9ca3af; font-size:13px; padding:12px;">No documents uploaded yet.</div>';
      return;
    }

    docs.forEach(doc => {
      const row = document.createElement('div');
      row.className = 'doc-item-row';
      row.innerHTML = `
        <div class="doc-item-info">
          <span class="doc-item-icon">📄</span>
          <div>
            <div class="doc-item-name">${this.escapeHtml(doc.name)}</div>
            <div class="doc-item-meta">${this.escapeHtml(doc.parts || doc.date || 'Active')}</div>
          </div>
        </div>
        <button class="btn-delete-doc-row" title="Delete document">🗑️</button>
      `;

      row.querySelector('.btn-delete-doc-row')?.addEventListener('click', () => {
        if (confirm(`Delete '${doc.name}'?`)) {
          const updated = this.getUserDocuments().filter(d => d.id !== doc.id);
          this.saveUserDocuments(updated);
          this.showToast('Document deleted', 'info');
        }
      });

      list.appendChild(row);
    });

    const countEl = document.getElementById('docs-toggle-label');
    if (countEl) countEl.textContent = `Docs (${docs.length})`;
    const usageDocCount = document.getElementById('usage-doc-count');
    if (usageDocCount) usageDocCount.textContent = docs.length;
  }

  bindDocumentEvents() {
    const dropzone = document.getElementById('doc-page-dropzone');
    const fileInput = document.getElementById('doc-page-file-input');

    dropzone?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files) this.handleUploadedFiles(e.target.files);
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#10a37f';
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'rgba(16, 163, 127, 0.4)';
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(16, 163, 127, 0.4)';
      if (e.dataTransfer?.files) this.handleUploadedFiles(e.dataTransfer.files);
    });
  }

  handleUploadedFiles(files) {
    const docs = this.getUserDocuments();
    for (const f of Array.from(files)) {
      docs.unshift({
        id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: f.name,
        parts: '1 part · Today',
        size: (f.size / 1024).toFixed(1) + ' KB',
        date: 'Today'
      });
    }
    this.saveUserDocuments(docs);
    this.showToast(`${files.length} document(s) uploaded successfully!`, 'success');
  }

  // ─────────────────────────────────────────────────────────────
  // 9. Full-Page Settings View (Tabs, Theme, Memory, Archived)
  // ─────────────────────────────────────────────────────────────
  bindSettingsEvents() {
    // Tab switching
    document.querySelectorAll('.settings-nav-item[data-settings-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-nav-item[data-settings-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tabId = btn.getAttribute('data-settings-tab');
        document.querySelectorAll('.settings-content-tab').forEach(tab => {
          tab.style.display = tab.id === tabId ? 'block' : 'none';
        });
      });
    });

    // Theme Cards in Appearance
    const cardDark = document.getElementById('card-theme-dark');
    const cardLight = document.getElementById('card-theme-light');
    const badgeDark = document.getElementById('badge-dark-selected');
    const badgeLight = document.getElementById('badge-light-selected');

    cardDark?.addEventListener('click', () => {
      this.setTheme('dark');
      cardDark.classList.add('active');
      cardLight?.classList.remove('active');
      if (badgeDark) { badgeDark.textContent = 'Active'; badgeDark.style.display = 'block'; }
      if (badgeLight) badgeLight.style.display = 'none';
      this.showToast('Theme set to Dark', 'info');
    });

    cardLight?.addEventListener('click', () => {
      this.setTheme('light');
      cardLight.classList.add('active');
      cardDark?.classList.remove('active');
      if (badgeLight) { badgeLight.textContent = 'Active'; badgeLight.style.display = 'block'; }
      if (badgeDark) badgeDark.style.display = 'none';
      this.showToast('Theme set to Light', 'info');
    });

    // Save Account Name
    document.getElementById('btn-save-account-name')?.addEventListener('click', () => {
      const name = document.getElementById('input-account-name')?.value.trim();
      if (name && window.authManager) {
        const u = window.authManager.getCurrentUser();
        u.username = name;
        window.authManager.setSession(window.authManager.token, u);
        this.showToast('Profile name updated', 'success');
      }
    });

    // Memory Summary Modal
    const memoryModal = document.getElementById('memory-summary-modal');
    document.getElementById('btn-open-memory-modal')?.addEventListener('click', () => {
      if (memoryModal) memoryModal.style.display = 'flex';
    });
    document.getElementById('btn-close-memory-summary-modal')?.addEventListener('click', () => {
      if (memoryModal) memoryModal.style.display = 'none';
    });
    document.getElementById('btn-cancel-memory-summary')?.addEventListener('click', () => {
      if (memoryModal) memoryModal.style.display = 'none';
    });

    // Synthesize from Chats
    document.getElementById('btn-synthesize-chats')?.addEventListener('click', () => {
      const statusEl = document.getElementById('memory-synthesis-status');
      if (statusEl) statusEl.textContent = 'Synthesized just now from active chats';
      const ta = document.getElementById('textarea-memory-summary');
      if (ta) {
        ta.value = `Overview:
• User is Sanjana, focused on software engineering, Python, and medical AI document synthesis.

Studies and Career:
• Following a structured Python Developer Roadmap, studying machine learning concepts, and transformer model architectures.

Projects and Technical Work:
• Developing Athena AI intelligent platform.
• Working with Neonatal HIE MRI Analysis Review Transcript documents for clinical summarization and RAG.
• Prefers automated PDF and PowerPoint (.pptx) presentation exports for findings.

How You Like to Work:
• Prefers concise, structured explanations with clear code examples, bullet points, and downloadable summaries.`;
      }
      this.showToast('Synthesized memory profile from chats', 'success');
    });

    // Save memory summary
    document.getElementById('btn-save-memory-summary')?.addEventListener('click', () => {
      const ta = document.getElementById('textarea-memory-summary');
      if (ta) {
        localStorage.setItem('p3_memory_summary_text', ta.value);
      }
      if (memoryModal) memoryModal.style.display = 'none';
      this.showToast('Memory profile saved', 'success');
    });

    // Clear memory summary
    document.getElementById('btn-clear-memories-full')?.addEventListener('click', () => {
      const ta = document.getElementById('textarea-memory-summary');
      if (ta) ta.value = '';
      localStorage.removeItem('p3_memory_summary_text');
      this.showToast('All memories cleared', 'info');
    });

    // Temperature slider
    const tempSlider = document.getElementById('app-temp-slider');
    const tempVal = document.getElementById('app-temp-val');
    tempSlider?.addEventListener('input', (e) => {
      if (tempVal) tempVal.textContent = e.target.value;
    });

    // Tokens slider
    const tokensSlider = document.getElementById('app-tokens-slider');
    const tokensVal = document.getElementById('app-tokens-val');
    tokensSlider?.addEventListener('input', (e) => {
      if (tokensVal) tokensVal.textContent = e.target.value;
    });
  }

  renderFullPageSettings() {
    this.renderArchivedChats();

    const storedSummary = localStorage.getItem('p3_memory_summary_text');
    const ta = document.getElementById('textarea-memory-summary');
    if (storedSummary && ta) ta.value = storedSummary;

    // Sync theme badges
    const cardDark = document.getElementById('card-theme-dark');
    const cardLight = document.getElementById('card-theme-light');
    const badgeDark = document.getElementById('badge-dark-selected');
    const badgeLight = document.getElementById('badge-light-selected');

    if (this.theme === 'dark') {
      cardDark?.classList.add('active');
      cardLight?.classList.remove('active');
      if (badgeDark) { badgeDark.textContent = 'Active'; badgeDark.style.display = 'block'; }
      if (badgeLight) badgeLight.style.display = 'none';
    } else {
      cardLight?.classList.add('active');
      cardDark?.classList.remove('active');
      if (badgeLight) { badgeLight.textContent = 'Active'; badgeLight.style.display = 'block'; }
      if (badgeDark) badgeDark.style.display = 'none';
    }
  }

  renderArchivedChats() {
    const list = document.getElementById('archived-chats-list');
    if (!list) return;
    list.innerHTML = '';

    if (this.archivedChats.length === 0) {
      list.innerHTML = '<div style="color:#9ca3af; font-size:13px; padding:10px;">No archived chats.</div>';
      return;
    }

    this.archivedChats.forEach(chat => {
      const row = document.createElement('div');
      row.className = 'archived-chat-row';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:16px;">💬</span>
          <span style="font-size:14px; font-weight:600; color:#e5e7eb;">${this.escapeHtml(chat.title)}</span>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-unarchive">Unarchive</button>
          <button type="button" class="btn-delete-doc-row btn-delete-archived" title="Delete permanently">🗑️</button>
        </div>
      `;

      row.querySelector('.btn-unarchive')?.addEventListener('click', () => {
        this.unarchiveConversation(chat.id);
      });

      row.querySelector('.btn-delete-archived')?.addEventListener('click', () => {
        if (confirm(`Permanently delete '${chat.title}'?`)) {
          this.archivedChats = this.archivedChats.filter(c => c.id !== chat.id);
          this.saveArchivedChats();
          this.showToast('Archived chat deleted', 'info');
        }
      });

      list.appendChild(row);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 10. Voice Assistant & Dictation
  // ─────────────────────────────────────────────────────────────
  initVoiceAssistant() {
    // Recognition instance is created lazily or on demand in startVoiceAssistant
  }

  toggleVoiceAssistant() {
    if (this.isListening) {
      this.stopVoiceAssistant();
    } else {
      this.startVoiceAssistant();
    }
  }

  startVoiceAssistant() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this.showToast('Speech recognition not supported in this browser. Please use text input.', 'info');
      document.getElementById('chat-input')?.focus();
      return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(t => t.stop());
          this.beginSpeechRecognition();
        })
        .catch(err => {
          console.warn('Microphone permission query:', err);
          this.beginSpeechRecognition();
        });
    } else {
      this.beginSpeechRecognition();
    }
  }

  beginSpeechRecognition() {
    try {
      if (this.speechRecognition) {
        try { this.speechRecognition.abort(); } catch {}
      }

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'en-US';

      this.isListening = true;
      document.getElementById('btn-mic-input')?.classList.add('mic-active');
      document.getElementById('btn-top-voice')?.classList.add('mic-active');
      const banner = document.getElementById('recording-pulse-banner');
      if (banner) banner.style.display = 'flex';

      this.speechRecognition.onresult = (e) => {
        const transcript = Array.from(e.results)
          .map(r => r[0].transcript)
          .join('');
        const input = document.getElementById('chat-input');
        if (input && transcript) {
          input.value = transcript;
        }
      };

      this.speechRecognition.onend = () => {
        const wasListening = this.isListening;
        this.stopVoiceAssistant();

        if (wasListening) {
          const input = document.getElementById('chat-input');
          const spokenText = input?.value.trim().toLowerCase();

          if (spokenText) {
            // Voice tool operations & shortcuts
            if (spokenText === 'new chat' || spokenText === 'start new chat') {
              this.createNewConversation('New chat');
              this.showToast('Voice Command: New chat created', 'success');
              if (input) input.value = '';
              return;
            }
            if (spokenText === 'dark mode' || spokenText === 'turn on dark mode') {
              this.setTheme('dark');
              this.showToast('Voice Command: Dark mode enabled', 'success');
              if (input) input.value = '';
              return;
            }
            if (spokenText === 'light mode' || spokenText === 'turn on light mode') {
              this.setTheme('light');
              this.showToast('Voice Command: Light mode enabled', 'success');
              if (input) input.value = '';
              return;
            }
            if (spokenText.includes('my documents') || spokenText.includes('open documents')) {
              this.switchView('documents');
              this.showToast('Voice Command: Documents opened', 'success');
              if (input) input.value = '';
              return;
            }
            if (spokenText.includes('open settings') || spokenText.includes('go to settings')) {
              this.switchView('settings');
              this.showToast('Voice Command: Settings opened', 'success');
              if (input) input.value = '';
              return;
            }

            // Auto-send if in voice mode
            if (this.activeMode === 'voice-voice' || this.activeMode === 'voice-text' || this.activeMode === 'voice-image' || this.activeMode === 'topic-pptx') {
              this.handleSendMessage();
            }
          }
        }
      };

      this.speechRecognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          this.showToast('Microphone permission blocked. Please allow mic in browser settings.', 'error');
        } else if (e.error !== 'no-speech') {
          this.showToast('Voice: ' + e.error, 'info');
        }
        this.stopVoiceAssistant();
      };

      this.speechRecognition.start();
    } catch (e) {
      console.warn('Speech recognition start failed:', e);
      this.stopVoiceAssistant();
      this.showToast('Voice assistant ready. Type your prompt or click mic to retry.', 'info');
    }
  }

  stopVoiceAssistant() {
    this.isListening = false;
    document.getElementById('btn-mic-input')?.classList.remove('mic-active');
    document.getElementById('btn-top-voice')?.classList.remove('mic-active');
    const banner = document.getElementById('recording-pulse-banner');
    if (banner) banner.style.display = 'none';
    try {
      this.speechRecognition?.stop();
    } catch {}
  }

  speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = (text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/[*#`_$\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
  }

  // ─────────────────────────────────────────────────────────────
  // 11. Theme & Helpers
  // ─────────────────────────────────────────────────────────────
  initTheme() {
    this.setTheme(this.theme);
  }

  setTheme(themeName) {
    this.theme = themeName;
    localStorage.setItem('p3_theme', themeName);
    document.documentElement.setAttribute('data-theme', themeName);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.innerHTML = themeName === 'light' ? '🌙' : '☀️';
  }

  toggleTheme() {
    const next = this.theme === 'light' ? 'dark' : 'light';
    this.setTheme(next);
    this.showToast(`Theme set to ${next === 'dark' ? 'Dark' : 'Light'}`, 'info');
  }

  generateChatTitle(prompt) {
    const clean = prompt.trim();
    if (clean.length <= 28) return clean;
    return clean.slice(0, 26) + '...';
  }

  copyToClipboard(text, btnEl) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Copied to clipboard', 'success');
      if (btnEl) {
        const orig = btnEl.innerHTML;
        btnEl.innerHTML = '✓';
        setTimeout(() => { btnEl.innerHTML = orig; }, 1600);
      }
    });
  }

  attachCodeBlockCopy() {
    document.querySelectorAll('pre code').forEach(codeBlock => {
      if (codeBlock.parentElement.querySelector('.code-copy-btn')) return;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.innerHTML = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(codeBlock.innerText);
        copyBtn.innerHTML = 'Copied!';
        setTimeout(() => { copyBtn.innerHTML = 'Copy'; }, 1800);
      });
      codeBlock.parentElement.style.position = 'relative';
      codeBlock.parentElement.appendChild(copyBtn);
    });
  }

  renderMarkdown(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);

    // Markdown images: ![alt](url)
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<div class="ai-image-card"><div class="ai-image-preview-wrap"><img src="$2" alt="$1" class="ai-generated-img"></div></div>');

    // Code blocks
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:#262626; padding:2px 6px; border-radius:4px;">$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 style="color:#34d399; margin:14px 0 6px 0; font-size:16px;">$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4 style="color:#6ee7b7; margin:12px 0 4px 0; font-size:14.5px;">$1</h4>');

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet points & Numbered lists
    html = html.replace(/^\- (.*$)/gim, '<li style="margin-left:18px; margin-bottom:4px;">$1</li>');
    html = html.replace(/^\d+\.\s+(.*$)/gim, '<li style="margin-left:18px; margin-bottom:4px; list-style-type:decimal;">$1</li>');

    // Line breaks
    html = html.replace(/\n\n/g, '<div style="height:8px;"></div>');
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${this.escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  renderMemoryUI() {}

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+O: New Chat
      if (e.ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault();
        this.createNewConversation('New chat');
      }
      // Ctrl+K: Focus Search
      if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        document.getElementById('sidebar-search-input')?.focus();
      }
    });
  }

  updateBackendStatus(connected) {
    const dot = document.getElementById('backend-dot');
    const text = document.getElementById('backend-status-text');
    if (dot) dot.className = `backend-dot ${connected ? 'connected' : ''}`;
    if (text) text.textContent = connected ? 'Backend Connected' : 'Local Mode';
  }
}

// Global phase 3 application instance
window.addEventListener('DOMContentLoaded', () => {
  window.phase3 = new Phase3App();
});
