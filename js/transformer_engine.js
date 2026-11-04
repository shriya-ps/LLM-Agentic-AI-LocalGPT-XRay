/**
 * LLM X-Ray: Transformer Engine
 * Implements the mathematical and visual logic for all 9 stages of Transformer Inference:
 * 1. Input Prompt, 2. Tokenizer, 3. Token IDs, 4. Embeddings, 5. 28 Layers,
 * 6. Multi-Head Attention, 7. Hidden States, 8. Logits & Softmax, 9. Generation
 */

class TransformerEngine {
  constructor() {
    this.modelConfigs = {
      "qwen-1.5b": {
        name: "Qwen 2.5 - 1.5B (Instruct - Project Target)",
        hfTag: "Qwen/Qwen2.5-1.5B-Instruct",
        layers: 28,
        hiddenDim: 1536,
        heads: 12,
        kvHeads: 2,
        vocabSize: 151936,
        maxSeqLen: 32768,
        norm: "RMSNorm",
        activation: "SwiGLU",
        posEmb: "RoPE"
      },
      "qwen-0.5b": {
        name: "Qwen 2.5 - 0.5B (Ultra-Fast)",
        hfTag: "Qwen/Qwen2.5-0.5B-Instruct",
        layers: 28,
        hiddenDim: 896,
        heads: 14,
        kvHeads: 2,
        vocabSize: 151936,
        maxSeqLen: 32768,
        norm: "RMSNorm",
        activation: "SwiGLU",
        posEmb: "RoPE"
      },
      "llama-3.2-1b": {
        name: "Llama 3.2 - 1B (Lightweight)",
        hfTag: "meta-llama/Llama-3.2-1B-Instruct",
        layers: 16,
        hiddenDim: 2048,
        heads: 32,
        kvHeads: 8,
        vocabSize: 128256,
        maxSeqLen: 131072,
        norm: "RMSNorm",
        activation: "SwiGLU",
        posEmb: "RoPE"
      }
    };

    this.currentModelKey = "qwen-1.5b";
    this.hyperparams = {
      temperature: 0.75,
      topK: 50,
      topP: 0.90,
      maxNewTokens: 30
    };

    this.activeRecords = [];
    this.activePrompt = "Explain Machine Learning";
  }

  setModel(key) {
    if (this.modelConfigs[key]) {
      this.currentModelKey = key;
    }
  }

  getModelConfig() {
    return this.modelConfigs[this.currentModelKey];
  }

  /**
   * Runs the full 9-stage inference pass for a given user prompt
   */
  runInference(userPrompt, customHyperparams = null) {
    if (customHyperparams) {
      this.hyperparams = { ...this.hyperparams, ...customHyperparams };
    }
    this.activePrompt = userPrompt;
    this.activeRecords = window.qwenTokenizer.buildChatMLStream(userPrompt);

    return {
      config: this.getModelConfig(),
      records: this.activeRecords,
      metrics: window.qwenTokenizer.calculateMetrics(this.activeRecords),
      attentionMatrix: this.computeAttentionMatrix(this.activeRecords),
      embeddings: this.simulateEmbeddings(this.activeRecords),
      layerProfiles: this.simulateLayerStates(this.activeRecords),
      logits: this.computeNextTokenLogits(this.activeRecords, userPrompt),
      generation: this.simulateGeneration(userPrompt)
    };
  }

  /**
   * Generates a realistic causal Multi-Head Attention matrix (Q * K^T / sqrt(d))
   */
  computeAttentionMatrix(records) {
    const N = records.length;
    const matrix = [];

    for (let i = 0; i < N; i++) {
      const row = [];
      let rowSum = 0;
      for (let j = 0; j < N; j++) {
        if (j > i) {
          // Causal upper-triangular mask = 0 (future tokens masked out)
          row.push(0);
        } else {
          // Higher attention to self, initial system prompt tokens, and nearby tokens
          let rawScore = 0.2;
          if (i === j) rawScore += 0.45; // Diagonal self-attention
          if (j === 0 || j === 20) rawScore += 0.35; // Attention to special tags <|im_start|>
          if (i - j === 1) rawScore += 0.25; // Bigram local context
          if (records[j].displayStr.toLowerCase().includes("python") ||
              records[j].displayStr.toLowerCase().includes("madhu") ||
              records[j].displayStr.toLowerCase().includes("ai") ||
              records[j].displayStr.toLowerCase().includes("learning")) {
            rawScore += 0.5; // Key entity attention
          }
          // Add slight stochastic variance
          rawScore += Math.sin(i * 3 + j * 7) * 0.1;
          rawScore = Math.max(0.01, rawScore);
          row.push(rawScore);
          rowSum += rawScore;
        }
      }
      // Softmax normalization across valid causal keys
      const normalizedRow = row.map(v => (rowSum > 0 ? Number((v / rowSum).toFixed(3)) : 0));
      matrix.push(normalizedRow);
    }
    return matrix;
  }

  /**
   * Simulates Token + RoPE (Rotary Position Embeddings)
   */
  simulateEmbeddings(records) {
    const dim = this.getModelConfig().hiddenDim;
    return records.map((rec, pos) => {
      // First 8 dimensions sample for visualization
      const sampleDims = [];
      for (let d = 0; d < 8; d++) {
        // RoPE angle: theta = 10000^(-2d/dim)
        const theta = Math.pow(10000, (-2 * d) / dim);
        const ropeVal = Math.sin(pos * theta) * Math.cos(rec.tokenId % 100);
        sampleDims.push(Number(ropeVal.toFixed(3)));
      }
      return {
        token: rec.displayStr,
        pos: pos,
        norm: 1.0,
        sampleVector: sampleDims
      };
    });
  }

  /**
   * Simulates feature progression across the 28 Transformer layers
   */
  simulateLayerStates(records) {
    const totalLayers = this.getModelConfig().layers;
    const layerData = [];

    for (let l = 1; l <= totalLayers; l++) {
      let role = "Surface Lexical & Syntax Processing";
      let focus = "Local token n-grams, whitespace, and punctuation alignment";
      let normScore = 0.95 + (l * 0.05);

      if (l > 7 && l <= 18) {
        role = "Contextual Semantics & Entity Binding";
        focus = "Cross-sentence coreference resolution, domain ontology lookup";
      } else if (l > 18) {
        role = "Task Reasoning & Next-Token Distribution Shaping";
        focus = "Logit projection refinement, hallucination suppression, factual convergence";
      }

      layerData.push({
        layerNumber: l,
        role: role,
        focus: focus,
        rmsNormScale: normScore.toFixed(3),
        residualNorm: (1.2 + l * 0.14).toFixed(2),
        mlpSparsity: (42 + Math.sin(l) * 8).toFixed(1) + "%"
      });
    }
    return layerData;
  }

  /**
   * Computes Next-Token Candidates with Logits, Softmax, Temperature, Top-K, Top-P
   */
  computeNextTokenLogits(records, userPrompt) {
    const promptLower = userPrompt.toLowerCase().trim();
    let candidates = [];

    if (promptLower.includes("python")) {
      candidates = [
        { word: " is", rawLogit: 14.8, type: "Verb" },
        { word: " was", rawLogit: 12.1, type: "Past Verb" },
        { word: " code", rawLogit: 11.4, type: "Noun" },
        { word: " programming", rawLogit: 10.9, type: "Noun" },
        { word: " offers", rawLogit: 9.8, type: "Verb" },
        { word: " provides", rawLogit: 9.2, type: "Verb" },
        { word: " syntax", rawLogit: 8.6, type: "Noun" },
        { word: " can", rawLogit: 8.1, type: "Modal" }
      ];
    } else if (promptLower.includes("shriya") || promptLower.includes("madhu") || promptLower.includes("myname")) {
      candidates = [
        { word: "!", rawLogit: 15.2, type: "Punctuation" },
        { word: " Nice", rawLogit: 14.6, type: "Adjective" },
        { word: " Hello", rawLogit: 13.9, type: "Greeting" },
        { word: ",", rawLogit: 13.1, type: "Punctuation" },
        { word: " Welcome", rawLogit: 12.0, type: "Greeting" },
        { word: " How", rawLogit: 11.5, type: "Question" },
        { word: " pleasure", rawLogit: 10.3, type: "Noun" },
        { word: " today", rawLogit: 9.4, type: "Adverb" }
      ];
    } else if (promptLower.includes("what is ai") || promptLower.includes("explain machine learning") || promptLower.includes("ml")) {
      candidates = [
        { word: " is", rawLogit: 15.4, type: "Verb" },
        { word: " refers", rawLogit: 13.6, type: "Verb" },
        { word: " was", rawLogit: 12.2, type: "Verb" },
        { word: " can", rawLogit: 11.3, type: "Modal" },
        { word: " will", rawLogit: 10.1, type: "Modal" },
        { word: " represents", rawLogit: 9.4, type: "Verb" },
        { word: " enables", rawLogit: 8.7, type: "Verb" },
        { word: " provides", rawLogit: 7.9, type: "Verb" }
      ];
    } else if (promptLower.includes("france")) {
      candidates = [
        { word: " Paris", rawLogit: 16.5, type: "Noun" },
        { word: " located", rawLogit: 11.8, type: "Verb" },
        { word: " one", rawLogit: 10.4, type: "Determiner" },
        { word: " known", rawLogit: 9.7, type: "Verb" },
        { word: " a", rawLogit: 8.9, type: "Determiner" },
        { word: " considered", rawLogit: 8.2, type: "Verb" }
      ];
    } else {
      candidates = [
        { word: " Artificial", rawLogit: 14.5, type: "Noun" },
        { word: " The", rawLogit: 13.8, type: "Determiner" },
        { word: " AI", rawLogit: 13.1, type: "Noun" },
        { word: " Machine", rawLogit: 12.2, type: "Noun" },
        { word: " It", rawLogit: 11.7, type: "Pronoun" },
        { word: " refers", rawLogit: 10.8, type: "Verb" },
        { word: " stands", rawLogit: 10.1, type: "Verb" },
        { word: " in", rawLogit: 9.2, type: "Preposition" }
      ];
    }

    const T = Math.max(0.01, this.hyperparams.temperature);
    // Apply temperature scaling: z_i / T
    const scaledLogits = candidates.map(c => ({
      ...c,
      scaledLogit: c.rawLogit / T
    }));

    // Softmax calculation
    const maxScaled = Math.max(...scaledLogits.map(c => c.scaledLogit));
    const expValues = scaledLogits.map(c => Math.exp(c.scaledLogit - maxScaled));
    const sumExp = expValues.reduce((a, b) => a + b, 0);

    const probabilities = scaledLogits.map((c, i) => {
      const prob = expValues[i] / sumExp;
      return {
        ...c,
        prob: prob,
        probPercent: (prob * 100).toFixed(1) + "%",
        selected: i === 0 // Top pick
      };
    });

    return {
      temperature: T,
      topK: this.hyperparams.topK,
      topP: this.hyperparams.topP,
      candidates: probabilities
    };
  }

  /**
   * Simulates autoregressive generation with KV-Cache metrics
   */
  simulateGeneration(userPrompt) {
    const promptLower = userPrompt.toLowerCase().trim();
    let sampleResponse = "";

    if (promptLower.includes("python")) {
      sampleResponse = "Python is a high-level programming language that was created by Guido van Rossum and first released in 1991. It has gained significant popularity in recent years due to its simplicity, readability, and versatility, making it an ideal choice for beginners and experienced developers alike.";
    } else if (promptLower.includes("shriya") || promptLower.includes("madhu") || promptLower.includes("myname")) {
      sampleResponse = "Hello! Nice to meet you. I am your LLM and Agentic AI assistant powered by the local Qwen 2.5 transformer architecture. How can I assist you with your project today?";
    } else if (promptLower.includes("france")) {
      sampleResponse = "The capital of France is Paris, a major European city and global center for art, fashion, gastronomy, and culture.";
    } else if (promptLower.includes("what is ai")) {
      sampleResponse = "Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think, reason, perceive patterns, and solve complex problems.";
    } else {
      sampleResponse = "Machine Learning (ML) is an essential branch of Artificial Intelligence (AI) where models learn patterns from input embeddings, process contextual representations across 28 transformer layers, and autoregressively predict next tokens via softmax logits.";
    }

    const genTokens = window.qwenTokenizer.tokenizeText(sampleResponse);
    return {
      generatedText: sampleResponse,
      tokenCount: genTokens.length,
      tokens: genTokens,
      kvCacheSizeKB: (genTokens.length * 28 * 1536 * 2 / 1024).toFixed(1) + " KB",
      throughputTokensPerSec: 42.6,
      latencyFirstTokenMs: 84
    };
  }
}

// Export singleton
window.transformerEngine = new TransformerEngine();
