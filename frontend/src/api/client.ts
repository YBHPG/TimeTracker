import { Task, DayStatItem, DaySummary, CreateTaskPayload, UpdateTaskPayload, CreateIntervalPayload, UpdateIntervalPayload, TimeInterval } from '../types';

const API_BASE = '/api';

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
    const res = await fetch(`${API_BASE}/tasks?date=${encodeURIComponent(dateStr)}`);
    return handleResponse<Task[]>(res);
  },

  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Task>(res);
  },

  async getTask(taskId: string): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`);
    return handleResponse<Task>(res);
  },

  async updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Task>(res);
  },

  async deleteTask(taskId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  async bulkDeleteTasks(taskIds: string[]): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_ids: taskIds }),
    });
    return handleResponse<void>(res);
  },

  async startTimer(taskId: string): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/start`, {
      method: 'POST',
    });
    return handleResponse<Task>(res);
  },

  async pauseTimer(taskId: string): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/pause`, {
      method: 'POST',
    });
    return handleResponse<Task>(res);
  },

  // Intervals
  async addInterval(taskId: string, payload: CreateIntervalPayload): Promise<TimeInterval> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/intervals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TimeInterval>(res);
  },

  async updateInterval(intervalId: string, payload: UpdateIntervalPayload): Promise<TimeInterval> {
    const res = await fetch(`${API_BASE}/intervals/${intervalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TimeInterval>(res);
  },

  async deleteInterval(intervalId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/intervals/${intervalId}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Days & Calendar
  async getDaysStats(): Promise<DayStatItem[]> {
    const res = await fetch(`${API_BASE}/days`);
    return handleResponse<DayStatItem[]>(res);
  },

  async getDaySummary(dateStr: string): Promise<DaySummary> {
    const res = await fetch(`${API_BASE}/days/${dateStr}/summary`);
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
