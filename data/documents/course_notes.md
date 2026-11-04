# LLM and Agentic AI Curriculum
## 1. Transformer Architecture
- Model: Qwen 2.5-1.5B-Instruct
- Total Parameters: 1.54 Billion
- Decoder Layers: 28 layers
- Embedding Dimension: 1536
- Multi-Head Attention: 12 Query Heads, 2 Key-Value Heads (GQA)
- Positional Embedding: RoPE (Rotary Position Embeddings)
- Normalization: RMSNorm
- Activation: SwiGLU

## 2. Agentic RAG Systems
Retrieval-Augmented Generation bridges static parametric weights with dynamic vector stores.
Documents are chunked into 250-character segments with 40-character overlap.
Embeddings are computed and indexed in a FAISS vector store.
Cosine similarity is used to retrieve top-K relevant chunks for context injection.
