/**
 * TrustRAG Frontend API Client
 * Connects to the Express backend (http://localhost:3001/api/v1)
 * Fails explicitly when the backend is unavailable so the UI never presents
 * local-only data as successfully persisted or indexed knowledge.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export class ApiClient {
  private static getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("trustrag_token");
  }

  static setToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("trustrag_token", token);
    }
  }

  static clearToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("trustrag_token");
    }
  }

  static getUserEmail(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("trustrag_user_email");
  }

  static setUserEmail(email: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("trustrag_user_email", email);
    }
  }

  static getUserName(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("trustrag_user_name");
  }

  static setUserName(name: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("trustrag_user_name", name);
    }
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const userEmail = this.getUserEmail();
    const userName = this.getUserName();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userEmail ? { "x-user-email": userEmail } : {}),
      ...(userName ? { "x-user-name": userName } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `HTTP error ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  static async login(email: string, password: string) {
    return this.request<{ user: any; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  static async register(name: string, email: string, password: string) {
    return this.request<{ user: any; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  }

  static async getMe() {
    return this.request<{ user: any }>("/auth/me");
  }

  // Document endpoints
  static async getDocuments() {
    return this.request<{ documents: any[] }>("/documents");
  }

  static async uploadDocument(formData: FormData) {
    const token = this.getToken();
    const userEmail = this.getUserEmail();
    const userName = this.getUserName();

    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userEmail ? { "x-user-email": userEmail } : {}),
      ...(userName ? { "x-user-name": userName } : {}),
    };

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Upload failed (${response.status})`);
    }

    return response.json() as Promise<{
      document: { _id: string; status: string; chunks_count: number; original_name: string };
      message: string;
    }>;
  }

  static async uploadMultipleDocuments(formData: FormData) {
    const token = this.getToken();
    const userEmail = this.getUserEmail();
    const userName = this.getUserName();

    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userEmail ? { "x-user-email": userEmail } : {}),
      ...(userName ? { "x-user-name": userName } : {}),
    };

    const response = await fetch(`${API_BASE_URL}/documents/upload-batch`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Batch upload failed (${response.status})`);
    }

    return response.json() as Promise<{
      documents: Array<{ _id: string; status: string; chunks_count: number; original_name: string }>;
      total_uploaded: number;
      message: string;
    }>;
  }

  static async deleteDocument(id: string) {
    return this.request<{ success: boolean }>(`/documents/${id}`, {
      method: "DELETE",
    });
  }

  static async getDocumentChunks(id: string) {
    return this.request<{ chunks: any[] }>(`/documents/${id}/chunks`);
  }

  static async getAuditTrail() {
    return this.request<{
      records: any[];
      summary: {
        total_evaluations: number;
        avg_faithfulness: number;
        avg_context_precision: number;
        avg_answer_relevance: number;
        hallucination_free_rate: number;
      };
    }>("/evidence/audit-trail");
  }

  // Chat & Pipeline endpoints
  static async getConversations() {
    return this.request<{ conversations: any[] }>("/chat/conversations");
  }

  static async createConversation(title?: string) {
    return this.request<{ conversation: any }>("/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }

  static async deleteConversation(conversationId: string) {
    return this.request<{ success: boolean; message: string }>(`/chat/conversations/${conversationId}`, {
      method: "DELETE",
    });
  }

  static async getMessages(conversationId: string) {
    return this.request<{ messages: any[] }>(`/chat/conversations/${conversationId}/messages`);
  }

  static async sendMessage(conversationId: string, content: string, documentIds?: string[]) {
    return this.request<{ user_message: any; assistant_message: any }>(
      `/chat/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content, document_ids: documentIds }),
      },
    );
  }

  // Evidence endpoints
  static async getEvidence(messageId: string) {
    return this.request<any>(`/evidence/messages/${messageId}`);
  }

  // Analytics endpoints
  static async getAnalytics() {
    return this.request<any>("/analytics/summary");
  }

  // Settings endpoints
  static async getSettings() {
    return this.request<{ settings: any }>("/settings");
  }

  static async updateSettings(settings: any) {
    return this.request<{ settings: any }>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  // Health check
  static async checkHealth() {
    return this.request<{ status: string; backend: string; ai_service?: any }>("/health");
  }
}
