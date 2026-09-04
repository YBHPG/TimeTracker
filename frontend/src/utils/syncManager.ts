import { api } from '../api/client';
import {
  Task,
  DayStatItem,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateIntervalPayload,
  UpdateIntervalPayload,
  TimerActionPayload,
} from '../types';

export function generateClientUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const STORAGE_TASKS_PREFIX = 'tt_tasks_';
const STORAGE_DAYS_STATS = 'tt_days_stats';
const STORAGE_SYNC_QUEUE = 'tt_sync_queue_v1';

// --- Local Storage Cache ---

export function getCachedTasks(dateStr: string): Task[] | null {
  try {
    const item = localStorage.getItem(`${STORAGE_TASKS_PREFIX}${dateStr}`);
    if (item) {
      return JSON.parse(item);
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

export function setCachedTasks(dateStr: string, tasks: Task[]): void {
  try {
    localStorage.setItem(`${STORAGE_TASKS_PREFIX}${dateStr}`, JSON.stringify(tasks));
  } catch {
    // Ignore localStorage errors
  }
}

export function getCachedDaysStats(): DayStatItem[] | null {
  try {
    const item = localStorage.getItem(STORAGE_DAYS_STATS);
    if (item) {
      return JSON.parse(item);
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

export function setCachedDaysStats(stats: DayStatItem[]): void {
  try {
    localStorage.setItem(STORAGE_DAYS_STATS, JSON.stringify(stats));
  } catch {
    // Ignore localStorage errors
  }
}

// --- Sync Queue Actions ---

export type SyncAction =
  | { type: 'CREATE_TASK'; payload: CreateTaskPayload }
  | { type: 'START_TIMER'; taskId: string; payload?: TimerActionPayload }
  | { type: 'PAUSE_TIMER'; taskId: string; payload?: TimerActionPayload }
  | { type: 'UPDATE_TASK'; taskId: string; payload: UpdateTaskPayload }
  | { type: 'DELETE_TASK'; taskId: string }
  | { type: 'BULK_DELETE_TASKS'; taskIds: string[] }
  | { type: 'ADD_INTERVAL'; taskId: string; payload: CreateIntervalPayload }
  | { type: 'UPDATE_INTERVAL'; intervalId: string; payload: UpdateIntervalPayload }
  | { type: 'DELETE_INTERVAL'; intervalId: string };

export interface QueueItem {
  id: string;
  timestamp: number;
  action: SyncAction;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
}

// Internal state
let queue: QueueItem[] = [];
let isProcessing = false;
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let isSyncing = false;
let lastSyncedAt: number | null = null;
const listeners = new Set<(state: SyncState) => void>();
const onQueueDrainedCallbacks = new Set<() => void>();

function notifyListeners() {
  const state: SyncState = {
    isOnline,
    isSyncing,
    pendingCount: queue.length,
    lastSyncedAt,
  };
  listeners.forEach((l) => l(state));
}

export function subscribeSyncState(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  // Emit initial state
  listener({
    isOnline,
    isSyncing,
    pendingCount: queue.length,
    lastSyncedAt,
  });
  return () => {
    listeners.delete(listener);
  };
}

export function onQueueDrained(callback: () => void): () => void {
  onQueueDrainedCallbacks.add(callback);
  return () => {
    onQueueDrainedCallbacks.delete(callback);
  };
}

function loadQueueFromStorage(): void {
  try {
    const data = localStorage.getItem(STORAGE_SYNC_QUEUE);
    if (data) {
      queue = JSON.parse(data);
    }
  } catch {
    queue = [];
  }
}

function saveQueueToStorage(): void {
  try {
    localStorage.setItem(STORAGE_SYNC_QUEUE, JSON.stringify(queue));
  } catch {
    // Ignore localStorage quota errors
  }
}

// Initial load
loadQueueFromStorage();

export function getPendingQueueCount(): number {
  return queue.length;
}

export function enqueueAction(action: SyncAction): void {
  const item: QueueItem = {
    id: generateClientUUID(),
    timestamp: Date.now(),
    action,
  };
  queue.push(item);
  saveQueueToStorage();
  notifyListeners();
  triggerSync();
}

// Helper to determine if an error is network related
function isNetworkError(err: any): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) return true;
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('connection refused')
  );
}

export async function triggerSync(): Promise<void> {
  if (isProcessing) return;
  if (queue.length === 0) {
    if (isSyncing) {
      isSyncing = false;
      notifyListeners();
    }
    return;
  }

  isProcessing = true;
  isSyncing = true;
  notifyListeners();

  try {
    while (queue.length > 0) {
      const current = queue[0];
      try {
        await executeAction(current.action);
        // Successfully processed, remove from queue
        queue.shift();
        saveQueueToStorage();
        isOnline = true;
        notifyListeners();
      } catch (err: any) {
        if (isNetworkError(err)) {
          // Network issue: keep in queue and pause draining until network restores
          isOnline = false;
          notifyListeners();
          break;
        }

        // If it's a 404 (e.g. item deleted or already exists), don't block the queue forever
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('404') || msg.includes('not found')) {
          console.warn('[SyncManager] Discarding stale action due to 404:', current.action);
          queue.shift();
          saveQueueToStorage();
          notifyListeners();
          continue;
        }

        // For other unexpected errors, log and keep in queue or proceed
        console.error('[SyncManager] Error executing action:', err, current.action);
        // Stop to prevent infinite failing loop
        break;
      }
    }

    if (queue.length === 0) {
      lastSyncedAt = Date.now();
      onQueueDrainedCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error('[SyncManager] onQueueDrained callback error:', e);
        }
      });
    }
  } finally {
    isProcessing = false;
    isSyncing = false;
    notifyListeners();
  }
}

async function executeAction(action: SyncAction): Promise<void> {
  switch (action.type) {
    case 'CREATE_TASK':
      await api.createTask(action.payload);
      break;
    case 'START_TIMER':
      await api.startTimer(action.taskId, action.payload);
      break;
    case 'PAUSE_TIMER':
      await api.pauseTimer(action.taskId, action.payload);
      break;
    case 'UPDATE_TASK':
      await api.updateTask(action.taskId, action.payload);
      break;
    case 'DELETE_TASK':
      await api.deleteTask(action.taskId);
      break;
    case 'BULK_DELETE_TASKS':
      await api.bulkDeleteTasks(action.taskIds);
      break;
    case 'ADD_INTERVAL':
      await api.addInterval(action.taskId, action.payload);
      break;
    case 'UPDATE_INTERVAL':
      await api.updateInterval(action.intervalId, action.payload);
      break;
    case 'DELETE_INTERVAL':
      await api.deleteInterval(action.intervalId);
      break;
  }
}

// Window Event Listeners for network detection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    notifyListeners();
    triggerSync();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    notifyListeners();
  });

  // Re-try periodically when queue is not empty (every 5 seconds)
  setInterval(() => {
    if (queue.length > 0 && navigator.onLine) {
      triggerSync();
    }
  }, 5000);

  // Sync on window focus or visibility change
  window.addEventListener('focus', () => {
    if (queue.length > 0 && navigator.onLine) {
      triggerSync();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && queue.length > 0 && navigator.onLine) {
      triggerSync();
    }
  });
}
