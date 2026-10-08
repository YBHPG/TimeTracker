import { Task, DayStatItem, DaySummary, CreateTaskPayload, UpdateTaskPayload, CreateIntervalPayload, UpdateIntervalPayload, TimeInterval, TimerActionPayload } from '../types';

const API_BASE = '/api';

/**
 * Thrown when the reverse proxy (Authelia forward-auth) challenges the request.
 * The browser is already being redirected to the login portal, so callers should
 * not surface this as a regular error.
 */
export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthRequiredError';
  }
}

let authRedirecting = false;

/**
 * Force a real top-level navigation so the reverse proxy can issue the Authelia
 * challenge. A plain in-page fetch can never show the login page.
 */
function onAuthRequired(): void {
  if (authRedirecting) return;
  authRedirecting = true;
  window.location.reload();
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, redirect: 'manual' });
  // `redirect: 'manual'` turns an Authelia redirect into a readable opaqueredirect
  // (status 0) instead of a CORS "Failed to fetch".
  if (res.type === 'opaqueredirect' || res.status === 0 || res.status === 401) {
    onAuthRequired();
    throw new AuthRequiredError();
  }
  return res;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = 'Unknown error';
    try {
      const data = await res.json();
      errorDetail = data.detail || JSON.stringify(data);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(errorDetail || `HTTP error ${res.status}`);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json();
}

export const api = {
  // Tasks
  async getTasks(dateStr: string): Promise<Task[]> {
    const res = await request(`/tasks?date=${encodeURIComponent(dateStr)}`);
    return handleResponse<Task[]>(res);
  },

  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const res = await request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Task>(res);
  },

  async getTask(taskId: string): Promise<Task> {
    const res = await request(`/tasks/${taskId}`);
    return handleResponse<Task>(res);
  },

  async updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
    const res = await request(`/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Task>(res);
  },

  async deleteTask(taskId: string): Promise<void> {
    const res = await request(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  async bulkDeleteTasks(taskIds: string[]): Promise<void> {
    const res = await request('/tasks/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_ids: taskIds }),
    });
    return handleResponse<void>(res);
  },

  async startTimer(taskId: string, payload?: TimerActionPayload): Promise<Task> {
    const res = await request(`/tasks/${taskId}/start`, {
      method: 'POST',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return handleResponse<Task>(res);
  },

  async pauseTimer(taskId: string, payload?: TimerActionPayload): Promise<Task> {
    const res = await request(`/tasks/${taskId}/pause`, {
      method: 'POST',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return handleResponse<Task>(res);
  },

  // Intervals
  async addInterval(taskId: string, payload: CreateIntervalPayload): Promise<TimeInterval> {
    const res = await request(`/tasks/${taskId}/intervals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TimeInterval>(res);
  },

  async updateInterval(intervalId: string, payload: UpdateIntervalPayload): Promise<TimeInterval> {
    const res = await request(`/intervals/${intervalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TimeInterval>(res);
  },

  async deleteInterval(intervalId: string): Promise<void> {
    const res = await request(`/intervals/${intervalId}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Days & Calendar
  async getDaysStats(): Promise<DayStatItem[]> {
    const res = await request('/days');
    return handleResponse<DayStatItem[]>(res);
  },

  async getDaySummary(dateStr: string): Promise<DaySummary> {
    const res = await request(`/days/${dateStr}/summary`);
    return handleResponse<DaySummary>(res);
  },

  // CSV Export URL
  getExportCsvUrl(dateFrom?: string, dateTo?: string): string {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString();
    return `${API_BASE}/export/csv${qs ? `?${qs}` : ''}`;
  }
};
