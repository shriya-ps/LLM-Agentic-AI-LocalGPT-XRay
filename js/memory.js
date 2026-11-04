/**
 * LocalGPT: Conversation Memory & Context Manager (Phase 2)
 * Manages multi-turn conversation histories, localStorage persistence,
 * context window formatting for Qwen 2.5, and conversation metadata.
 */

class ConversationMemoryManager {
  constructor() {
    this.storageKey = "localgpt_conversations_v2";
    this.activeChatKey = "HI";
    this.maxContextTurns = 10; // Keep up to 10 previous turns for context
    this.systemPrompts = {
      "default": "You are LocalGPT, a helpful, precise, and concise AI assistant powered by the local Qwen 2.5-1.5B transformer engine. Provide clear, accurate, and direct responses.",
      "code": "You are LocalGPT Code Specialist. You provide clean, modern, well-documented code with detailed explanations, best practices, and algorithmic complexity analysis.",
      "academic": "You are LocalGPT Academic Tutor. Explain complex topics using first principles, intuitive analogies, and rigorous academic definitions.",
      "concise": "You are LocalGPT Minimalist. Answer questions with extreme brevity, bullet points, and zero fluff."
    };
    this.currentSystemPromptKey = "default";
    this.customSystemPrompt = "";

    // Load from localStorage or initialize with default sample conversations matching Photos 1-5
    this.conversations = this.loadFromStorage();
  }

  getSystemPrompt() {
    if (this.currentSystemPromptKey === "custom" && this.customSystemPrompt) {
      return this.customSystemPrompt;
    }
    return this.systemPrompts[this.currentSystemPromptKey] || this.systemPrompts["default"];
  }

  setSystemPrompt(key, customText = "") {
    this.currentSystemPromptKey = key;
    if (customText) this.customSystemPrompt = customText;
    this.saveToStorage();
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn("Could not load from localStorage, using default conversations:", e);
    }

    // Default authentic multi-turn conversations matching Photos 1-5
    return {
      "HI": [
        {
          id: "msg_1",
          role: "user",
          content: "WHAT IS PYTHON",
          timestamp: "12:35 PM"
        },
        {
          id: "msg_2",
          role: "assistant",
          model: "qwen-2.5-1.5b-local",
          content: `Python is a high-level programming language that was created by Guido van Rossum and first released in 1991. It has gained significant popularity in recent years due to its simplicity, readability, and versatility, making it an ideal choice for beginners and experienced developers alike.

Key features of Python include:

1. **Syntax**: Its syntax is simple, allowing users to write clear and concise code.
2. **Abstraction**: Python supports object-oriented programming concepts, providing tools like classes and objects.
3. **Interactivity**: Libraries like \`tkinter\` (for GUI development) make Python programming easy and interactive.
4. **Performance**: The language is highly optimized for speed, thanks to its use of low-level constructs.
5. **Wide Range of Applications**: Used extensively in web development, scientific computing, data science, artificial intelligence, and many other fields.

Many popular software applications utilize Python, including:

• **Web Development**: Django, Flask, Ruby on Rails
• **Data Science**: Pandas, Scikit-learn, TensorFlow`,
          timestamp: "12:35 PM",
          promptUsed: "WHAT IS PYTHON"
        }
      ],
      "what is ML": [
        {
          id: "msg_3",
          role: "user",
          content: "what is ML",
          timestamp: "12:10 PM"
        },
        {
          id: "msg_4",
          role: "assistant",
          model: "qwen-2.5-1.5b-local",
          content: `**Machine Learning (ML)** is an essential branch of Artificial Intelligence (AI) that provides systems the ability to automatically learn and improve from experience without being explicitly programmed.

Core pillars of Machine Learning:
1. **Supervised Learning**: Mapping inputs to known outputs using labeled datasets.
2. **Unsupervised Learning**: Uncovering hidden patterns, representations, and clusters in raw data.
3. **Reinforcement Learning**: Training autonomous agents via feedback loops of rewards and state transitions.`,
          timestamp: "12:10 PM",
          promptUsed: "what is ML"
        },
        {
          id: "msg_5",
          role: "user",
          content: "What are its types?",
          timestamp: "12:12 PM"
        },
        {
          id: "msg_6",
          role: "assistant",
          model: "qwen-2.5-1.5b-local",
          content: `The main types of Machine Learning are:

1. **Supervised Learning**: Regression (predicting continuous values) and Classification (predicting discrete labels).
2. **Unsupervised Learning**: Clustering (K-Means), Dimensionality Reduction (PCA, t-SNE), and Density Estimation.
3. **Semi-Supervised Learning**: Leveraging small labeled sets with large unlabelled corpora.
4. **Reinforcement Learning (RL)**: Policy gradients, Q-learning, and RLHF (Reinforcement Learning from Human Feedback) used to align modern LLMs.`,
          timestamp: "12:12 PM",
          promptUsed: "What are its types?"
        }
      ],
      "what is aiml": [
        {
          id: "msg_7",
          role: "user",
          content: "what is aiml",
          timestamp: "11:45 AM"
        },
        {
          id: "msg_8",
          role: "assistant",
          model: "qwen-2.5-1.5b-local",
          content: `**AIML (Artificial Intelligence & Machine Learning)** represents the synergy between computational intelligence theories and empirical learning algorithms:

• **AI**: The overarching discipline aiming to create systems capable of cognitive tasks like reasoning, planning, and language comprehension.
• **ML**: The mathematical and computational substrate of modern AI that learns statistical patterns from large-scale corpora.
• **Agentic AI**: Modern autonomous systems combining LLMs, reflection loops, external tools, and vector memories.`,
          timestamp: "11:45 AM",
          promptUsed: "what is aiml"
        }
      ],
      "New Chat": [],
      "Write an asynchronous ...": [
        {
          id: "msg_9",
          role: "user",
          content: "Write an asynchronous token streamer in Python",
          timestamp: "Yesterday"
        },
        {
          id: "msg_10",
          role: "assistant",
          model: "qwen-2.5-1.5b-local",
          content: `Here is an asynchronous token streamer using Python's \`asyncio\` and Hugging Face \`TextIteratorStreamer\`:

\`\`\`python
import asyncio
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
from threading import Thread

async def stream_inference(prompt: str):
    # Load local Qwen 2.5 model
    model_name = "Qwen/Qwen2.5-1.5B-Instruct"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    
    inputs = tokenizer(prompt, return_tensors="pt")
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True)
    
    # Run generation in worker thread
    generation_thread = Thread(
        target=model.generate,
        kwargs=dict(**inputs, streamer=streamer, max_new_tokens=100)
    )
    generation_thread.start()
    
    # Asynchronously yield tokens
    for token in streamer:
        print(token, end="", flush=True)
        await asyncio.sleep(0.01)
\`\`\``,
          timestamp: "Yesterday",
          promptUsed: "Write an asynchronous token streamer in Python"
        }
      ]
    };
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.conversations));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  getActiveConversation() {
    if (!this.conversations[this.activeChatKey]) {
      this.conversations[this.activeChatKey] = [];
    }
    return this.conversations[this.activeChatKey];
  }

  addMessage(role, content, extra = {}) {
    const convo = this.getActiveConversation();
    const newMsg = {
      id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      role: role,
      content: content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...extra
    };
    convo.push(newMsg);
    this.saveToStorage();
    return newMsg;
  }

  updateMessage(messageId, newContent) {
    const convo = this.getActiveConversation();
    const idx = convo.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      convo[idx].content = newContent;
      convo[idx].edited = true;
      this.saveToStorage();
      return idx;
    }
    return -1;
  }

  truncateAfter(messageIndex) {
    const convo = this.getActiveConversation();
    if (messageIndex >= 0 && messageIndex < convo.length) {
      convo.splice(messageIndex + 1);
      this.saveToStorage();
    }
  }

  deleteLastAssistantMessage() {
    const convo = this.getActiveConversation();
    if (convo.length > 0 && convo[convo.length - 1].role === "assistant") {
      convo.pop();
      this.saveToStorage();
    }
  }

  createConversation(title = null) {
    if (!title) {
      title = "New Chat " + (Object.keys(this.conversations).length + 1);
    }
    this.conversations[title] = [];
    this.activeChatKey = title;
    this.saveToStorage();
    return title;
  }

  renameConversation(oldTitle, newTitle) {
    if (!newTitle || oldTitle === newTitle) return false;
    if (this.conversations[oldTitle]) {
      this.conversations[newTitle] = this.conversations[oldTitle];
      delete this.conversations[oldTitle];
      if (this.activeChatKey === oldTitle) {
        this.activeChatKey = newTitle;
      }
      this.saveToStorage();
      return true;
    }
    return false;
  }

  deleteConversation(title) {
    if (this.conversations[title]) {
      delete this.conversations[title];
      const remainingKeys = Object.keys(this.conversations);
      if (this.activeChatKey === title) {
        this.activeChatKey = remainingKeys.length > 0 ? remainingKeys[0] : this.createConversation("New Chat");
      }
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Builds the multi-turn context sequence for LLM inference (Photo 5: Message History -> Context Builder -> LLM)
   */
  buildMultiTurnPromptContext(currentUserQuery, ragContext = null) {
    const convo = this.getActiveConversation();
    // Gather up to maxContextTurns previous messages
    const recentMessages = convo.slice(-this.maxContextTurns);

    let systemText = this.getSystemPrompt();
    if (ragContext) {
      systemText += `\n\n[RELEVANT RETRIEVED KNOWLEDGE BASE CONTEXT]:\n${ragContext}\n\nAnswer the user using both your knowledge and the retrieved context above. Include citations when referring to the context.`;
    }

    // ChatML prompt construction
    let chatml = `<|im_start|>system\n${systemText}<|im_end|>\n`;

    recentMessages.forEach(msg => {
      chatml += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    });

    chatml += `<|im_start|>user\n${currentUserQuery}<|im_end|>\n<|im_start|>assistant\n`;

    return {
      fullChatML: chatml,
      turnsCount: recentMessages.length + 1,
      systemPrompt: systemText
    };
  }
}

// Export singleton
window.conversationMemory = new ConversationMemoryManager();
