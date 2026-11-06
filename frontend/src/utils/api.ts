const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

/**
 * Custom API Error wrapping backend payloads.
 */
export class ApiError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Standardized HTTP API Client for JARVIS
 */
export const api = {
  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');
    const url = isAbsolute ? endpoint : `${API_BASE}${endpoint}`;
    
    // Default headers
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Attempt to load token from localStorage if cookie isn't set, as fallback
    if (typeof window !== 'undefined') {
      const localToken = localStorage.getItem('jarvis_token');
      if (localToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${localToken}`);
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include' // Always send cookies (JWT token) to backend
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errMsg = `Request failed with status ${response.status}`;
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch {
          // Keep default if JSON reading fails
        }
        throw new ApiError(errMsg, response.status);
      }

      // Check if response is event stream or file
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('text/event-stream')) {
        return response as any; // Return raw response for SSE
      }

      // Read JSON
      const json = await response.json();
      return json as T;

    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      // Handle connection error / offline
      throw new ApiError(
        'Unable to connect to JARVIS backend. Please ensure the server is running.',
        503
      );
    }
  },

  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  },

  async post<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  },

  async put<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  },

  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
};
