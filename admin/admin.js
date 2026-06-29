/* ============================================================
   WEVLO — Admin Panel JavaScript
   Full control over user panel A-Z
   Cloudflare Pages compatible (static, no server-side)
   ============================================================ */

// ── Admin Config ────────────────────────────────────────────
const ADMIN_CREDENTIALS = {
  email:    localStorage.getItem('wevlo_admin_email')    || 'admin@wevlo.com',
  password: localStorage.getItem('wevlo_admin_password') || 'Admin@2024'
};

const GAS_URL_ADMIN   = localStorage.getItem('admin_gas_url')     || 'https://script.google.com/macros/s/AKfycbxYWXccwXQuWZK0Euku_YRHd_oz-T92UKhjz5ZubyuorneoFmTWNyccEbn9oXsGpSuUmg/exec';
const ADMIN_API_KEY   = localStorage.getItem('admin_api_key')     || 'WEVLO_SECRET_KEY_2024';
const BUILDER_URL_ADM = localStorage.getItem('admin_builder_url') || 'https://backend-proxy.dinalaminm.workers.dev';

// ── State ─────────────────────────────────────────────────
let allUsers        = [];
let allWalletReqs   = [];
let allTemplates    = [];
let allLabProjects  = [];
let allApps         = [];
let allPlans        = [];
let allBanners      = [];
let currentWalletTab = 'pending';
let currentPage      = 'dashboard';
let pnHistory        = [];

// ── API Helper ────────────────────────────────────────────
async function adminPost(action, body = {}) {
  try {
    const res = await fetch(GAS_URL_ADMIN, {
      method: 'POST',
      body: JSON.stringify({ action, key: ADMIN_API_KEY, _admin: true, ...body })
    });
    return await res.json();
  } catch(e) {
    console.error('Admin API POST error:', e);
    throw e;
  }
}

async function adminGet(params = {}) {
  try {
    const q = new URLSearchParams({ key: ADMIN_API_KEY, _admin: true, ...params }).toString();
    const res = await fetch(`${GAS_URL_ADMIN}?${q}`);
    return await res.json();
  } catch(e) {
    console.error('Admin API GET error:', e);
    throw e;
  }
}

// ── Auth ──────────────────────────────────────────────────
function doAdminLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const err   = document.getElementById('loginErr');
  const btn   = document.getElementById('loginBtnTxt');

  err.style.display = 'none';
  if (!email || !pass) { showLoginErr('Please enter email and password.'); return; }

  const stored_email = localStorage.getItem('wevlo_admin_email') || 'admin@wevlo.com';
  const stored_pass  = localStorage.getItem('wevlo_admin_password') || 'Admin@2024';

  btn.textContent = 'Signing in...';
  setTimeout(() => {
    if (email === stored_email && pass === stored_pass) {
      localStorage.setItem('wevlo_admin_logged', 'true');
      localStorage.setItem('wevlo_admin_email_session', email);
      document.getElementById('loginWrap').style.display = 'none';
      document.getElementById('adminNameSidebar').textContent = 'Admin';
      document.getElementById('adminAvatarSidebar').textContent = 'AD';
      document.getElementById('settAdminEmail').value = email;
      initDashboard();
      showToast('Welcome back, Admin!', 'success');
    } else {
      showLoginErr('Invalid email or password.');
      btn.textContent = 'Sign In to Admin Panel';
    }
  }, 600);
}

function showLoginErr(msg) {
  const err = document.getElementById('loginErr');
  err.textContent = msg;
  err.style.display = 'block';
  document.getElementById('loginBtnTxt').textContent = 'Sign In to Admin Panel';
}

function doAdminLogout() {
  localStorage.removeItem('wevlo_admin_logged');
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value = '';
}

function checkAdminAuth() {
  if (localStorage.getItem('wevlo_admin_logged') !== 'true') {
    document.getElementById('loginWrap').style.display = 'flex';
  } else {
    const email = localStorage.getItem('wevlo_admin_email_session') || 'admin@wevlo.com';
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('settAdminEmail').value = email;
    initDashboard();
  }
}

// ── Navigation ────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:       'Dashboard',
  users:           'All Users',
  subscriptions:   'Subscriptions',
  wallet_requests: 'Wallet Requests',
  transactions:    'Transactions',
  templates:       'Templates',
  banners:         'Banners',
  lab_projects:    'Lab Projects',
  apps:            'APK / Apps',
  sub_plans:       'Subscription Plans',
  app_config:      'App Config',
  flash_sale:      'Flash Sale',
  notifications:   'Push Notifications',
  settings:        'Settings',
};

function showPage(pageId, navEl) {
  // Hide all pages
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  if (navEl) navEl.classList.add('active');

  const title = PAGE_TITLES[pageId] || pageId;
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarBreadcrumb').textContent = title;
  currentPage = pageId;

  closeMobileSidebar();
  loadPage(pageId);
}

function loadPage(pageId) {
  switch(pageId) {
    case 'dashboard':       initDashboard();       break;
    case 'users':           loadUsers();            break;
    case 'subscriptions':   loadSubscriptions();   break;
    case 'wallet_requests': loadWalletRequests();  break;
    case 'transactions':    loadTransactions();    break;
    case 'templates':       loadTemplates();       break;
    case 'banners':         loadBanners();         break;
    case 'lab_projects':    loadLabProjects();     break;
    case 'apps':            loadApps();            break;
    case 'sub_plans':       loadPlans();           break;
    case 'app_config':      loadAppConfig();       break;
    case 'flash_sale':      loadFlashSale();       break;
    case 'notifications':   loadNotifStats();      break;
    case 'settings':        loadSettings();        break;
  }
}

function refreshCurrentPage() {
  loadPage(currentPage);
  showToast('Refreshed!', 'info');
}

// ── Mobile Sidebar ─────────────────────────────────────────
function toggleMobileSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeMobileSidebar() {
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t   = document.getElementById('adminToast');
  const m   = document.getElementById('adminToastMsg');
  const ico = document.getElementById('adminToastIcon');

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  t.className = `admin-notif-toast ${type}`;
  ico.innerHTML = icons[type] || icons.info;
  m.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Modal ─────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── DASHBOARD ─────────────────────────────────────────────
async function initDashboard() {
  // Load stats
  try {
    const [users, subs, wallet, trx] = await Promise.allSettled([
      adminGet({ action: 'getAllUsers' }),
      adminGet({ action: 'getAllSubscriptions' }),
      adminGet({ action: 'getAllWalletRequests' }),
      adminGet({ action: 'getAllTransactions' }),
    ]);

    const userList = users.value?.data || users.value?.users || [];
    const subList  = subs.value?.data  || subs.value?.subscriptions || [];
    const walList  = wallet.value?.data || wallet.value?.requests || [];
    const trxList  = trx.value?.data   || trx.value?.transactions || [];

    allUsers = userList;
    document.getElementById('navUserCount').textContent = userList.length;

    const pending = walList.filter(w => w.status === 'pending' || !w.status);
    document.getElementById('navPendingCount').textContent = pending.length;
    if (pending.length > 0) document.getElementById('notifDot').style.display = 'block';

    document.getElementById('dTotalUsers').textContent  = userList.length;
    document.getElementById('dActiveSubs').textContent  = subList.filter(s => s.active).length;
    document.getElementById('dPending').textContent     = pending.length;

    const revenue = trxList.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    document.getElementById('dRevenue').textContent = '৳' + revenue.toFixed(0);

    // Recent users
    renderDashRecentUsers(userList.slice(-5).reverse());
    // Pending payments
    renderDashPendingPay(pending.slice(0, 5));
    // Activity
    renderDashActivity(trxList.slice(-8).reverse());

  } catch(e) {
    // Fallback with mock data for UI preview
    document.getElementById('dTotalUsers').textContent  = '—';
    document.getElementById('dActiveSubs').textContent  = '—';
    document.getElementById('dPending').textContent     = '—';
    document.getElementById('dRevenue').textContent     = '—';
    renderDashRecentUsers([]);
    renderDashPendingPay([]);
    renderDashActivity([]);
  }
}

function renderDashRecentUsers(users) {
  const el = document.getElementById('dashRecentUsers');
  if (!users.length) {
    el.innerHTML = emptyState('No users found', 'Users will appear here when they register.');
    return;
  }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>User</th><th>Email</th><th>Joined</th><th>Status</th></tr></thead>
    <tbody>${users.map(u => `
      <tr>
        <td><div class="user-row-info"><div class="user-mini-avatar">${initials(u.name)}</div><div class="user-mini-name">${esc(u.name || 'Unknown')}</div></div></td>
        <td style="color:var(--text-muted);font-size:.78rem">${esc(u.email || '')}</td>
        <td style="color:var(--text-muted);font-size:.75rem">${fmtDate(u.createdAt || u.joinedAt)}</td>
        <td>${u.subActive ? '<span class="badge badge-purple">Pro</span>' : '<span class="badge badge-gray">Free</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderDashPendingPay(reqs) {
  const el = document.getElementById('dashPendingPay');
  if (!reqs.length) {
    el.innerHTML = emptyState('No pending payments', 'All clear! No pending wallet requests.');
    return;
  }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Action</th></tr></thead>
    <tbody>${reqs.map(r => `
      <tr>
        <td><div class="user-row-info"><div class="user-mini-avatar">${initials(r.userName || r.userId)}</div><div class="user-mini-name">${esc(r.userName||r.userId||'User')}</div></div></td>
        <td style="font-weight:700;color:var(--warning)">৳${r.amount}</td>
        <td><span class="badge badge-blue">${esc(r.method||'bkash')}</span></td>
        <td style="display:flex;gap:5px">
          <button class="btn-xs btn-xs-success" onclick="approveWallet('${r.id||r.trxId}','${r.userId}',${r.amount})">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Approve
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderDashActivity(trxList) {
  const el = document.getElementById('dashActivity');
  if (!trxList.length) {
    el.innerHTML = emptyState('No recent activity', 'Activity will appear when users transact.');
    return;
  }
  const icons = {
    recharge:     { cls: 'green',  svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>` },
    purchase:     { cls: 'blue',   svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>` },
    subscription: { cls: 'purple', svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` },
  };
  el.innerHTML = trxList.map(t => {
    const type = t.type || 'recharge';
    const ic = icons[type] || icons.recharge;
    return `<div class="activity-item">
      <div class="activity-dot ${ic.cls}">${ic.svg}</div>
      <div class="activity-content">
        <div class="activity-text"><span>${esc(t.userName||t.userId||'User')}</span> — ${type} ৳${t.amount||0}</div>
        <div class="activity-time">${fmtDate(t.createdAt||t.date)}</div>
      </div>
      <span class="badge badge-${type==='subscription'?'purple':type==='purchase'?'blue':'success'}">${type}</span>
    </div>`;
  }).join('');
}

// ── USERS ─────────────────────────────────────────────────
async function loadUsers() {
  document.getElementById('usersTableWrap').innerHTML = loadingHtml();
  try {
    const res = await adminGet({ action: 'getAllUsers' });
    allUsers = res.data || res.users || [];
    document.getElementById('navUserCount').textContent = allUsers.length;
    renderUsersTable(allUsers);
  } catch(e) {
    document.getElementById('usersTableWrap').innerHTML = emptyState('Failed to load', 'Could not connect to API. Check your GAS URL in Settings.');
  }
}

function filterUsers() {
  const q = (document.getElementById('userSearch').value || '').toLowerCase();
  const f = document.getElementById('userFilter').value;
  let list = allUsers;
  if (q) list = list.filter(u => (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
  if (f === 'active') list = list.filter(u => u.subActive);
  if (f === 'free')   list = list.filter(u => !u.subActive);
  renderUsersTable(list);
}

function renderUsersTable(users) {
  const el = document.getElementById('usersTableWrap');
  if (!users.length) { el.innerHTML = emptyState('No users found', 'Try a different search or filter.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>User</th><th>Email</th><th>Wallet</th><th>Subscription</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>${users.map(u => `
      <tr>
        <td><div class="user-row-info">
          <div class="user-mini-avatar">${initials(u.name)}</div>
          <div><div class="user-mini-name">${esc(u.name||'Unknown')}</div><div class="user-mini-email">${esc(u.userId||u.id||'')}</div></div>
        </div></td>
        <td style="font-size:.78rem;color:var(--text-muted)">${esc(u.email||'')}</td>
        <td style="font-weight:700">৳${parseFloat(u.wallet||u.balance||0).toFixed(0)}</td>
        <td>${u.subActive
          ? `<span class="badge badge-purple">${esc(u.subPlan||'Pro')}</span>`
          : '<span class="badge badge-gray">Free</span>'}</td>
        <td style="font-size:.75rem;color:var(--text-muted)">${fmtDate(u.createdAt||u.joinedAt)}</td>
        <td style="display:flex;gap:5px;flex-wrap:wrap">
          <button class="btn-xs btn-xs-primary" onclick='openUserModal(${JSON.stringify(u)})'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn-xs btn-xs-success" onclick='addUserWallet("${u.userId||u.id}","${esc(u.name)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Wallet
          </button>
          <button class="btn-xs btn-xs-danger" onclick='confirmDeleteUser("${u.userId||u.id}","${esc(u.name)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            Delete
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

let _editingUser = null;
function openUserModal(u) {
  _editingUser = u;
  document.getElementById('userModalTitle').textContent = 'Edit: ' + (u.name || 'User');
  document.getElementById('userModalBody').innerHTML = `
    <div class="admin-form-group">
      <label class="admin-label">Full Name</label>
      <input class="admin-input" type="text" id="uEditName" value="${esc(u.name||'')}"/>
    </div>
    <div class="admin-form-group">
      <label class="admin-label">Email</label>
      <input class="admin-input disabled" type="email" value="${esc(u.email||'')}" readonly/>
    </div>
    <div class="grid-2">
      <div class="admin-form-group">
        <label class="admin-label">Wallet Balance (৳)</label>
        <input class="admin-input" type="number" id="uEditWallet" value="${parseFloat(u.wallet||u.balance||0).toFixed(0)}"/>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">Subscription Plan</label>
        <select class="admin-input" id="uEditSubPlan">
          <option value="">Free</option>
          <option value="basic" ${u.subPlan==='basic'?'selected':''}>Basic</option>
          <option value="pro"   ${u.subPlan==='pro'?'selected':''}>Pro</option>
          <option value="ultra" ${u.subPlan==='ultra'?'selected':''}>Ultra</option>
        </select>
      </div>
      <div class="admin-form-group">
        <label class="admin-label">Sub Expires</label>
        <input class="admin-input" type="date" id="uEditSubExpiry" value="${u.subExpires ? new Date(u.subExpires).toISOString().split('T')[0] : ''}"/>
      </div>
      <div class="admin-form-group" style="display:flex;align-items:center;gap:10px;padding-top:24px">
        <label class="admin-label" style="margin:0">Subscription Active</label>
        <label class="admin-toggle"><input type="checkbox" id="uEditSubActive" ${u.subActive?'checked':''}/><span class="admin-toggle-slider"></span></label>
      </div>
    </div>
    <div class="admin-form-group">
      <label class="admin-label">Reset Password (leave blank to keep)</label>
      <input class="admin-input" type="password" id="uEditPass" placeholder="New password..."/>
    </div>
  `;
  openModal('userModal');
}

async function saveUserEdit() {
  if (!_editingUser) return;
  const btn = document.getElementById('userModalSaveBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    await adminPost('adminUpdateUser', {
      userId:    _editingUser.userId || _editingUser.id,
      name:      document.getElementById('uEditName').value,
      wallet:    parseFloat(document.getElementById('uEditWallet').value) || 0,
      subPlan:   document.getElementById('uEditSubPlan').value,
      subActive: document.getElementById('uEditSubActive').checked,
      subExpires: document.getElementById('uEditSubExpiry').value ? new Date(document.getElementById('uEditSubExpiry').value).getTime() : null,
      newPassword: document.getElementById('uEditPass').value || null,
    });
    showToast('User updated successfully!', 'success');
    closeModal('userModal');
    loadUsers();
  } catch(e) {
    showToast('Failed to update user.', 'error');
  }
  btn.textContent = 'Save Changes';
  btn.disabled = false;
}

function addUserWallet(userId, name) {
  showConfirm('Add Wallet Balance', `Add balance to ${name}?<br><br><input id="walletAddAmt" type="number" class="admin-input" placeholder="Amount in ৳" style="margin-top:8px"/>`, async () => {
    const amt = parseFloat(document.getElementById('walletAddAmt').value) || 0;
    if (amt <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    try {
      await adminPost('adminAddWallet', { userId, amount: amt });
      showToast(`৳${amt} added to ${name}`, 'success');
      loadUsers();
    } catch(e) { showToast('Failed.', 'error'); }
  });
}

function confirmDeleteUser(userId, name) {
  showConfirm('Delete User', `Are you sure you want to delete <strong>${name}</strong>? This cannot be undone.`, async () => {
    try {
      await adminPost('adminDeleteUser', { userId });
      showToast('User deleted.', 'success');
      loadUsers();
    } catch(e) { showToast('Failed to delete.', 'error'); }
  });
}

// ── SUBSCRIPTIONS ──────────────────────────────────────────
async function loadSubscriptions() {
  document.getElementById('subsTableWrap').innerHTML = loadingHtml();
  try {
    const res = await adminGet({ action: 'getAllSubscriptions' });
    const subs = res.data || res.subscriptions || [];
    renderSubsTable(subs);
  } catch(e) {
    document.getElementById('subsTableWrap').innerHTML = emptyState('Failed to load', 'API error. Check settings.');
  }
}

function renderSubsTable(subs) {
  const el = document.getElementById('subsTableWrap');
  if (!subs.length) { el.innerHTML = emptyState('No subscriptions', 'No active subscriptions found.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
    <tbody>${subs.map(s => `
      <tr>
        <td><div class="user-row-info">
          <div class="user-mini-avatar">${initials(s.userName||s.userId)}</div>
          <div><div class="user-mini-name">${esc(s.userName||'User')}</div><div class="user-mini-email">${esc(s.email||s.userId||'')}</div></div>
        </div></td>
        <td><span class="badge badge-purple">${esc(s.planName||s.planId||'Pro')}</span></td>
        <td>${s.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-gray">Expired</span>'}</td>
        <td style="font-size:.78rem;color:var(--text-muted)">${s.expiresAt ? new Date(parseInt(s.expiresAt)).toLocaleDateString() : '—'}</td>
        <td style="display:flex;gap:5px">
          <button class="btn-xs btn-xs-danger" onclick='revokeSub("${s.userId}","${esc(s.userName)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Revoke
          </button>
          <button class="btn-xs btn-xs-success" onclick='extendSub("${s.userId}","${esc(s.userName)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Extend
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function openGrantSubModal() { openModal('grantSubModal'); }

async function grantSubscription() {
  const email   = document.getElementById('grantSubEmail').value.trim();
  const planId  = document.getElementById('grantSubPlan').value;
  const days    = parseInt(document.getElementById('grantSubDays').value) || 30;
  const note    = document.getElementById('grantSubNote').value;
  if (!email) { showToast('Email required.', 'error'); return; }
  try {
    await adminPost('adminGrantSubscription', { email, planId, days, note });
    showToast('Subscription granted!', 'success');
    closeModal('grantSubModal');
    loadSubscriptions();
  } catch(e) { showToast('Failed to grant subscription.', 'error'); }
}

function revokeSub(userId, name) {
  showConfirm('Revoke Subscription', `Revoke subscription for <strong>${name}</strong>?`, async () => {
    try {
      await adminPost('adminRevokeSubscription', { userId });
      showToast('Subscription revoked.', 'success');
      loadSubscriptions();
    } catch(e) { showToast('Failed.', 'error'); }
  });
}

function extendSub(userId, name) {
  showConfirm('Extend Subscription', `Extend subscription for <strong>${name}</strong>?<br><input id="extDays" type="number" class="admin-input" value="30" style="margin-top:8px"/> days`, async () => {
    const days = parseInt(document.getElementById('extDays').value) || 30;
    try {
      await adminPost('adminExtendSubscription', { userId, days });
      showToast(`Extended ${days} days for ${name}.`, 'success');
      loadSubscriptions();
    } catch(e) { showToast('Failed.', 'error'); }
  });
}

// ── WALLET REQUESTS ────────────────────────────────────────
async function loadWalletRequests() {
  document.getElementById('walletTableWrap').innerHTML = loadingHtml();
  try {
    const res = await adminGet({ action: 'getAllWalletRequests' });
    allWalletReqs = res.data || res.requests || [];
    const pending = allWalletReqs.filter(w => w.status === 'pending' || !w.status).length;
    document.getElementById('navPendingCount').textContent = pending;
    if (pending > 0) document.getElementById('notifDot').style.display = 'block';
    else document.getElementById('notifDot').style.display = 'none';
    filterWalletTab(currentWalletTab, null, true);
  } catch(e) {
    document.getElementById('walletTableWrap').innerHTML = emptyState('Failed to load', 'API connection error.');
  }
}

function filterWalletTab(tab, btn, noReload = false) {
  currentWalletTab = tab;
  document.querySelectorAll('.admin-tabs .admin-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (!noReload) loadWalletRequests();

  let list = allWalletReqs;
  if (tab !== 'all') list = list.filter(w => {
    if (tab === 'pending') return w.status === 'pending' || !w.status;
    return w.status === tab;
  });
  renderWalletTable(list);
}

function renderWalletTable(reqs) {
  const el = document.getElementById('walletTableWrap');
  if (!reqs.length) { el.innerHTML = emptyState('No requests', 'No wallet requests in this category.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>User</th><th>Amount</th><th>Method</th><th>TrxID</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${reqs.map(r => {
      const s = r.status || 'pending';
      const sBadge = s === 'approved' ? 'badge-success' : s === 'rejected' ? 'badge-danger' : 'badge-warning';
      return `<tr>
        <td><div class="user-row-info">
          <div class="user-mini-avatar">${initials(r.userName||r.userId)}</div>
          <div><div class="user-mini-name">${esc(r.userName||r.userId||'User')}</div></div>
        </div></td>
        <td style="font-weight:800;color:var(--success)">৳${r.amount}</td>
        <td><span class="badge badge-blue">${esc(r.method||'bkash')}</span></td>
        <td style="font-family:var(--font-mono);font-size:.72rem">${esc(r.trxId||r.id||'—')}</td>
        <td style="font-size:.75rem;color:var(--text-muted)">${fmtDate(r.createdAt||r.date)}</td>
        <td><span class="badge ${sBadge}">${s}</span></td>
        <td style="display:flex;gap:5px">${s==='pending'||!r.status ? `
          <button class="btn-xs btn-xs-success" onclick='approveWallet("${r.id||r.trxId}","${r.userId}",${r.amount})'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Approve
          </button>
          <button class="btn-xs btn-xs-danger" onclick='rejectWallet("${r.id||r.trxId}","${r.userId}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Reject
          </button>` : '<span style="color:var(--text-light);font-size:.75rem">—</span>'}
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

async function approveWallet(reqId, userId, amount) {
  showConfirm('Approve Payment', `Approve ৳${amount} wallet recharge? This will add the amount to the user's balance.`, async () => {
    try {
      await adminPost('adminApproveWallet', { reqId, userId, amount: parseFloat(amount) });
      showToast(`৳${amount} approved and added to wallet.`, 'success');
      loadWalletRequests();
    } catch(e) { showToast('Failed to approve.', 'error'); }
  });
}

async function rejectWallet(reqId, userId) {
  showConfirm('Reject Payment', 'Are you sure you want to reject this payment request?', async () => {
    try {
      await adminPost('adminRejectWallet', { reqId, userId });
      showToast('Payment rejected.', 'success');
      loadWalletRequests();
    } catch(e) { showToast('Failed to reject.', 'error'); }
  });
}

// ── TRANSACTIONS ───────────────────────────────────────────
async function loadTransactions() {
  document.getElementById('trxTableWrap').innerHTML = loadingHtml();
  const type = document.getElementById('trxFilter').value;
  try {
    const res = await adminGet({ action: 'getAllTransactions', type });
    const trxs = res.data || res.transactions || [];
    renderTrxTable(trxs);
  } catch(e) {
    document.getElementById('trxTableWrap').innerHTML = emptyState('Failed to load', 'API error.');
  }
}

function renderTrxTable(trxs) {
  const el = document.getElementById('trxTableWrap');
  if (!trxs.length) { el.innerHTML = emptyState('No transactions', 'No transactions found.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Note</th><th>Date</th></tr></thead>
    <tbody>${trxs.map(t => `
      <tr>
        <td><div class="user-row-info">
          <div class="user-mini-avatar">${initials(t.userName||t.userId)}</div>
          <div><div class="user-mini-name">${esc(t.userName||t.userId||'User')}</div></div>
        </div></td>
        <td><span class="badge ${t.type==='subscription'?'badge-purple':t.type==='purchase'?'badge-blue':'badge-success'}">${esc(t.type||'—')}</span></td>
        <td style="font-weight:800">৳${parseFloat(t.amount||0).toFixed(0)}</td>
        <td style="font-size:.75rem;color:var(--text-muted)">${esc(t.note||t.description||'—')}</td>
        <td style="font-size:.75rem;color:var(--text-muted)">${fmtDate(t.createdAt||t.date)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// ── TEMPLATES ──────────────────────────────────────────────
async function loadTemplates() {
  document.getElementById('tplTableWrap').innerHTML = loadingHtml();
  try {
    const res = await adminGet({ action: 'getTemplates' });
    allTemplates = res.data || res.templates || [];
    renderTplTable(allTemplates);
  } catch(e) {
    document.getElementById('tplTableWrap').innerHTML = emptyState('Failed to load', 'API error.');
  }
}

function filterTemplates() {
  const q = (document.getElementById('tplSearch').value || '').toLowerCase();
  renderTplTable(allTemplates.filter(t => (t.name||'').toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q)));
}

function renderTplTable(tpls) {
  const el = document.getElementById('tplTableWrap');
  if (!tpls.length) { el.innerHTML = emptyState('No templates', 'Add a template to get started.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Premium</th><th>Downloads</th><th>Actions</th></tr></thead>
    <tbody>${tpls.map(t => `
      <tr>
        <td style="font-weight:700">${esc(t.name||'—')}</td>
        <td><span class="badge badge-blue">${esc(t.category||'General')}</span></td>
        <td>${t.price > 0 ? `<strong>৳${t.price}</strong>` : '<span class="badge badge-success">Free</span>'}</td>
        <td>${t.premium ? '<span class="badge badge-purple">Premium</span>' : '<span class="badge badge-gray">Free</span>'}</td>
        <td style="color:var(--text-muted)">${t.downloads||0}</td>
        <td style="display:flex;gap:5px">
          <button class="btn-xs btn-xs-primary" onclick='editTemplate(${JSON.stringify(t)})'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn-xs btn-xs-danger" onclick='deleteTemplate("${t.id}","${esc(t.name)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            Delete
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function openAddTemplateModal() {
  document.getElementById('tplModalTitle').textContent = 'Add Template';
  document.getElementById('tplEditId').value = '';
  ['tplName','tplCategory','tplPrice','tplImage','tplDesc','tplFileUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('tplPremium').checked = false;
  document.getElementById('tplFeatured').checked = false;
  openModal('tplModal');
}

function editTemplate(t) {
  document.getElementById('tplModalTitle').textContent = 'Edit Template';
  document.getElementById('tplEditId').value     = t.id || '';
  document.getElementById('tplName').value       = t.name || '';
  document.getElementById('tplCategory').value   = t.category || '';
  document.getElementById('tplPrice').value      = t.price || 0;
  document.getElementById('tplImage').value      = t.image || '';
  document.getElementById('tplDesc').value       = t.description || '';
  document.getElementById('tplFileUrl').value    = t.fileUrl || t.downloadUrl || '';
  document.getElementById('tplPremium').checked  = !!t.premium;
  document.getElementById('tplFeatured').checked = !!t.featured;
  openModal('tplModal');
}

async function saveTemplate() {
  const id = document.getElementById('tplEditId').value;
  const data = {
    name:        document.getElementById('tplName').value,
    category:    document.getElementById('tplCategory').value,
    price:       parseFloat(document.getElementById('tplPrice').value) || 0,
    image:       document.getElementById('tplImage').value,
    description: document.getElementById('tplDesc').value,
    fileUrl:     document.getElementById('tplFileUrl').value,
    premium:     document.getElementById('tplPremium').checked,
    featured:    document.getElementById('tplFeatured').checked,
  };
  if (!data.name) { showToast('Template name required.', 'error'); return; }
  try {
    await adminPost(id ? 'adminUpdateTemplate' : 'adminAddTemplate', { id, ...data });
    showToast(id ? 'Template updated!' : 'Template added!', 'success');
    closeModal('tplModal');
    loadTemplates();
  } catch(e) { showToast('Failed to save template.', 'error'); }
}

function deleteTemplate(id, name) {
  showConfirm('Delete Template', `Delete template "<strong>${name}</strong>"?`, async () => {
    try {
      await adminPost('adminDeleteTemplate', { id });
      showToast('Template deleted.', 'success');
      loadTemplates();
    } catch(e) { showToast('Failed.', 'error'); }
  });
}

// ── BANNERS ────────────────────────────────────────────────
async function loadBanners() {
  document.getElementById('bannersGrid').innerHTML = loadingHtml();
  try {
    const res = await adminGet({ action: 'getBanners' });
    allBanners = res.data || res.banners || [];
    renderBanners(allBanners);
  } catch(e) {
    document.getElementById('bannersGrid').innerHTML = emptyState('Failed to load', 'API error.');
  }
}

function renderBanners(banners) {
  const el = document.getElementById('bannersGrid');
  if (!banners.length) { el.innerHTML = emptyState('No banners', 'Add a banner to show on dashboard.'); return; }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">${
    banners.map(b => `
    <div style="background:linear-gradient(135deg,#1a2f7a,#2563eb);border-radius:14px;padding:18px;color:#fff;position:relative;overflow:hidden">
      <div style="font-size:.7rem;opacity:.7;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Banner</div>
      <div style="font-size:.95rem;font-weight:800;margin-bottom:4px">${esc(b.title||'—')}</div>
      <div style="font-size:.78rem;opacity:.8;margin-bottom:12px">${esc(b.subtitle||b.description||'')}</div>
      <div style="display:flex;gap:8px">
        <button class="btn-xs btn-xs-gray" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3)" onclick='editBanner(${JSON.stringify(b)})'>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="btn-xs btn-xs-danger" onclick='deleteBanner("${b.id}","${esc(b.title)}")' style="background:rgba(239,68,68,.2);color:#fca5a5;border:1px solid rgba(239,68,68,.4)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          Delete
        </button>
        ${b.active ? '<span class="badge badge-success" style="background:rgba(16,185,129,.2);color:#6ee7b7;border:1px solid rgba(16,185,129,.3)">Active</span>' : '<span class="badge badge-gray" style="background:rgba(0,0,0,.2);color:rgba(255,255,255,.5)">Inactive</span>'}
      </div>
    </div>`).join('')
  }</div>`;
}

function openAddBannerModal() {
  document.getElementById('bannerModalTitle').textContent = 'Add Banner';
  document.getElementById('bannerEditId').value = '';
  ['bannerTitle','bannerSubtitle','bannerLink','bannerImage'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('bannerActive').checked = true;
  openModal('bannerModal');
}

function editBanner(b) {
  document.getElementById('bannerModalTitle').textContent = 'Edit Banner';
  document.getElementById('bannerEditId').value    = b.id || '';
  document.getElementById('bannerTitle').value     = b.title || '';
  document.getElementById('bannerSubtitle').value  = b.subtitle || b.description || '';
  document.getElementById('bannerLink').value      = b.link || '';
  document.getElementById('bannerImage').value     = b.image || '';
  document.getElementById('bannerActive').checked  = !!b.active;
  openModal('bannerModal');
}

async function saveBanner() {
  const id = document.getElementById('bannerEditId').value;
  const data = {
    title:    document.getElementById('bannerTitle').value,
    subtitle: document.getElementById('bannerSubtitle').value,
    link:     document.getElementById('bannerLink').value,
    image:    document.getElementById('bannerImage').value,
    active:   document.getElementById('bannerActive').checked,
  };
  if (!data.title) { showToast('Banner title required.', 'error'); return; }
  try {
    await adminPost(id ? 'adminUpdateBanner' : 'adminAddBanner', { id, ...data });
    showToast(id ? 'Banner updated!' : 'Banner added!', 'success');
    closeModal('bannerModal');
    loadBanners();
  } catch(e) { showToast('Failed to save banner.', 'error'); }
}

function deleteBanner(id, name) {
  showConfirm('Delete Banner', `Delete banner "<strong>${name}</strong>"?`, async () => {
    try {
      await adminPost('adminDeleteBanner', { id });
      showToast('Banner deleted.', 'success');
      loadBanners();
    } catch(e) { showToast('Failed.', 'error'); }
  });
}

// ── LAB PROJECTS ───────────────────────────────────────────
async function loadLabProjects() {
  document.getElementById('labTableWrap').innerHTML = loadingHtml();
  try {
    const res = await adminGet({ action: 'getLabProjects' });
    allLabProjects = res.data || res.projects || [];
    renderLabTable(allLabProjects);
  } catch(e) {
    document.getElementById('labTableWrap').innerHTML = emptyState('Failed to load', 'API error.');
  }
}

function filterLab() {
  const q = (document.getElementById('labSearch').value || '').toLowerCase();
  renderLabTable(allLabProjects.filter(p => (p.title||'').toLowerCase().includes(q) || (p.author||'').toLowerCase().includes(q)));
}

function renderLabTable(projs) {
  const el = document.getElementById('labTableWrap');
  if (!projs.length) { el.innerHTML = emptyState('No lab projects', 'No lab projects published yet.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Title</th><th>Author</th><th>Views</th><th>Likes</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>${projs.map(p => `
      <tr>
        <td style="font-weight:700">${esc(p.title||'—')}</td>
        <td><div class="user-row-info">
          <div class="user-mini-avatar" style="width:26px;height:26px;font-size:.65rem">${initials(p.author||p.userId)}</div>
          <span style="font-size:.8rem">${esc(p.author||p.userId||'User')}</span>
        </div></td>
        <td style="color:var(--text-muted)">${p.views||0}</td>
        <td style="color:var(--danger)">${p.likes||0}</td>
        <td style="font-size:.75rem;color:var(--text-muted)">${fmtDate(p.createdAt||p.date)}</td>
        <td style="display:flex;gap:5px">
          <button class="btn-xs btn-xs-danger" onclick='deleteLabProject("${p.id}","${esc(p.title)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            Delete
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function deleteLabProject(id, title) {
  showConfirm('Delete Lab Project', `Delete project "<strong>${title}</strong>"?`, async () => {
    try {
      await adminPost('adminDeleteLabProject', { id });
      showToast('Lab project deleted.', 'success');
      loadLabProjects();
    } catch(e) { showToast('Failed.', 'error'); }
  });
}

// ── APPS ────────────────────────────────────────────────────
async function loadApps() {
  document.getElementById('appsTableWrap').innerHTML = loadingHtml();
  try {
    const res = await adminGet({ action: 'getApps' });
    allApps = res.data || res.apps || [];
    renderAppsTable(allApps);
  } catch(e) {
    document.getElementById('appsTableWrap').innerHTML = emptyState('Failed to load', 'API error.');
  }
}

function renderAppsTable(apps) {
  const el = document.getElementById('appsTableWrap');
  if (!apps.length) { el.innerHTML = emptyState('No apps', 'Add apps to the store.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>App</th><th>Category</th><th>Price</th><th>Downloads</th><th>Actions</th></tr></thead>
    <tbody>${apps.map(a => `
      <tr>
        <td style="font-weight:700">${esc(a.name||'—')}</td>
        <td><span class="badge badge-blue">${esc(a.category||'General')}</span></td>
        <td>${a.price > 0 ? `<strong>৳${a.price}</strong>` : '<span class="badge badge-success">Free</span>'}</td>
        <td style="color:var(--text-muted)">${a.downloads||0}</td>
        <td style="display:flex;gap:5px">
          <button class="btn-xs btn-xs-primary" onclick='editApp(${JSON.stringify(a)})'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn-xs btn-xs-danger" onclick='deleteApp("${a.id}","${esc(a.name)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            Delete
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function openAddAppModal() {
  // Reuse template modal for apps
  showToast('Use the API to add apps.', 'info');
}

function editApp(a) {
  showToast('Edit feature — connect API to enable.', 'info');
}

function deleteApp(id, name) {
  showConfirm('Delete App', `Delete app "<strong>${name}</strong>"?`, async () => {
    try {
      await adminPost('adminDeleteApp', { id });
      showToast('App deleted.', 'success');
      loadApps();
    } catch(e) { showToast('Failed.', 'error'); }
  });
}

// ── SUBSCRIPTION PLANS ─────────────────────────────────────
async function loadPlans() {
  document.getElementById('plansTableWrap').innerHTML = loadingHtml();
  try {
    const res = await adminGet({ action: 'getSubscriptionPlans' });
    allPlans = res.data || res.plans || [];
    renderPlansTable(allPlans);
  } catch(e) {
    document.getElementById('plansTableWrap').innerHTML = emptyState('Failed to load', 'API error.');
  }
}

function renderPlansTable(plans) {
  const el = document.getElementById('plansTableWrap');
  if (!plans.length) { el.innerHTML = emptyState('No plans', 'Add subscription plans.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Plan</th><th>Price</th><th>Duration</th><th>Popular</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${plans.map(p => `
      <tr>
        <td><div><div style="font-weight:700">${esc(p.name||p.planName||'—')}</div><div style="font-size:.72rem;color:var(--text-muted)">${esc(p.id||p.planId||'')}</div></div></td>
        <td style="font-weight:800;color:var(--primary)">৳${p.price||0}</td>
        <td style="color:var(--text-muted)">${p.duration||30} days</td>
        <td>${p.popular ? '<span class="badge badge-warning">⭐ Popular</span>' : '—'}</td>
        <td>${p.active !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
        <td style="display:flex;gap:5px">
          <button class="btn-xs btn-xs-primary" onclick='editPlan(${JSON.stringify(p)})'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn-xs btn-xs-danger" onclick='deletePlan("${p.id||p.planId}","${esc(p.name||p.planName)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            Delete
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function openAddPlanModal() {
  document.getElementById('planModalTitle').textContent = 'Add Plan';
  document.getElementById('planEditId').value = '';
  ['planName','planId','planPrice','planDuration','planDesc','planFeatures'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('planPopular').checked = false;
  document.getElementById('planActive').checked  = true;
  openModal('planModal');
}

function editPlan(p) {
  document.getElementById('planModalTitle').textContent = 'Edit Plan';
  document.getElementById('planEditId').value    = p.id || p.planId || '';
  document.getElementById('planName').value      = p.name || p.planName || '';
  document.getElementById('planId').value        = p.id || p.planId || '';
  document.getElementById('planPrice').value     = p.price || 0;
  document.getElementById('planDuration').value  = p.duration || 30;
  document.getElementById('planDesc').value      = p.description || '';
  document.getElementById('planFeatures').value  = (p.features || []).join('\n');
  document.getElementById('planPopular').checked = !!p.popular;
  document.getElementById('planActive').checked  = p.active !== false;
  openModal('planModal');
}

async function savePlan() {
  const id = document.getElementById('planEditId').value;
  const data = {
    name:        document.getElementById('planName').value,
    planId:      document.getElementById('planId').value,
    price:       parseFloat(document.getElementById('planPrice').value) || 0,
    duration:    parseInt(document.getElementById('planDuration').value) || 30,
    description: document.getElementById('planDesc').value,
    features:    document.getElementById('planFeatures').value.split('\n').filter(Boolean),
    popular:     document.getElementById('planPopular').checked,
    active:      document.getElementById('planActive').checked,
  };
  if (!data.name || !data.planId) { showToast('Plan name and ID required.', 'error'); return; }
  try {
    await adminPost(id ? 'adminUpdatePlan' : 'adminAddPlan', { id, ...data });
    showToast(id ? 'Plan updated!' : 'Plan added!', 'success');
    closeModal('planModal');
    loadPlans();
  } catch(e) { showToast('Failed to save plan.', 'error'); }
}

function deletePlan(id, name) {
  showConfirm('Delete Plan', `Delete plan "<strong>${name}</strong>"?`, async () => {
    try {
      await adminPost('adminDeletePlan', { id });
      showToast('Plan deleted.', 'success');
      loadPlans();
    } catch(e) { showToast('Failed.', 'error'); }
  });
}

// ── APP CONFIG ─────────────────────────────────────────────
async function loadAppConfig() {
  try {
    const res = await adminGet({ action: 'getAppConfig' });
    const cfg = res.data || res.config || {};
    document.getElementById('cfgBkash').value = cfg.bkash_number || '';
    document.getElementById('cfgNagad').value = cfg.nagad_number || '';
    document.getElementById('cfgMaintenance').checked   = !!cfg.maintenance;
    document.getElementById('cfgRegistration').checked  = cfg.registration !== false;
    document.getElementById('cfgWalletRecharge').checked = cfg.walletRecharge !== false;
    document.getElementById('cfgLab').checked           = cfg.lab !== false;
    document.getElementById('cfgApkBuilder').checked    = cfg.apkBuilder !== false;

    const adsRes = await adminGet({ action: 'getAdsConfig' });
    const ads = adsRes.data || adsRes.config || {};
    document.getElementById('cfgAdmobId').value   = ads.admobId || '';
    document.getElementById('cfgBannerAd').value  = ads.bannerAd || '';
    document.getElementById('cfgInterAd').value   = ads.interAd || '';
    document.getElementById('cfgAdsEnabled').checked = !!ads.enabled;
  } catch(e) {}
}

async function savePaymentConfig() {
  try {
    await adminPost('adminSaveConfig', {
      bkash_number: document.getElementById('cfgBkash').value,
      nagad_number: document.getElementById('cfgNagad').value,
    });
    showToast('Payment config saved!', 'success');
  } catch(e) { showToast('Failed to save.', 'error'); }
}

async function saveFeatureConfig(key, val) {
  try {
    await adminPost('adminSaveFeature', { key, value: val });
    showToast(`${key} ${val ? 'enabled' : 'disabled'}`, 'success');
  } catch(e) { showToast('Failed.', 'error'); }
}

async function saveAdsConfig() {
  try {
    await adminPost('adminSaveAdsConfig', {
      admobId:  document.getElementById('cfgAdmobId').value,
      bannerAd: document.getElementById('cfgBannerAd').value,
      interAd:  document.getElementById('cfgInterAd').value,
      enabled:  document.getElementById('cfgAdsEnabled').checked,
    });
    showToast('Ads config saved!', 'success');
  } catch(e) { showToast('Failed to save ads config.', 'error'); }
}

// ── FLASH SALE ─────────────────────────────────────────────
async function loadFlashSale() {
  document.getElementById('flashItemsWrap').innerHTML = loadingHtml();
  try {
    const [cfg, items] = await Promise.all([
      adminGet({ action: 'getFlashSaleConfig' }),
      adminGet({ action: 'getFlashSaleItems' }),
    ]);
    const c = cfg.data || cfg.config || {};
    document.getElementById('cfgFlashEnabled').checked  = !!c.enabled;
    document.getElementById('cfgFlashTitle').value      = c.title || '';
    document.getElementById('cfgFlashDiscount').value   = c.discount || '';
    document.getElementById('cfgFlashBadge').value      = c.badge || '';
    if (c.endDate) document.getElementById('cfgFlashEnd').value = new Date(c.endDate).toISOString().slice(0,16);

    const it = items.data || items.items || [];
    renderFlashItems(it);
  } catch(e) {
    document.getElementById('flashItemsWrap').innerHTML = emptyState('Failed to load', 'API error.');
  }
}

function renderFlashItems(items) {
  const el = document.getElementById('flashItemsWrap');
  if (!items.length) { el.innerHTML = emptyState('No flash items', 'Add items for the flash sale.'); return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Name</th><th>Original Price</th><th>Sale Price</th><th>Actions</th></tr></thead>
    <tbody>${items.map(i => `
      <tr>
        <td style="font-weight:700">${esc(i.name||'—')}</td>
        <td style="text-decoration:line-through;color:var(--text-muted)">৳${i.originalPrice||0}</td>
        <td style="font-weight:800;color:var(--danger)">৳${i.salePrice||0}</td>
        <td>
          <button class="btn-xs btn-xs-danger" onclick='deleteFlashItem("${i.id}","${esc(i.name)}")'>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            Delete
          </button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function saveFlashSaleConfig() {
  try {
    await adminPost('adminSaveFlashSale', {
      enabled:  document.getElementById('cfgFlashEnabled').checked,
      title:    document.getElementById('cfgFlashTitle').value,
      discount: document.getElementById('cfgFlashDiscount').value,
      badge:    document.getElementById('cfgFlashBadge').value,
      endDate:  document.getElementById('cfgFlashEnd').value ? new Date(document.getElementById('cfgFlashEnd').value).getTime() : null,
    });
    showToast('Flash sale config saved!', 'success');
  } catch(e) { showToast('Failed.', 'error'); }
}

function openAddFlashItemModal() {
  showConfirm('Add Flash Item', `
    <div class="admin-form-group"><label class="admin-label">Item Name</label><input class="admin-input" id="fiName" placeholder="Template name"/></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="admin-form-group"><label class="admin-label">Original ৳</label><input class="admin-input" id="fiOrig" type="number" placeholder="299"/></div>
      <div class="admin-form-group"><label class="admin-label">Sale ৳</label><input class="admin-input" id="fiSale" type="number" placeholder="149"/></div>
    </div>
  `, async () => {
    const data = { name: document.getElementById('fiName').value, originalPrice: document.getElementById('fiOrig').value, salePrice: document.getElementById('fiSale').value };
    if (!data.name) { showToast('Item name required.', 'error'); return; }
    try { await adminPost('adminAddFlashItem', data); showToast('Item added!', 'success'); loadFlashSale(); }
    catch(e) { showToast('Failed.', 'error'); }
  }, 'Add Item');
}

function deleteFlashItem(id, name) {
  showConfirm('Delete Flash Item', `Delete "<strong>${name}</strong>" from flash sale?`, async () => {
    try { await adminPost('adminDeleteFlashItem', { id }); showToast('Item deleted.', 'success'); loadFlashSale(); }
    catch(e) { showToast('Failed.', 'error'); }
  });
}

// ── PUSH NOTIFICATIONS ─────────────────────────────────────
async function loadNotifStats() {
  document.getElementById('pnTokenCount').textContent = '—';
  document.getElementById('pnSentToday').textContent  = '0';
  // Load history from localStorage
  pnHistory = JSON.parse(localStorage.getItem('admin_pn_history') || '[]');
  renderPnHistory();
}

function renderPnHistory() {
  const el = document.getElementById('pnHistory');
  if (!pnHistory.length) {
    el.innerHTML = `<div class="admin-empty"><div class="admin-empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><h4>No notifications sent yet</h4></div>`;
    return;
  }
  el.innerHTML = pnHistory.slice().reverse().slice(0,5).map(n => `
    <div class="activity-item">
      <div class="activity-dot purple"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
      <div class="activity-content">
        <div class="activity-text">${esc(n.title)}</div>
        <div class="activity-time">${n.target} · ${fmtDate(n.sentAt)}</div>
      </div>
    </div>`).join('');
  const today = new Date().toDateString();
  document.getElementById('pnSentToday').textContent = pnHistory.filter(n => new Date(n.sentAt).toDateString() === today).length;
}

async function sendPushNotif() {
  const title  = document.getElementById('pnTitle').value.trim();
  const body   = document.getElementById('pnBody').value.trim();
  const image  = document.getElementById('pnImage').value.trim();
  const target = document.getElementById('pnTarget').value;
  if (!title || !body) { showToast('Title and message required.', 'error'); return; }
  showToast('Sending notification...', 'info');
  try {
    await adminPost('adminSendPushNotification', { title, body, image, target });
    pnHistory.push({ title, body, target, sentAt: Date.now() });
    localStorage.setItem('admin_pn_history', JSON.stringify(pnHistory.slice(-50)));
    document.getElementById('pnTitle').value = '';
    document.getElementById('pnBody').value  = '';
    renderPnHistory();
    showToast('Notification sent!', 'success');
  } catch(e) { showToast('Failed to send notification.', 'error'); }
}

// ── SETTINGS ───────────────────────────────────────────────
function loadSettings() {
  const email = localStorage.getItem('wevlo_admin_email_session') || 'admin@wevlo.com';
  document.getElementById('settAdminEmail').value  = email;
  document.getElementById('settGasUrl').value      = localStorage.getItem('admin_gas_url')     || GAS_URL_ADMIN;
  document.getElementById('settBuilderUrl').value  = localStorage.getItem('admin_builder_url') || BUILDER_URL_ADM;
  document.getElementById('settApiKey').value      = localStorage.getItem('admin_api_key')     || ADMIN_API_KEY;
}

function saveAdminCredentials() {
  const newPass    = document.getElementById('settNewPass').value;
  const confPass   = document.getElementById('settConfPass').value;
  if (newPass && newPass !== confPass) { showToast('Passwords do not match.', 'error'); return; }
  if (newPass) localStorage.setItem('wevlo_admin_password', newPass);
  document.getElementById('settNewPass').value = '';
  document.getElementById('settConfPass').value = '';
  showToast('Credentials updated!', 'success');
}

function saveApiConfig() {
  localStorage.setItem('admin_gas_url',     document.getElementById('settGasUrl').value);
  localStorage.setItem('admin_builder_url', document.getElementById('settBuilderUrl').value);
  localStorage.setItem('admin_api_key',     document.getElementById('settApiKey').value);
  showToast('API config saved! Refresh to apply.', 'success');
}

function confirmClearCache() {
  showConfirm('Clear Cache', 'Clear all admin cached data and reload?', () => {
    ['admin_gas_url','admin_builder_url','admin_api_key'].forEach(k => {});
    showToast('Cache cleared!', 'success');
  });
}

// ── Confirm Dialog ─────────────────────────────────────────
function showConfirm(title, msg, onConfirm, btnLabel = 'Confirm') {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').innerHTML     = msg;
  const btn = document.getElementById('confirmBtn');
  btn.textContent = btnLabel;
  btn.onclick = () => { closeModal('confirmModal'); onConfirm && onConfirm(); };
  openModal('confirmModal');
}

// ── Helpers ────────────────────────────────────────────────
function initials(name = '') {
  return (name || '?').trim().split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0,2) || '?';
}

function esc(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(typeof ts === 'string' && ts.length < 13 ? parseInt(ts) : ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function loadingHtml() {
  return `<div class="admin-loading"><svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Loading...</div>`;
}

function emptyState(title, desc) {
  return `<div class="admin-empty">
    <div class="admin-empty-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <h4>${title}</h4>
    <p>${desc}</p>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// APP ADD/EDIT MODAL — Full implementation
// ══════════════════════════════════════════════════════════════
function openAddAppModal() {
  // Build app modal dynamically
  let m = document.getElementById('appDynModal');
  if (!m) {
    m = document.createElement('div');
    m.id        = 'appDynModal';
    m.className = 'admin-modal-overlay';
    m.innerHTML = `
      <div class="admin-modal wide">
        <div class="admin-modal-head">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          <span class="admin-modal-title" id="appModalTitle">Add App</span>
          <button class="admin-modal-close" onclick="document.getElementById('appDynModal').classList.remove('open')">✕</button>
        </div>
        <div class="admin-modal-body">
          <input type="hidden" id="appEditId"/>
          <div class="grid-2">
            <div class="admin-form-group">
              <label class="admin-label">App Name</label>
              <input class="admin-input" type="text" id="appName" placeholder="My App"/>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Category</label>
              <input class="admin-input" type="text" id="appCategory" placeholder="Tools, Games, Education..."/>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Price (৳)</label>
              <input class="admin-input" type="number" id="appPrice" placeholder="0 for free"/>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Version</label>
              <input class="admin-input" type="text" id="appVersion" placeholder="1.0.0"/>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">Icon / Image URL</label>
              <input class="admin-input" type="url" id="appIcon" placeholder="https://..."/>
            </div>
            <div class="admin-form-group">
              <label class="admin-label">APK Download URL</label>
              <input class="admin-input" type="url" id="appDownloadUrl" placeholder="https://drive.google.com/..."/>
            </div>
          </div>
          <div class="admin-form-group">
            <label class="admin-label">Description</label>
            <textarea class="admin-input" id="appDesc" placeholder="App description..."></textarea>
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <label class="admin-label" style="margin:0">Premium Only</label>
            <label class="admin-toggle"><input type="checkbox" id="appPremium"/><span class="admin-toggle-slider"></span></label>
            <label class="admin-label" style="margin:0 0 0 16px">Featured</label>
            <label class="admin-toggle"><input type="checkbox" id="appFeatured"/><span class="admin-toggle-slider"></span></label>
            <label class="admin-label" style="margin:0 0 0 16px">Active</label>
            <label class="admin-toggle"><input type="checkbox" id="appActive" checked/><span class="admin-toggle-slider"></span></label>
          </div>
        </div>
        <div class="admin-modal-footer">
          <button class="btn-admin btn-admin-secondary" onclick="document.getElementById('appDynModal').classList.remove('open')">Cancel</button>
          <button class="btn-admin btn-admin-primary" onclick="saveApp()">Save App</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); });
  }
  document.getElementById('appModalTitle').textContent = 'Add App';
  document.getElementById('appEditId').value = '';
  ['appName','appCategory','appPrice','appVersion','appIcon','appDownloadUrl','appDesc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('appPremium').checked = false;
  document.getElementById('appFeatured').checked = false;
  document.getElementById('appActive').checked   = true;
  m.classList.add('open');
}

function editApp(a) {
  openAddAppModal();
  document.getElementById('appModalTitle').textContent = 'Edit App';
  document.getElementById('appEditId').value      = a.id || '';
  document.getElementById('appName').value        = a.name || '';
  document.getElementById('appCategory').value    = a.category || '';
  document.getElementById('appPrice').value       = a.price || 0;
  document.getElementById('appVersion').value     = a.version || '';
  document.getElementById('appIcon').value        = a.icon || a.image || '';
  document.getElementById('appDownloadUrl').value = a.downloadUrl || a.apkUrl || '';
  document.getElementById('appDesc').value        = a.description || '';
  document.getElementById('appPremium').checked   = !!a.premium;
  document.getElementById('appFeatured').checked  = !!a.featured;
  document.getElementById('appActive').checked    = a.active !== false;
}

async function saveApp() {
  const id = document.getElementById('appEditId').value;
  const data = {
    name:        document.getElementById('appName').value,
    category:    document.getElementById('appCategory').value,
    price:       parseFloat(document.getElementById('appPrice').value) || 0,
    version:     document.getElementById('appVersion').value,
    icon:        document.getElementById('appIcon').value,
    downloadUrl: document.getElementById('appDownloadUrl').value,
    description: document.getElementById('appDesc').value,
    premium:     document.getElementById('appPremium').checked,
    featured:    document.getElementById('appFeatured').checked,
    active:      document.getElementById('appActive').checked,
  };
  if (!data.name) { showToast('App name required.', 'error'); return; }
  try {
    await adminPost(id ? 'adminUpdateApp' : 'adminAddApp', { id, ...data });
    showToast(id ? 'App updated!' : 'App added!', 'success');
    document.getElementById('appDynModal').classList.remove('open');
    loadApps();
  } catch(e) { showToast('Failed to save app.', 'error'); }
}

// ══════════════════════════════════════════════════════════════
// EXPORT — CSV Download
// ══════════════════════════════════════════════════════════════
function exportCSV(data, filename) {
  if (!data.length) { showToast('No data to export.', 'error'); return; }
  const keys = Object.keys(data[0]);
  const rows = [
    keys.join(','),
    ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  showToast('Exported successfully!', 'success');
}

function exportUsers()    { exportCSV(allUsers,       'wevlo_users_'     + dateSlug() + '.csv'); }
function exportWallet()   { exportCSV(allWalletReqs,  'wevlo_wallet_'    + dateSlug() + '.csv'); }
function exportTemplates(){ exportCSV(allTemplates,   'wevlo_templates_' + dateSlug() + '.csv'); }
function dateSlug()       { return new Date().toISOString().slice(0,10); }

// ══════════════════════════════════════════════════════════════
// BULK ACTIONS
// ══════════════════════════════════════════════════════════════
let _selectedUsers = new Set();

function toggleUserSelect(userId, cb) {
  if (cb.checked) _selectedUsers.add(userId);
  else            _selectedUsers.delete(userId);
  updateBulkBar();
}

function updateBulkBar() {
  let bar = document.getElementById('bulkBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulkBar';
    bar.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#1e1b4b;color:#fff;padding:12px 20px;border-radius:14px;
      box-shadow:0 8px 30px rgba(0,0,0,.4);display:flex;align-items:center;
      gap:14px;z-index:500;font-size:.83rem;font-weight:700;
      transition:all .25s cubic-bezier(.34,1.56,.64,1);
    `;
    bar.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      <span id="bulkCount">0 selected</span>
      <button onclick="bulkGrantSub()" style="background:rgba(139,92,246,.3);color:#a78bfa;border:1px solid rgba(139,92,246,.5);padding:5px 12px;border-radius:8px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:var(--font)">Grant Sub</button>
      <button onclick="bulkAddWallet()" style="background:rgba(16,185,129,.2);color:#6ee7b7;border:1px solid rgba(16,185,129,.4);padding:5px 12px;border-radius:8px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:var(--font)">Add Wallet</button>
      <button onclick="bulkDelete()" style="background:rgba(239,68,68,.2);color:#fca5a5;border:1px solid rgba(239,68,68,.4);padding:5px 12px;border-radius:8px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:var(--font)">Delete</button>
      <button onclick="clearBulk()" style="background:rgba(255,255,255,.1);color:rgba(255,255,255,.6);border:none;padding:5px 10px;border-radius:8px;font-size:.75rem;cursor:pointer;font-family:var(--font)">✕ Clear</button>
    `;
    document.body.appendChild(bar);
  }
  if (_selectedUsers.size === 0) {
    bar.style.opacity   = '0';
    bar.style.transform = 'translateX(-50%) translateY(80px)';
  } else {
    document.getElementById('bulkCount').textContent = _selectedUsers.size + ' selected';
    bar.style.opacity   = '1';
    bar.style.transform = 'translateX(-50%) translateY(0)';
  }
}

function clearBulk() { _selectedUsers.clear(); updateBulkBar(); renderUsersTable(allUsers); }

function bulkGrantSub() {
  const ids = [..._selectedUsers];
  showConfirm('Bulk Grant Subscription', `Grant Pro subscription to <strong>${ids.length} users</strong>?<br><br>
    <select class="admin-input" id="bulkSubPlan" style="margin-top:8px">
      <option value="basic">Basic Plan</option>
      <option value="pro">Pro Plan</option>
      <option value="ultra">Ultra Plan</option>
    </select>
    <input class="admin-input" type="number" id="bulkSubDays" value="30" style="margin-top:8px" placeholder="Days"/>
  `, async () => {
    const planId = document.getElementById('bulkSubPlan').value;
    const days   = parseInt(document.getElementById('bulkSubDays').value) || 30;
    let ok = 0;
    for (const userId of ids) {
      try { await adminPost('adminGrantSubscription', { userId, planId, days }); ok++; }
      catch(e) {}
    }
    showToast(`Subscription granted to ${ok}/${ids.length} users.`, 'success');
    clearBulk(); loadUsers();
  }, 'Grant to All');
}

function bulkAddWallet() {
  const ids = [..._selectedUsers];
  showConfirm('Bulk Add Wallet', `Add wallet balance to <strong>${ids.length} users</strong>?<br>
    <input class="admin-input" type="number" id="bulkWalAmt" placeholder="Amount ৳" style="margin-top:10px"/>
  `, async () => {
    const amt = parseFloat(document.getElementById('bulkWalAmt').value) || 0;
    if (amt <= 0) { showToast('Invalid amount.', 'error'); return; }
    let ok = 0;
    for (const userId of ids) {
      try { await adminPost('adminAddWallet', { userId, amount: amt }); ok++; }
      catch(e) {}
    }
    showToast(`৳${amt} added to ${ok} users.`, 'success');
    clearBulk(); loadUsers();
  }, 'Add to All');
}

function bulkDelete() {
  const ids = [..._selectedUsers];
  showConfirm('Bulk Delete', `⚠️ Delete <strong>${ids.length} users</strong>? This CANNOT be undone!`, async () => {
    let ok = 0;
    for (const userId of ids) {
      try { await adminPost('adminDeleteUser', { userId }); ok++; }
      catch(e) {}
    }
    showToast(`${ok} users deleted.`, 'success');
    clearBulk(); loadUsers();
  }, '⚠️ Delete All');
}

// ══════════════════════════════════════════════════════════════
// ENHANCED renderUsersTable — with checkboxes + export btn
// ══════════════════════════════════════════════════════════════
function renderUsersTable(users) {
  const el = document.getElementById('usersTableWrap');
  if (!users.length) { el.innerHTML = emptyState('No users found', 'Try a different search or filter.'); return; }
  el.innerHTML = `
    <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:#f8fafc">
      <label style="display:flex;align-items:center;gap:6px;font-size:.75rem;font-weight:700;color:var(--text-muted);cursor:pointer">
        <input type="checkbox" id="selectAllUsers" onchange="toggleAllUsers(this)"/> Select All
      </label>
      <button class="btn-xs btn-xs-gray" onclick="exportUsers()" style="margin-left:auto">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export CSV
      </button>
    </div>
    <table class="admin-table">
      <thead><tr>
        <th style="width:32px"></th>
        <th>User</th><th>Email</th><th>Wallet</th><th>Subscription</th><th>Joined</th><th>Actions</th>
      </tr></thead>
      <tbody>${users.map(u => `
        <tr id="urow-${u.userId||u.id}">
          <td><input type="checkbox" ${_selectedUsers.has(u.userId||u.id)?'checked':''} onchange="toggleUserSelect('${u.userId||u.id}',this)"/></td>
          <td><div class="user-row-info">
            <div class="user-mini-avatar">${initials(u.name)}</div>
            <div><div class="user-mini-name">${esc(u.name||'Unknown')}</div><div class="user-mini-email">${esc(u.userId||u.id||'')}</div></div>
          </div></td>
          <td style="font-size:.78rem;color:var(--text-muted)">${esc(u.email||'')}</td>
          <td style="font-weight:700">৳${parseFloat(u.wallet||u.balance||0).toFixed(0)}</td>
          <td>${u.subActive
            ? `<span class="badge badge-purple">${esc(u.subPlan||'Pro')}</span>`
            : '<span class="badge badge-gray">Free</span>'}</td>
          <td style="font-size:.75rem;color:var(--text-muted)">${fmtDate(u.createdAt||u.joinedAt)}</td>
          <td style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="btn-xs btn-xs-primary" onclick='openUserModal(${JSON.stringify(u)})'>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="btn-xs btn-xs-success" onclick='addUserWallet("${u.userId||u.id}","${esc(u.name)}")'>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Wallet
            </button>
            <button class="btn-xs btn-xs-warning" onclick='quickGrantSub("${u.userId||u.id}","${esc(u.name)}")'>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Sub
            </button>
            <button class="btn-xs btn-xs-danger" onclick='confirmDeleteUser("${u.userId||u.id}","${esc(u.name)}")'>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              Del
            </button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function toggleAllUsers(masterCb) {
  document.querySelectorAll('#usersTableWrap tbody input[type=checkbox]').forEach(cb => {
    cb.checked = masterCb.checked;
    const userId = cb.closest('tr')?.id?.replace('urow-','');
    if (userId) {
      if (masterCb.checked) _selectedUsers.add(userId);
      else _selectedUsers.delete(userId);
    }
  });
  updateBulkBar();
}

function quickGrantSub(userId, name) {
  showConfirm('Quick Grant Subscription', `Grant Pro (30 days) to <strong>${name}</strong>?`, async () => {
    try {
      await adminPost('adminGrantSubscription', { userId, planId: 'pro', days: 30 });
      showToast(`Pro subscription granted to ${name}!`, 'success');
      loadUsers();
    } catch(e) { showToast('Failed.', 'error'); }
  }, 'Grant Pro');
}

// ══════════════════════════════════════════════════════════════
// SEARCH ACROSS ALL DATA — global admin search
// ══════════════════════════════════════════════════════════════
function adminGlobalSearch(q) {
  if (!q || q.length < 2) return;
  const lower = q.toLowerCase();
  // Search users
  const uMatch = allUsers.filter(u =>
    (u.name||'').toLowerCase().includes(lower) ||
    (u.email||'').toLowerCase().includes(lower)
  );
  if (uMatch.length) {
    showPage('users', document.querySelector('[data-page=users]'));
    document.getElementById('userSearch').value = q;
    renderUsersTable(uMatch);
  }
}

// ══════════════════════════════════════════════════════════════
// ANALYTICS — simple inline stats refresh
// ══════════════════════════════════════════════════════════════
async function refreshStats() {
  try {
    const res = await adminGet({ action: 'getAdminStats' });
    const s   = res.data || res.stats || {};
    if (s.totalUsers)  document.getElementById('dTotalUsers').textContent  = s.totalUsers;
    if (s.activeSubs)  document.getElementById('dActiveSubs').textContent  = s.activeSubs;
    if (s.revenue)     document.getElementById('dRevenue').textContent     = '৳' + s.revenue;
    if (s.pending !== undefined) document.getElementById('dPending').textContent = s.pending;
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════
// REAL-TIME PENDING — poll every 60s
// ══════════════════════════════════════════════════════════════
async function pollPending() {
  try {
    const res = await adminGet({ action: 'getAllWalletRequests' });
    const reqs = res.data || res.requests || [];
    const n = reqs.filter(r => r.status === 'pending' || !r.status).length;
    const badge = document.getElementById('navPendingCount');
    const dot   = document.getElementById('notifDot');
    badge.textContent = n;
    if (n > 0) { dot.style.display = 'block'; badge.classList.add('danger'); }
    else        { dot.style.display = 'none';  }
  } catch(e) {}
}
setInterval(pollPending, 60000);

// ══════════════════════════════════════════════════════════════
// WALLET TABLE — Export button added
// ══════════════════════════════════════════════════════════════
// Patch: add export button above wallet table after render
const _origRenderWallet = renderWalletTable;
function renderWalletTable(reqs) {
  _origRenderWallet(reqs);
  // Prepend export strip
  const el = document.getElementById('walletTableWrap');
  if (reqs.length && el.querySelector('table')) {
    const strip = document.createElement('div');
    strip.style.cssText = 'padding:10px 16px;border-bottom:1px solid var(--border);background:#f8fafc;display:flex;align-items:center;justify-content:flex-end';
    strip.innerHTML = `<button class="btn-xs btn-xs-gray" onclick="exportWallet()">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export CSV
    </button>`;
    el.insertBefore(strip, el.firstChild);
  }
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD STAT CHANGE ANIMATIONS
// ══════════════════════════════════════════════════════════════
function animateCount(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  const raw    = parseInt(String(target).replace(/[^\d]/g,'')) || 0;
  const prefix = String(target).replace(/[\d]/g,'')[0] === '৳' ? '৳' : '';
  let   cur    = 0;
  const step   = Math.max(1, Math.ceil(raw / 30));
  const iv     = setInterval(() => {
    cur = Math.min(cur + step, raw);
    el.textContent = prefix + cur.toLocaleString();
    if (cur >= raw) clearInterval(iv);
  }, 40);
}

// ══════════════════════════════════════════════════════════════
// USER ACTIVITY LOG — store locally
// ══════════════════════════════════════════════════════════════
const AdminLog = {
  _key: 'wevlo_admin_actlog',
  get()      { try { return JSON.parse(localStorage.getItem(this._key) || '[]'); } catch { return []; } },
  push(msg)  {
    const logs = this.get();
    logs.push({ msg, at: Date.now() });
    localStorage.setItem(this._key, JSON.stringify(logs.slice(-100)));
  },
  clear()    { localStorage.removeItem(this._key); },
};

// Patch key admin actions to also log them
const _origApprove = approveWallet;
// approveWallet already calls adminPost internally

// ══════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  // Ctrl/Cmd + K → focus on current page search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const inputs = [
      document.getElementById('userSearch'),
      document.getElementById('tplSearch'),
      document.getElementById('labSearch'),
    ];
    const active = inputs.find(i => i && document.getElementById('page-' + currentPage)?.contains(i));
    if (active) active.focus();
  }
  // Escape closes modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.admin-modal-overlay.open').forEach(el => el.classList.remove('open'));
    document.getElementById('appDynModal')?.classList.remove('open');
  }
});

// ══════════════════════════════════════════════════════════════
// SIDEBAR ACTIVE — restore from localStorage
// ══════════════════════════════════════════════════════════════
(function restoreLastPage() {
  const last = localStorage.getItem('admin_last_page');
  if (last && last !== 'dashboard' && document.querySelector(`[data-page="${last}"]`)) {
    // Don't auto-load on first visit — dashboard is fine
  }
})();

// Save current page on navigation
const _origShowPage = showPage;
function showPage(pageId, navEl) {
  localStorage.setItem('admin_last_page', pageId);
  _origShowPage(pageId, navEl);
}

// ══════════════════════════════════════════════════════════════
// CLOUDFLARE PAGES — no server needed, all client-side
// Admin credentials stored in localStorage (browser-only auth)
// For production: use Cloudflare Access for real auth protection
// ══════════════════════════════════════════════════════════════

// ── Close modals on overlay click ─────────────────────────
document.querySelectorAll('.admin-modal-overlay').forEach(el => {
  el.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// ── Init ─────────────────────────────────────────────────
checkAdminAuth();
