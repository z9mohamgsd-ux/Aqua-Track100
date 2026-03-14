import type { SensorReading, DeviceWithLocation, Alert, Ticket, TicketDetail, UserRecord } from '@/types';

const API_BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('aquatrack_token');
}

function authHeaders(token?: string | null): Record<string, string> {
  const t = token ?? getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// --- Ticket API ---
export const ticketApi = {
  async list(token: string, archived = false): Promise<Ticket[]> {
    const res = await fetch(`${API_BASE_URL}/tickets?archived=${archived}`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  async get(token: string, id: string): Promise<TicketDetail> {
    const res = await fetch(`${API_BASE_URL}/tickets/${id}`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  async create(token: string, subject: string, description: string): Promise<Ticket> {
    const res = await fetch(`${API_BASE_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ subject, description }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  async sendMessage(token: string, id: string, message: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tickets/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
  async proposeClose(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tickets/${id}/propose-close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
  async approveClose(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tickets/${id}/approve-close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
  async rejectClose(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tickets/${id}/reject-close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
  async escalate(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tickets/${id}/escalate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
  async archive(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tickets/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
  async delete(token: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tickets/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
};

// --- User management API (Owner only) ---
export const userApi = {
  async list(token: string): Promise<UserRecord[]> {
    const res = await fetch(`${API_BASE_URL}/users`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  async setStatus(token: string, id: number, status: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
  async setRole(token: string, id: number, role: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
};

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchWithErrorHandling<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async getLatestData(): Promise<{ success: boolean; data: DeviceWithLocation[] }> {
    return this.fetchWithErrorHandling('/sensor-data/latest');
  }

  async getDeviceHistory(
    deviceId: string,
    hours: number = 24,
    limit: number = 100
  ): Promise<{ success: boolean; data: SensorReading[]; count: number }> {
    return this.fetchWithErrorHandling(
      `/sensor-data/history/${deviceId}?hours=${hours}&limit=${limit}`
    );
  }

  async getAllDevices(): Promise<{ success: boolean; data: DeviceWithLocation[]; count: number }> {
    return this.fetchWithErrorHandling('/devices');
  }

  async getDeviceDetails(deviceId: string): Promise<{ success: boolean; data: DeviceWithLocation }> {
    return this.fetchWithErrorHandling(`/devices/${deviceId}`);
  }

  async registerDevice(
    name: string,
    deviceId: string
  ): Promise<{ success: boolean; message: string; data: DeviceWithLocation }> {
    return this.fetchWithErrorHandling('/devices', {
      method: 'POST',
      body: JSON.stringify({ name, deviceId }),
    });
  }

  async deleteDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
    return this.fetchWithErrorHandling(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  async getActiveAlerts(): Promise<{ success: boolean; data: Alert[]; count: number }> {
    return this.fetchWithErrorHandling('/alerts');
  }

  async clearAlert(alertId: string): Promise<{ success: boolean; message: string }> {
    return this.fetchWithErrorHandling(`/alerts/${alertId}`, {
      method: 'DELETE',
    });
  }

  async sendSensorData(data: {
    deviceId: string;
    ph: number;
    temperature: number;
    turbidity: number;
    conductivity: number;
    latitude?: number;
    longitude?: number;
  }): Promise<{ success: boolean; message: string; data: { deviceId: string; timestamp: Date; alerts_generated: number } }> {
    return this.fetchWithErrorHandling('/sensor-data', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`);
    return await response.json();
  }
}

export const apiService = new ApiService();
export default apiService;
