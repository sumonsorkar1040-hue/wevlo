/* ============================================================
   WEVLO — Core JavaScript
   API connection, Auth, Session, Utilities
   ============================================================ */

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
const GAS_URL         = 'https://script.google.com/macros/s/AKfycbxYWXccwXQuWZK0Euku_YRHd_oz-T92UKhjz5ZubyuorneoFmTWNyccEbn9oXsGpSuUmg/exec';
const BUILDER_API_URL = 'https://backend-proxy.dinalaminm.workers.dev';
const API_KEY         = 'WEVLO_SECRET_KEY_2024';

// ──────────────────────────────────────────────────────────────
// WEVLO DB  — IndexedDB wrapper (large data: projects, preview)
// localStorage quota (~5 MB) এর সমস্যা এড়াতে বড় data এখানে রাখা হয়
// ──────────────────────────────────────────────────────────────
const WevloDB = (() => {
  const DB_NAME    = 'wevloDB';
  const DB_VERSION = 1;
  const STORE      = 'kvStore';

  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(STORE);
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function get(key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function set(key, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function remove(key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  // ── Projects helpers ──────────────────────────────────────
  async function getProjects() {
    const data = await get('wevlo_projects');
    if (!data) {
      // Migrate from localStorage (one-time)
      try {
        const raw = localStorage.getItem('wevlo_projects');
        if (raw) {
          const arr = JSON.parse(raw);
          await set('wevlo_projects', arr);
          localStorage.removeItem('wevlo_projects');
          return arr;
        }
      } catch(_) {}
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

  async function setProjects(arr) {
    await set('wevlo_projects', arr);
    // localStorage এ আর রাখব না — quota এর জন্য
    try { localStorage.removeItem('wevlo_projects'); } catch(_) {}
  }

  // ── Preview helpers ───────────────────────────────────────
  async function getPreview() {
    return await get('wevlo_preview');
  }

  async function setPreview(payload) {
    await set('wevlo_preview', payload);
  }

  async function removePreview() {
    await remove('wevlo_preview');
  }

  return { get, set, remove, getProjects, setProjects, getPreview, setPreview, removePreview };
})();

// ──────────────────────────────────────────────────────────────
// SESSION MANAGER
// ──────────────────────────────────────────────────────────────
const Session = {
  save(userId, token, name, email) {
    localStorage.setItem('wevlo_logged_in', 'true');
    localStorage.setItem('wevlo_userId',    userId);
    localStorage.setItem('wevlo_token',     token);
    localStorage.setItem('wevlo_name',      name);
    localStorage.setItem('wevlo_email',     email);
  },
  isLoggedIn()    { return localStorage.getItem('wevlo_logged_in') === 'true'; },
  getUserId()     { return localStorage.getItem('wevlo_userId'); },
  getToken()      { return localStorage.getItem('wevlo_token'); },
  getName()       { return localStorage.getItem('wevlo_name') || ''; },
  getEmail()      { return localStorage.getItem('wevlo_email') || ''; },
  getWallet()     { return localStorage.getItem('wevlo_wallet') || '0'; },
  setWallet(v)    { localStorage.setItem('wevlo_wallet', v); },
  getSubActive()  { return localStorage.getItem('wevlo_sub_active') === 'true'; },
  getSubPlan()    { return localStorage.getItem('wevlo_sub_plan') || ''; },
  getSubExpires() { return parseInt(localStorage.getItem('wevlo_sub_expires') || '0'); },
  saveSubscription(active, planId, planName, expiresAt) {
    localStorage.setItem('wevlo_sub_active',    active ? 'true' : 'false');
    localStorage.setItem('wevlo_sub_plan',      planId);
    localStorage.setItem('wevlo_sub_plan_name', planName);
    localStorage.setItem('wevlo_sub_expires',   expiresAt);
  },
  logout() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('wevlo_'));
    keys.forEach(k => localStorage.removeItem(k));
  }
};

// ──────────────────────────────────────────────────────────────
// API CLIENT
// ──────────────────────────────────────────────────────────────
const Api = {

  async _post(action, body = {}) {
    try {
      // Content-Type header বাদ — GAS CORS preflight block করে
      // key বাধ্যতামূলক — GAS validateKey() চেক করে
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action, key: API_KEY, ...body })
      });
      return await res.json();
    } catch (e) {
      console.error('API POST error:', e);
      throw e;
    }
  },

  async _get(params = {}) {
    try {
      // key সব GET request এ যোগ করতে হবে
      const query = new URLSearchParams({ key: API_KEY, ...params }).toString();
      const res   = await fetch(`${GAS_URL}?${query}`);
      return await res.json();
    } catch (e) {
      console.error('API GET error:', e);
      throw e;
    }
  },

  // ── AUTH ──
  login:    (email, password)        => Api._post('login',    { email, password }),
  register: (name, email, password)  => Api._post('register', { name, email, password }),

  // ── BANNERS ──
  getBanners: () => Api._get({ action: 'getBanners' }),

  // ── TEMPLATES ──
  getTemplates:  (category = '') => Api._get({ action: 'getTemplates', category }),
  getTemplate:   (id)            => Api._get({ action: 'getTemplate',  id }),

  // ── Apps (APK / Software store) ──────────────────────────────
  getApps:    (category = '') => Api._get({ action: 'getApps', category }),
  getApp:     (id)            => Api._get({ action: 'getApp',  id }),
  getCategories: ()              => Api._get({ action: 'getCategories' }),

  // ── COMMENTS ──
  getComments: (templateId) => Api._get({ action: 'getComments', templateId }),
  addComment:  (templateId, text) => Api._post('addComment', {
    templateId, userId: Session.getUserId(),
    token: Session.getToken(), text, authorName: Session.getName()
  }),

  // ── LIKE ──
  likeTemplate: (templateId) => Api._post('likeTemplate', {
    templateId, userId: Session.getUserId(), token: Session.getToken()
  }),

  // ── WALLET ──
  getWallet: () => Api._get({
    action: 'getWallet', userId: Session.getUserId(), token: Session.getToken()
  }),
  updateWallet: (amount, trxId) => Api._post('updateWallet', {
    userId: Session.getUserId(), token: Session.getToken(), amount, trxId
  }),
  buyWithWallet: (templateId, templateName, amount) => Api._post('buyWithWallet', {
    userId: Session.getUserId(), token: Session.getToken(),
    templateId, templateName, amount
  }),
  submitPayment: (templateId, trxId, method, amount) => Api._post('submitPayment', {
    userId: Session.getUserId(), token: Session.getToken(),
    templateId, trxId, method, amount
  }),

  // ── DOWNLOAD ──
  getDownloadUrl: (templateId) => Api._get({
    action: 'getDownloadUrl', templateId,
    userId: Session.getUserId(), token: Session.getToken()
  }),
  saveDownload: (template) => Api._post('saveDownload', {
    userId: Session.getUserId(), token: Session.getToken(),
    templateId: template.id, name: template.name,
    imageUrl: template.imageUrl, filePath: template.filePath,
    fileType: template.fileType || '',
    category: template.category, price: template.price,
    description: template.description
  }),
  getUserDownloads: () => Api._get({
    action: 'getDownloads', userId: Session.getUserId(), token: Session.getToken()
  }),
  getTemplateFiles: (templateId) => Api._get({
    action: 'getTemplateFiles', templateId, userId: Session.getUserId(), token: Session.getToken()
  }),

  // ── PROFILE ──
  getProfile: () => Api._get({
    action: 'getProfile', userId: Session.getUserId(), token: Session.getToken()
  }),
  getTransactions: () => Api._get({
    action: 'getTransactions', userId: Session.getUserId(), token: Session.getToken()
  }),

  // ── LAB ──
  getLabProjects:  ()          => Api._get({ action: 'getLabProjects' }),
  getLabComments:  (projectId) => Api._get({ action: 'getLabComments', projectId }),
  getLikeStatus:   (projectId) => Api._get({
    action: 'getLikeStatus', projectId,
    userId: Session.getUserId(), token: Session.getToken()
  }),
  likeLabProject:  (projectId) => Api._post('likeLabProject', {
    projectId, userId: Session.getUserId(), token: Session.getToken()
  }),
  postLabComment:  (projectId, text) => Api._post('postLabComment', {
    projectId, userId: Session.getUserId(), token: Session.getToken(),
    text, authorName: Session.getName()
  }),
  saveLabProject:  (data) => Api._post('saveLabProject', {
    userId: Session.getUserId(), token: Session.getToken(), ...data
  }),
  incrementView:   (projectId) => Api._post('incrementView', { projectId }),

  // ── CLONE ──
  getClonedProjects: () => Api._get({
    action: 'getClonedProjects', userId: Session.getUserId(), token: Session.getToken()
  }),
  saveClonedProject: (data) => Api._post('saveClonedProject', {
    userId: Session.getUserId(), token: Session.getToken(), ...data
  }),

  // ── APP CONFIG & SUBSCRIPTION ──
  getAppConfig:          ()             => Api._get({ action: 'getAppConfig' }),
  getAdsConfig:          ()             => Api._get({ action: 'getAdsConfig' }),
  getSubscriptionPlans:  ()             => Api._get({ action: 'getSubscriptionPlans' }),
  getSubscriptionStatus: ()             => Api._get({
    action: 'getSubscriptionStatus',
    userId: Session.getUserId(), token: Session.getToken()
  }),
  activateSubscription: (planId, trxId) => Api._post('activateSubscription', {
    userId: Session.getUserId(), token: Session.getToken(), planId, trxId
  }),

  // ── FLASH SALE ──
  getFlashSaleConfig: () => Api._get({ action: 'getFlashSaleConfig' }),
  getFlashSaleItems:  () => Api._get({ action: 'getFlashSaleItems' }),

  // ── APK BUILDER (SSE streaming) ──
  /**
   * SSE-based build:
   *   onLog(line)  — প্রতিটি log line এলে callback
   *   onDone(blob) — build success এ APK blob
   *   onError(msg) — error message
   * Returns a cancel() function.
   */
  buildApkSSE: (config, iconFile, splashFile, { onLog, onDone, onError }) => {
    let cancelled    = false;
    let pollInterval = null;

    (async () => {
      try {
        // ── Step 1: /api/build/start — buildId পাও ──
        const fd = new FormData();
        config._userId    = Session.getUserId();
        config._token     = Session.getToken();
        config._subActive = Session.getSubActive();
        fd.append('config', JSON.stringify(config));
        if (iconFile)   fd.append('icon',   iconFile);
        if (splashFile) fd.append('splash', splashFile);

        const startRes = await fetch(`${BUILDER_API_URL}/api/build/start`, {
          method: 'POST',
          body: fd,
        });


        if (!startRes.ok) {
          let errMsg = 'Server error (' + startRes.status + ')';
          try {
            const rawText = await startRes.text();
            console.error('[Build /start]', rawText);
            errMsg = rawText.replace(/<[^>]+>/g,'').trim().substring(0, 300) || errMsg;
          } catch(e) {}
          if (onError && !cancelled) onError(errMsg);
          return;
        }

        let startData;
        try { startData = await startRes.json(); }
        catch(e) { if (onError && !cancelled) onError('JSON parse error: ' + e.message); return; }
        const buildId = startData.buildId;
        if (!buildId) { if (onError) onError('No buildId. Got: ' + JSON.stringify(startData)); return; }


        // ── Step 2: Polling — /api/build/status/:buildId ──
        let lastLogIndex = 0;
        let pollCount    = 0;
        const MAX_POLLS  = 240; // 8 মিনিট (2s interval)

        pollInterval = setInterval(async () => {
          if (cancelled) { clearInterval(pollInterval); return; }
          pollCount++;
          if (pollCount > MAX_POLLS) {
            clearInterval(pollInterval);
            if (onError && !cancelled) onError('Build timeout — 8 মিনিটের বেশি সময় লাগছে');
            return;
          }

          try {
            const statusRes = await fetch(
              `${BUILDER_API_URL}/api/build/status/${buildId}?from=${lastLogIndex}`,
            );

            if (!statusRes.ok) return; // transient error, retry

            const data = await statusRes.json();

            // নতুন log lines দেখাও
            if (data.logs && data.logs.length > 0) {
              data.logs.forEach(line => {
                if (onLog && !cancelled) onLog(line);
              });
              lastLogIndex += data.logs.length;
            }

            // Build শেষ হয়েছে?
            if (data.status === 'done') {
              clearInterval(pollInterval);
              if (cancelled) return;

              // ── Step 3: APK download ──
              try {
                const dlRes = await fetch(
                  `${BUILDER_API_URL}/api/build/download/${buildId}`,
                );
                if (!dlRes.ok) {
                  let errMsg = `Download error (${dlRes.status})`;
                  try { const err = await dlRes.json(); errMsg = err.error || errMsg; } catch(e) {}
                  if (onError) onError(errMsg);
                  return;
                }
                const blob = await dlRes.blob();
                if (onDone) onDone(blob);
              } catch (dlErr) {
                if (onError) onError('Download failed: ' + dlErr.message);
              }

            } else if (data.status === 'error') {
              clearInterval(pollInterval);
              if (onError && !cancelled) onError(data.error || 'Build failed');
            }

          } catch (pollErr) {
            // network glitch — continue polling
          }
        }, 2000); // প্রতি 2 সেকেন্ডে check

      } catch (err) {
        if (onError && !cancelled) onError('Network error: ' + (err.message || 'সংযোগ ব্যর্থ'));
      }
    })();

    return {
      cancel: () => {
        cancelled = true;
        if (pollInterval) clearInterval(pollInterval);
      }
    };
  },

  // ── Legacy buildApk (non-SSE, backward compat) ──

  // ── Kotlin/Java ZIP → APK (polling) ───────────────────────────────
  buildSourceZipSSE: (zipFile, appName, packageName, versionName, versionCode, subActive,
                      { onLog, onDone, onError }) => {
    let cancelled    = false;
    let pollInterval = null;

    (async () => {
      try {
        const fd = new FormData();
        fd.append('zip',         zipFile);
        fd.append('appName',     appName);
        fd.append('packageName', packageName);
        fd.append('versionName', versionName || '1.0');
        fd.append('versionCode', versionCode || '1');
        fd.append('_subActive',  subActive ? 'true' : 'false');

        const startRes = await fetch(`${BUILDER_API_URL}/api/build/source-zip`, {
          method: 'POST',
          body: fd,
        });

        if (!startRes.ok) {
          let errMsg = 'Server error (' + startRes.status + ')';
          try {
            const rawText = await startRes.text();
            errMsg = rawText.replace(/<[^>]+>/g,'').trim().substring(0, 300) || errMsg;
          } catch(e) {}
          if (onError && !cancelled) onError(errMsg);
          return;
        }

        let startData;
        try { startData = await startRes.json(); }
        catch(e) { if (onError && !cancelled) onError('JSON parse error: ' + e.message); return; }
        const buildId = startData.buildId;
        if (!buildId) { if (onError) onError('No buildId. Got: ' + JSON.stringify(startData)); return; }

        // Polling
        let lastLogIndex = 0;
        let pollCount    = 0;
        const MAX_POLLS  = 300; // 10 মিনিট

        pollInterval = setInterval(async () => {
          if (cancelled) { clearInterval(pollInterval); return; }
          pollCount++;
          if (pollCount > MAX_POLLS) {
            clearInterval(pollInterval);
            if (onError && !cancelled) onError('Build timeout (10 min)');
            return;
          }

          try {
            const statusRes = await fetch(
              `${BUILDER_API_URL}/api/build/status/${buildId}?from=${lastLogIndex}`,
            );
            if (!statusRes.ok) return;
            const data = await statusRes.json();

            if (data.logs && data.logs.length > 0) {
              data.logs.forEach(line => { if (onLog && !cancelled) onLog(line); });
              lastLogIndex += data.logs.length;
            }

            if (data.status === 'done') {
              clearInterval(pollInterval);
              if (cancelled) return;
              try {
                const dlRes = await fetch(
                  `${BUILDER_API_URL}/api/build/download/${buildId}`,
                );
                if (!dlRes.ok) {
                  let errMsg = 'Download error (' + dlRes.status + ')';
                  try { const err = await dlRes.json(); errMsg = err.error || errMsg; } catch(e) {}
                  if (onError) onError(errMsg); return;
                }
                const blob = await dlRes.blob();
                if (onDone) onDone(blob);
              } catch (dlErr) {
                if (onError) onError('Download failed: ' + dlErr.message);
              }
            } else if (data.status === 'error') {
              clearInterval(pollInterval);
              if (onError && !cancelled) onError(data.error || 'Build failed');
            }
          } catch (pollErr) {}
        }, 2000);

      } catch (err) {
        if (onError && !cancelled) onError('Network error: ' + (err.message || 'Connection failed'));
      }
    })();

    return {
      cancel: () => {
        cancelled = true;
        if (pollInterval) clearInterval(pollInterval);
      }
    };
  },

  buildApk: async (config, iconFile, splashFile) => {
    const fd = new FormData();
    config._userId    = Session.getUserId();
    config._token     = Session.getToken();
    config._subActive = Session.getSubActive();
    fd.append('config', JSON.stringify(config));
    if (iconFile)   fd.append('icon',   iconFile);
    if (splashFile) fd.append('splash', splashFile);

    // ── Timeout: 4 মিনিট (Render.com cold start handle করার জন্য) ──
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 240000);

    let res;
    try {
      res = await fetch(`${BUILDER_API_URL}/api/build`, {
        method: 'POST',
        body:   fd,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        throw new Error('Build timeout হয়েছে। Server ঘুম থেকে উঠছে, ১ মিনিট পর আবার চেষ্টা করুন।');
      }
      throw new Error('Network error: ' + (fetchErr.message || 'সংযোগ ব্যর্থ হয়েছে'));
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      let errMsg = `Server error (${res.status})`;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const err = await res.json();
          errMsg = err.error || err.message || JSON.stringify(err);
        } else {
          const txt = await res.text();
          errMsg = txt.substring(0, 400);
        }
      } catch(pe) { /* keep default */ }
      throw new Error(errMsg);
    }
    return res.blob();
  },

  // ── Kotlin/Java source build ──────────────────────────────────
  buildSourceApk: async (config) => {
    const fd = new FormData();
    config._userId    = Session.getUserId();
    config._token     = Session.getToken();
    config._subActive = Session.getSubActive();
    fd.append('config', JSON.stringify(config));

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 480000); // 8 min (compile বেশি সময় নেয়)

    let res;
    try {
      res = await fetch(`${BUILDER_API_URL}/api/build-source`, {
        method: 'POST',
        body:   fd,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        throw new Error('Build timeout। Kotlin compile বেশি সময় নেয়, একটু পর আবার চেষ্টা করুন।');
      }
      throw new Error('Network error: ' + (fetchErr.message || 'সংযোগ ব্যর্থ'));
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      let errMsg = `Server error (${res.status})`;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const err = await res.json();
          errMsg = err.error || err.message || JSON.stringify(err);
        } else {
          errMsg = (await res.text()).substring(0, 400);
        }
      } catch(pe) {}
      throw new Error(errMsg);
    }
    return res.blob();
  }
};

// ──────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ──────────────────────────────────────────────────────────────
function initToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
}

function showToast(message, type = 'default', duration = 3500) {
  initToastContainer();
  const container = document.querySelector('.toast-container');

  const iconSvg = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    default: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${iconSvg[type] || iconSvg.default}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateY(10px)';
    toast.style.transition = '.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ──────────────────────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────────────────────
const Nav = {
  go:        (page)    => window.location.href = page,
  dashboard: ()        => Nav.go('/'),
  login:     ()        => Nav.go('/login'),
  templates: ()        => Nav.go('/templates'),
  editor:    (project) => Nav.go(`/editor${project ? '?p='+encodeURIComponent(project) : ''}`),
  build:     ()        => Nav.go('/build'),
  lab:       ()        => Nav.go('/lab'),
  profile:   ()        => Nav.go('/profile'),
  wallet:    ()        => Nav.go('/wallet'),
  subscribe: ()        => Nav.go('/subscription'),
  about:     ()        => Nav.go('/about'),
};

// ──────────────────────────────────────────────────────────────
// AUTH GUARD
// ──────────────────────────────────────────────────────────────
function requireAuth() {
  if (!Session.isLoggedIn()) {
    // guest mode — redirect না করে শুধু false return করো
    // editor ও projects page guest হিসেবে ব্যবহার করা যাবে
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// SVG ICONS — reusable icon strings
// ──────────────────────────────────────────────────────────────
const Icons = {
  home:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  folder:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  code:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  bolt:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  grid:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  flask:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6m-5 0v6l-4 9a1 1 0 0 0 .9 1.4h10.2a1 1 0 0 0 .9-1.4L14 9V3"/></svg>`,
  wallet:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  star:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  user:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  info:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  search:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  menu:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  logout:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  logoMark: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="5" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"/>
    <rect x="2" y="10.5" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.8)"/>
    <rect x="2" y="16" width="20" height="3" rx="1.5" fill="#fff"/>
  </svg>`,
};

// ──────────────────────────────────────────────────────────────
// HEADER BUILDER
// ──────────────────────────────────────────────────────────────
function buildHeader(activePage = '') {
  const isLoggedIn = Session.isLoggedIn();
  const name       = Session.getName();
  const initials   = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : '?';

  const pages = [
    { key: 'home',      label: 'Home',      href: '/',                     icon: Icons.home },
    { key: 'templates', label: 'Templates', href: '/templates', icon: Icons.grid },
    { key: 'lab',       label: 'Lab',       href: '/lab',       icon: Icons.flask },
  ];

  const navLinks = pages.map(p =>
    `<a href="${p.href}" class="${activePage === p.key ? 'active' : ''}">${p.icon}${p.label}</a>`
  ).join('');

  const userMenu = isLoggedIn ? `` : `
    <a href="/login" class="btn btn-primary btn-sm">Sign In</a>`;

  return `
  <header class="header">
    <a class="header-logo" href="/">
      <div class="header-logo-icon">${Icons.logoMark}</div>
      <span style="font-size:1.15rem;font-weight:900;letter-spacing:-.03em;color:var(--text)">WEVLO</span>
    </a>
    <nav class="header-nav">${navLinks}</nav>
    <div class="header-actions">
      ${activePage === 'home' ? `
      <div style="position:relative">
        <div class="header-search" style="max-width:260px;min-width:160px">
          <span class="search-icon">${Icons.search}</span>
          <input type="text" placeholder="Search projects…" id="homeSearch"
                 oninput="if(typeof filterProjects==='function')filterProjects(this.value);onHomeSearchInput(this.value)" autocomplete="off"
                 style="border-radius:50px;padding-right:62px"/>
          <div style="position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:2px">
            <button id="homeSearchClear" onclick="clearHomeSearch()"
              style="background:none;border:none;padding:4px;cursor:pointer;color:var(--text-light);line-height:1;display:none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <button class="lab-filter-btn" id="homeFilterBtn" onclick="toggleHomeFilter()" title="Sort"
              style="width:28px;height:28px;border-radius:50%;background:transparent;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);transition:color .2s;flex-shrink:0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="13" y1="18" x2="11" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="lab-filter-dropdown" id="homeFilterDropdown" style="right:0">
          <button class="filter-option selected" id="hOpt-newest" onclick="applyHomeSort('newest',this)">
            <div class="filter-option-icon" style="background:#dbeafe">New</div> Newest
          </button>
          <button class="filter-option" id="hOpt-oldest" onclick="applyHomeSort('oldest',this)">
            <div class="filter-option-icon" style="background:#fef9ec">Old</div> Oldest
          </button>
          <button class="filter-option" id="hOpt-name" onclick="applyHomeSort('name',this)">
            <div class="filter-option-icon" style="background:#d1fae5">A–Z</div> Name A–Z
          </button>
        </div>
      </div>
      ` : ''}
      ${activePage === 'projects' ? `
      <div style="position:relative">
        <div class="header-search" style="max-width:260px;min-width:160px">
          <span class="search-icon">${Icons.search}</span>
          <input type="text" placeholder="Search projects…" id="projectsHeaderSearch"
                 oninput="if(typeof filterProjects==='function')filterProjects(this.value);onProjectsHeaderInput(this.value)" autocomplete="off"
                 style="border-radius:50px;padding-right:62px"/>
          <div style="position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:2px">
            <button id="projectsSearchClear" onclick="clearProjectsHeaderSearch()"
              style="background:none;border:none;padding:4px;cursor:pointer;color:var(--text-light);line-height:1;display:none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <button class="lab-filter-btn" id="projectsFilterBtn" onclick="toggleProjectsFilter()" title="Sort"
              style="width:28px;height:28px;border-radius:50%;background:transparent;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);transition:color .2s;flex-shrink:0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="13" y1="18" x2="11" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="lab-filter-dropdown" id="projectsFilterDropdown" style="right:0">
          <button class="filter-option selected" id="pOpt-newest" onclick="applyProjectsSort('newest',this)">
            <div class="filter-option-icon" style="background:#dbeafe">New</div> Newest
          </button>
          <button class="filter-option" id="pOpt-oldest" onclick="applyProjectsSort('oldest',this)">
            <div class="filter-option-icon" style="background:#fef9ec">Old</div> Oldest
          </button>
          <button class="filter-option" id="pOpt-name" onclick="applyProjectsSort('name',this)">
            <div class="filter-option-icon" style="background:#d1fae5">A–Z</div> Name A–Z
          </button>
        </div>
      </div>
      ` : ''}
      ${activePage === 'lab' ? `
      <div style="position:relative">
        <div class="header-search" style="max-width:260px;min-width:160px">
          <span class="search-icon">${Icons.search}</span>
          <input type="text" placeholder="Search projects..." id="labSearch"
                 oninput="if(typeof filterLab==='function')filterLab(this.value)" autocomplete="off"
                 style="border-radius:50px;padding-right:62px"/>
          <div style="position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:2px">
            <button id="labSearchClear" onclick="if(typeof clearLabSearch==='function')clearLabSearch()"
              style="background:none;border:none;padding:4px;cursor:pointer;color:var(--text-light);line-height:1;display:none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <button class="lab-filter-btn" id="labFilterBtn" onclick="if(typeof toggleFilterDropdown==='function')toggleFilterDropdown()" title="Filter"
              style="width:28px;height:28px;border-radius:50%;background:transparent;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);transition:color .2s;flex-shrink:0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="13" y1="18" x2="11" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="lab-filter-dropdown" id="labFilterDropdown" style="right:0">
          <button class="filter-option selected" id="fOpt-newest" onclick="if(typeof selectFilter==='function')selectFilter('newest',this)">
            <div class="filter-option-icon" style="background:#ede9fe">New</div> Newest
          </button>
          <button class="filter-option" id="fOpt-views" onclick="if(typeof selectFilter==='function')selectFilter('views',this)">
            <div class="filter-option-icon" style="background:#dbeafe">Views</div> Most Viewed
          </button>
          <button class="filter-option" id="fOpt-free" onclick="if(typeof selectFilter==='function')selectFilter('free',this)">
            <div class="filter-option-icon" style="background:#d1fae5">Free</div> Free Only
          </button>
          <button class="filter-option" id="fOpt-paid" onclick="if(typeof selectFilter==='function')selectFilter('paid',this)">
            <div class="filter-option-icon" style="background:#fef9ec">Paid</div> Paid Only
          </button>
        </div>
      </div>
      ` : ''}
      ${userMenu}
    </div>
    <!-- menuToggle hidden — More button handles this -->
  </header>`;
}

// ──────────────────────────────────────────────────────────────
// SIDEBAR BUILDER
// ──────────────────────────────────────────────────────────────
function buildSidebar(activePage = '') {
  const items = [
    { key: 'home',      icon: Icons.home,   label: 'Dashboard',   href: '/' },
    { key: 'projects',  icon: Icons.folder, label: 'My Projects',  href: '/' },
    { key: 'editor',    icon: Icons.code,   label: 'Code Editor',  href: '/editor' },
    { key: 'build',     icon: Icons.bolt,   label: 'Build APK',    href: '/build' },
    null,
    { key: 'templates', icon: Icons.grid,   label: 'Templates',    href: '/templates' },
    { key: 'lab',       icon: Icons.flask,  label: 'Lab',          href: '/lab' },
    null,
    { key: 'wallet',    icon: Icons.wallet, label: 'Wallet',       href: '/wallet' },
    { key: 'subscribe', icon: Icons.star,   label: 'Subscription', href: '/subscription' },
    { key: 'profile',   icon: Icons.user,   label: 'Profile',      href: '/profile' },
    null,
    { key: 'about',     icon: Icons.info,   label: 'About',        href: '/about' },
  ];

  const isLoggedIn = Session.isLoggedIn();
  const name       = Session.getName();
  const email      = Session.getEmail();
  const initials   = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : '?';

  const userHeader = isLoggedIn ? `
    <div class="sidebar-user-header">
      <div class="sidebar-user-avatar">${initials}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${name}</div>
        <div class="sidebar-user-email">${email}</div>
      </div>
    </div>` : `
    <div style="padding:12px 10px">
      <a href="/login" class="btn btn-primary btn-full" style="font-size:.8rem;padding:9px">Sign In</a>
    </div>`;

  return `<aside class="sidebar" id="sidebar">
    ${userHeader}
    <div class="sidebar-divider"></div>` +
    items.map(item => {
      if (!item) return '<div class="sidebar-divider"></div>';
      return `<a class="sidebar-item ${activePage === item.key ? 'active' : ''}" href="${item.href}">
        ${item.icon}${item.label}
      </a>`;
    }).join('') +
    `<div class="sidebar-divider"></div>
    ${isLoggedIn ? `<a class="sidebar-item" href="#" onclick="doLogout();return false;" style="color:var(--danger)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Logout
    </a>` : ''}
    </aside>`;
}

// ──────────────────────────────────────────────────────────────
// MOBILE BOTTOM NAV BUILDER
// ──────────────────────────────────────────────────────────────
function buildMobileNav(activePage = '') {
  const mIcons = {
    home:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    templates: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    lab:       `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6m-5 0v6l-4 9a1 1 0 0 0 .9 1.4h10.2a1 1 0 0 0 .9-1.4L14 9V3"/></svg>`,
    profile:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  };

  const items = [
    { key: 'home',      label: 'Home',      href: '/',                     icon: mIcons.home },
    { key: 'templates', label: 'Store', href: '/templates', icon: mIcons.templates },
    { key: 'lab',       label: 'Lab',       href: '/lab',       icon: mIcons.lab },
  ];

  const moreIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;

  const drawerHtml = Session.isLoggedIn() ? (() => {
    const n = Session.getName(); const e = Session.getEmail();
    const ini = n ? n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : '?';
    return `
    <div class="more-drawer-overlay" id="moreDrawerOverlay" onclick="closeMoreDrawer()"></div>
    <div class="more-drawer" id="moreDrawer">
      <div class="more-drawer-user">
        <div class="more-drawer-avatar">${ini}</div>
        <div class="more-drawer-user-info">
          <div class="more-drawer-name">${n}</div>
          <div class="more-drawer-email">${e}</div>
        </div>
      </div>
      <div class="more-drawer-items">
        <a class="more-drawer-item" href="/profile">
          <div class="more-drawer-item-icon blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="more-drawer-item-text">
            <span class="more-drawer-item-label">Profile</span>
            <span class="more-drawer-item-sub">Account settings</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
        <a class="more-drawer-item" href="/wallet">
          <div class="more-drawer-item-icon yellow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div class="more-drawer-item-text">
            <span class="more-drawer-item-label">Wallet</span>
            <span class="more-drawer-item-sub">Balance & transactions</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
        <a class="more-drawer-item" href="/subscription">
          <div class="more-drawer-item-icon purple">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div class="more-drawer-item-text">
            <span class="more-drawer-item-label">Subscription</span>
            <span class="more-drawer-item-sub">Plans & upgrades</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
        <a class="more-drawer-item" href="/build">
          <div class="more-drawer-item-icon blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div class="more-drawer-item-text">
            <span class="more-drawer-item-label">Build APK</span>
            <span class="more-drawer-item-sub">Export Android app</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
        <a class="more-drawer-item" href="/editor">
          <div class="more-drawer-item-icon green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </div>
          <div class="more-drawer-item-text">
            <span class="more-drawer-item-label">Code Editor</span>
            <span class="more-drawer-item-sub">HTML / CSS / JS</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>
      <div class="more-drawer-footer">
        <button class="more-drawer-logout" onclick="doLogout()">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </div>
    </div>`;
  })() : '';

  return `<nav class="mobile-nav">
    ${items.map(i => `
      <a class="mobile-nav-item ${activePage === i.key ? 'active' : ''}" href="${i.href}">
        ${i.icon}
        ${i.label}
      </a>`).join('')}
    <button class="mobile-nav-item" onclick="openMoreDrawer()">
      ${moreIcon}
      More
    </button>
  </nav>
  ${drawerHtml}`;
}

// ──────────────────────────────────────────────────────────────
// MORE DRAWER
// ──────────────────────────────────────────────────────────────
function openMoreDrawer() {
  const drawer  = document.getElementById('moreDrawer');
  const overlay = document.getElementById('moreDrawerOverlay');
  if (!drawer) return;
  overlay?.classList.add('open');
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMoreDrawer() {
  const drawer  = document.getElementById('moreDrawer');
  const overlay = document.getElementById('moreDrawerOverlay');
  drawer?.classList.remove('open');
  overlay?.classList.remove('open');
  document.body.style.overflow = '';
}
// ESC key ও swipe দিয়ে বন্ধ
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMoreDrawer(); });

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function toggleAvatarMenu() {
  document.getElementById('avatarMenu')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#avatarBtn'))
    document.getElementById('avatarMenu')?.classList.remove('open');
});

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar?.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('visible', sidebar?.classList.contains('open'));
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('visible');
}

function doLogout() {
  Session.logout();
  showToast('Logged out successfully', 'success');
  setTimeout(() => Nav.login(), 800);
}

function searchGlobal(query) {
  if (query.trim())
    window.location.href = `/templates?search=${encodeURIComponent(query)}`;
}

// ── Global Search (Header) ──────────────────────────────────
function openGlobalSearch() {
  const wrap = document.getElementById('globalSearchWrap');
  if (wrap) wrap.classList.add('focused');
  onGlobalSearchInput(document.getElementById('globalSearchInput')?.value || '');
}

async function onGlobalSearchInput(val) {
  const clearBtn = document.getElementById('globalSearchClear');
  if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
  const drop = document.getElementById('globalSearchDropdown');
  const res  = document.getElementById('globalSearchResults');
  if (!drop || !res) return;

  const allProjects = await WevloDB.getProjects();

  if (!val.trim()) {
    // Show quick actions when empty
    const projects = allProjects.slice(0,4);
    res.innerHTML = `
      <div class="gs-section-label">Quick Actions</div>
      <div class="gs-item" onclick="openNewProjectModal?.();closeGlobalSearch()">
        <span class="gs-icon gs-icon-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
        <span>New Project</span>
      </div>
      <div class="gs-item" onclick="Nav.build?.();closeGlobalSearch()">
        <span class="gs-icon gs-icon-green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
        <span>Build APK</span>
      </div>
      <div class="gs-item" onclick="Nav.templates?.();closeGlobalSearch()">
        <span class="gs-icon gs-icon-purple"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
        <span>Browse Templates</span>
      </div>
      ${projects.length ? `
      <div class="gs-section-label" style="margin-top:8px">Recent Projects</div>
      ${projects.map(p => `
        <div class="gs-item" onclick="Nav.editor?.('${p.id}');closeGlobalSearch()">
          <span class="gs-icon" style="background:#f1f5f9"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></span>
          <span>${p.name}</span>
          <span class="gs-badge">${p.type || 'HTML'}</span>
        </div>`).join('')}` : ''}`;
    drop.classList.add('open');
    return;
  }

  const q = val.toLowerCase();
  const projects = allProjects.filter(p => p.name.toLowerCase().includes(q)).slice(0,5);

  const pages = [
    { label:'Dashboard', href:'/', icon:'home', color:'#dbeafe' },
    { label:'My Projects', href:'/projects', icon:'folder', color:'#dbeafe' },
    { label:'Build APK', href:'/build', icon:'bolt', color:'#d1fae5' },
    { label:'Templates', href:'/templates', icon:'grid', color:'#ede9fe' },
    { label:'Lab', href:'/lab', icon:'flask', color:'#fef9ec' },
    { label:'Wallet', href:'/wallet', icon:'wallet', color:'#fef3c7' },
    { label:'Subscription', href:'/subscription', icon:'star', color:'#ede9fe' },
    { label:'Profile', href:'/profile', icon:'user', color:'#f0fdf4' },
  ].filter(p => p.label.toLowerCase().includes(q));

  let html = '';
  if (projects.length) {
    html += `<div class="gs-section-label">Projects</div>`;
    html += projects.map(p => `
      <div class="gs-item" onclick="Nav.editor?.('${p.id}');closeGlobalSearch()">
        <span class="gs-icon" style="background:#f1f5f9"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></span>
        <span>${p.name.replace(new RegExp(val,'gi'), m => '<mark>'+m+'</mark>')}</span>
        <span class="gs-badge">${p.type||'HTML'}</span>
      </div>`).join('');
  }
  if (pages.length) {
    html += `<div class="gs-section-label">Pages</div>`;
    html += pages.map(p => `
      <div class="gs-item" onclick="window.location.href='${p.href}';closeGlobalSearch()">
        <span class="gs-icon" style="background:${p.color}">→</span>
        <span>${p.label}</span>
      </div>`).join('');
  }
  if (!html) {
    html = `<div class="gs-empty">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>No results for "<strong>${val}</strong>"</span>
      <small onclick="searchGlobal('${val}');closeGlobalSearch()" style="color:var(--primary);cursor:pointer;margin-top:4px">Search in Templates →</small>
    </div>`;
  }
  res.innerHTML = html;
  drop.classList.add('open');
}

function onGlobalSearchKey(e) {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (val) { searchGlobal(val); closeGlobalSearch(); }
  }
  if (e.key === 'Escape') closeGlobalSearch();
}

function clearGlobalSearch() {
  const inp = document.getElementById('globalSearchInput');
  if (inp) { inp.value = ''; inp.focus(); }
  document.getElementById('globalSearchClear').style.display = 'none';
  document.getElementById('globalSearchDropdown')?.classList.remove('open');
}

function closeGlobalSearch() {
  document.getElementById('globalSearchWrap')?.classList.remove('focused');
  document.getElementById('globalSearchDropdown')?.classList.remove('open');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('#globalSearchWrap')) closeGlobalSearch();
});

function formatPrice(price) {
  if (!price || price === '0' || price === 'Free') return 'Free';
  return '৳' + price;
}

function timeAgo(timestamp) {
  const diff  = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'just now';
}

function imgFallback(el, fallback = 'https://placehold.co/200x200/e2e8f0/94a3b8?text=W') {
  el.onerror = null;
  el.src     = fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// মোবাইলে menu toggle দেখানো / লুকানো
function _updateMenuToggle() {
  const toggle = document.getElementById('menuToggle');
  if (toggle) toggle.style.display = window.innerWidth <= 900 ? 'flex' : 'none';
}
window.addEventListener('resize', _updateMenuToggle);
window.addEventListener('DOMContentLoaded', _updateMenuToggle);
