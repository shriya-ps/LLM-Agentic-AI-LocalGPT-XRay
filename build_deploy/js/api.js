/**
 * Phase 3 — Backend API Client
 * Handles all HTTP communication with the FastAPI backend.
 * Falls back gracefully when backend is unavailable.
 */

const API_BASE = (() => {
  // Auto-detect: if same origin, use relative. Otherwise use env.
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  // Production: same domain with /api prefix, or separate backend URL
  return window.BACKEND_URL || 'http://localhost:8000';
})();

class APIClient {
  constructor() {
    this.baseUrl = API_BASE;
    this.token = localStorage.getItem('p3_access_token') || null;
    this.isConnected = false;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('p3_access_token', token);
    } else {
      localStorage.removeItem('p3_access_token');
    }
  }

  getHeaders(extra = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(method, path, body = null, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const config = {
      method,
      headers: this.getHeaders(options.headers || {}),
      signal: options.signal,
    };
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }
    try {
      const res = await fetch(url, config);
      if (res.status === 401) {
        // Token expired — clear and trigger re-login
        this.setToken(null);
        window.phase3?.handleUnauthenticated();
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      if (res.status === 204) return null;
      return res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
        this.isConnected = false;
        window.phase3?.updateBackendStatus(false);
      }
      throw err;
    }
  }

  get(path, options = {})    { return this.request('GET',    path, null, options); }
  post(path, body, options = {}) { return this.request('POST', path, body, options); }
  patch(path, body, options = {}) { return this.request('PATCH', path, body, options); }
  delete(path, options = {}) { return this.request('DELETE', path, null, options); }

  // ─── Auth ───────────────────────────────────────
  async register(username, email, password) {
    return this.post('/auth/register', { username, email, password });
  }
  async login(email, password) {
    return this.post('/auth/login', { email, password });
  }
  async logout() {
    return this.post('/auth/logout', {}).catch(() => {});
  }
  async requestPasswordReset(email) {
    return this.post('/auth/password-reset/request', { email });
  }
  async confirmPasswordReset(token, new_password) {
    return this.post('/auth/password-reset/confirm', { token, new_password });
  }
  async getGoogleAuthUrl() {
    return this.get('/auth/google');
  }

  // ─── User Profile ────────────────────────────────
  async getProfile() {
    return this.get('/user/profile');
  }
  async updateProfile(data) {
    return this.patch('/user/profile', data);
  }

  // ─── Conversations ───────────────────────────────
  async listConversations(search = '', limit = 50) {
    const params = new URLSearchParams({ limit });
    if (search) params.set('search', search);
    return this.get(`/conversations?${params}`);
  }
  async createConversation(title = 'New Chat', model = null) {
    return this.post('/conversations', { title, model });
  }
  async updateConversation(id, data) {
    return this.patch(`/conversations/${id}`, data);
  }
  async deleteConversation(id) {
    return this.delete(`/conversations/${id}`);
  }
  async getMessages(convId) {
    return this.get(`/conversations/${convId}/messages`);
  }

  // ─── Chat Streaming ──────────────────────────────
  async streamChat(convId, message, model, ragEnabled = true, onChunk, onRagSources, onDone, onError) {
    const url = `${this.baseUrl}/chat/stream`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          conversation_id: convId,
          message,
          model,
          rag_enabled: ragEnabled,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'token' && onChunk) onChunk(data.content);
            else if (data.type === 'rag_sources' && onRagSources) onRagSources(data.sources);
            else if (data.type === 'done' && onDone) onDone(data.message_id);
            else if (data.type === 'error' && onError) onError(data.message);
          } catch (e) { /* skip malformed */ }
        }
      }
    } catch (err) {
      if (onError) onError(err.message);
    }
  }

  // ─── Message Actions ─────────────────────────────
  async sendFeedback(msgId, feedback) {
    return this.patch(`/messages/${msgId}/feedback`, { feedback });
  }
  async editMessage(msgId, content) {
    return this.patch(`/messages/${msgId}/edit`, { content });
  }
  async deleteMessage(msgId) {
    return this.delete(`/messages/${msgId}`);
  }

  // ─── Documents ───────────────────────────────────
  async uploadDocument(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${this.baseUrl}/documents/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  }
  async listDocuments() {
    return this.get('/documents');
  }
  async deleteDocument(docId) {
    return this.delete(`/documents/${docId}`);
  }

  // ─── Health Check ────────────────────────────────
  async ping() {
    try {
      const data = await this.get('/health');
      this.isConnected = true;
      return data;
    } catch {
      this.isConnected = false;
      return null;
    }
  }
}

// Global singleton
window.apiClient = new APIClient();

