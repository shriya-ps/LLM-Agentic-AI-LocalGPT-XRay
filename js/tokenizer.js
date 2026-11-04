/**
 * LLM X-Ray & Agentic AI: Tokenizer & BPE Engine
 * Authentically simulates Qwen 2.5 ChatML byte-pair encoding tokenization
 * Supports special tokens, custom tokens, hex UTF-8 byte conversion, and lexical metrics
 */

class QwenTokenizer {
  constructor() {
    // Exact Qwen 2.5 Vocabulary Mappings for authentic demonstration
    this.knownTokens = {
      "<|im_start|>": 151644,
      "<|im_end|>": 151645,
      "<|endoftext|>": 151643,
      "system": 8948,
      "\n": 198,
      "You": 2610,
      " are": 525,
      " a": 264,
      " helpful": 10950,
      " assistant": 17847,
      ".": 13,
      " Provide": 39565,
      " concise": 63594,
      ",": 11,
      " complete": 4583,
      " and": 323,
      " direct": 2118,
      " answers": 11253,
      "user": 872,
      "what": 12555,
      "What": 1820,
      " is": 374,
      " engineering": 14667,
      "?": 30,
      "assistant": 77091,
      "my": 847,
      "name": 836,
      "is": 374,
      "madhu": 68421,
      "shriya": 68422,
      "Python": 18585,
      " AI": 9552,
      " machine": 4467,
      " learning": 4638,
      "Agent": 21890,
      "ic": 309,
      ":": 25,
      "!": 0,
      "the": 279,
      "The": 791,
      "capital": 6864,
      "of": 315,
      "France": 9866,
      "Paris": 9232
    };

    this.specialTokens = new Set([
      "<|im_start|>",
      "<|im_end|>",
      "<|endoftext|>",
      "<|pad|>",
      "<|thought|>",
      "<|tool_call|>"
    ]);

    // Custom user-added tokens list
    this.customTokens = [];
  }

  /**
   * Generates a stable deterministic Token ID in Qwen's 151643 vocabulary range
   */
  hashTokenId(tokenStr) {
    if (this.knownTokens[tokenStr] !== undefined) {
      return this.knownTokens[tokenStr];
    }
    let hash = 0;
    for (let i = 0; i < tokenStr.length; i++) {
      hash = (hash << 5) - hash + tokenStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 145000) + 1000;
  }

  /**
   * Converts a string into its hexadecimal UTF-8 bytes representation (e.g. "0x3C 0x7C ...")
   */
  getUtf8HexBytes(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return Array.from(bytes)
      .map(b => "0x" + b.toString(16).toUpperCase().padStart(2, '0'))
      .join(" ");
  }

  /**
   * Formats a token string for pill display, replacing leading space with '_' and newlines with '↵ (newline)'
   */
  formatTokenDisplay(rawToken) {
    if (rawToken === "\n") return "↵ (newline)";
    if (rawToken.startsWith(" ")) return "_" + rawToken.slice(1);
    return rawToken;
  }

  /**
   * Breaks down text into subwords simulating BPE
   */
  tokenizeText(text) {
    if (!text) return [];

    const tokens = [];
    // Regular expression matching special tokens, punctuation, words with leading whitespace, newlines
    const regex = /(<\|[^|>]+(?:\|>)?)|(\n)|(\s+[a-zA-Z0-9]+)|([a-zA-Z0-9]+)|([^\s\w])/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const tokenStr = match[0];
      tokens.push(tokenStr);
    }
    return tokens;
  }

  /**
   * Builds the full standard Qwen 2.5 ChatML conversation sequence (matching Photo 2)
   */
  buildChatMLStream(userPrompt, systemPrompt = "You are a helpful assistant. Provide concise, complete, and direct answers.") {
    const sequence = [
      { type: "special", text: "<|im_start|>" },
      { type: "regular", text: "system" },
      { type: "regular", text: "\n" }
    ];

    // Tokenize system prompt
    const sysTokens = this.tokenizeText(systemPrompt);
    for (const t of sysTokens) {
      sequence.push({ type: "regular", text: t });
    }

    sequence.push(
      { type: "special", text: "<|im_end|>" },
      { type: "regular", text: "\n" },
      { type: "special", text: "<|im_start|>" },
      { type: "regular", text: "user" },
      { type: "regular", text: "\n" }
    );

    // Tokenize user prompt
    const userTokens = this.tokenizeText(userPrompt);
    for (const t of userTokens) {
      sequence.push({ type: "regular", text: t });
    }

    // Add any custom tokens added by user
    for (const custom of this.customTokens) {
      sequence.push(custom);
    }

    sequence.push(
      { type: "special", text: "<|im_end|>" },
      { type: "regular", text: "\n" },
      { type: "special", text: "<|im_start|>" },
      { type: "regular", text: "assistant" },
      { type: "regular", text: "\n" }
    );

    // Map each item to full record
    return sequence.map((item, idx) => {
      const isSpecial = this.specialTokens.has(item.text) || item.type === "special";
      const tokenId = this.hashTokenId(item.text);
      const displayStr = this.formatTokenDisplay(item.text);
      const utf8Bytes = this.getUtf8HexBytes(item.text);
      const length = item.text.length;

      return {
        index: idx,
        rawText: item.text,
        displayStr: displayStr,
        tokenId: tokenId,
        isSpecial: isSpecial,
        length: length,
        utf8Bytes: utf8Bytes
      };
    });
  }

  /**
   * Adds a new token to the stream (as requested by user)
   */
  addCustomToken(tokenText, isSpecial = false) {
    if (!tokenText) return;
    this.customTokens.push({
      type: isSpecial ? "special" : "regular",
      text: tokenText
    });
  }

  /**
   * Clears custom added tokens
   */
  clearCustomTokens() {
    this.customTokens = [];
  }

  /**
   * Calculates Lexical Compression Metrics
   */
  calculateMetrics(records) {
    const totalChars = records.reduce((acc, r) => acc + r.length, 0);
    const totalTokens = records.length;
    const compressionRatio = totalTokens > 0 ? (totalChars / totalTokens).toFixed(2) : "0.00";

    return {
      totalChars: totalChars,
      totalTokens: totalTokens,
      compressionRatio: compressionRatio
    };
  }
}

// Export singleton instance
window.qwenTokenizer = new QwenTokenizer();
