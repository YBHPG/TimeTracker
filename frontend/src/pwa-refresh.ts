const PROBE_URL = '/api/health';
const CHECK_MS = 30 * 60 * 1000;
// Keep the session banner from flapping on transient failures.
const SESSION_MIN_GAP_MS = 30 * 1000;

let reg: ServiceWorkerRegistration | null = null;
let started = false;
let lastSessionNotify = 0;

type Handlers = { onUpdate: () => void; onSession: () => void; onOk: () => void };
let h: Handlers = { onUpdate: () => {}, onSession: () => {}, onOk: () => {} };

export function setHandlers(next: Handlers) {
  h = next;
}

export function initPwaRefresh() {
  if (started) return;
  started = true;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((r) => {
        reg = r;
        r.addEventListener('updatefound', () => {
          const nw = r.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) h.onUpdate();
          });
        });
        if (r.waiting) h.onUpdate();
        r.update().catch(() => {});
      })
      .catch(() => {});
  }

  probeSession();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      probeSession();
      checkUpdates();
    }
  });
  setInterval(() => {
    if (!document.hidden) {
      checkUpdates();
      probeSession();
    }
  }, CHECK_MS);
}

function checkUpdates() {
  if (reg) reg.update().catch(() => {});
}

export async function applyUpdate() {
  try {
    if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    // Ignore: not all browsers expose a waiting worker.
  }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    // Ignore: Cache Storage may be unavailable.
  }
  location.reload();
}

export function probeSession() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  fetch(PROBE_URL, { redirect: 'manual', cache: 'no-store', signal: ctl.signal })
    .then((r) => {
      // A redirect to the Authelia portal comes back as an opaque redirect (status 0).
      if (r.type === 'opaqueredirect' || r.status === 0 || r.status === 401) {
        notifySessionExpired();
      } else {
        lastSessionNotify = 0;
        h.onOk();
      }
    })
    .catch(() => {
      // No network at all — stay quiet, the app is expected to work offline.
    })
    .finally(() => clearTimeout(timer));
}

export function notifySessionExpired() {
  const now = Date.now();
  if (now - lastSessionNotify < SESSION_MIN_GAP_MS) return;
  lastSessionNotify = now;
  h.onSession();
}

export function goLogin() {
  // Full navigation: the proxy sees the dead session and redirects to the portal,
  // which then returns to the same screen.
  location.replace(location.pathname + location.search);
}
