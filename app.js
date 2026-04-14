// ── CONFIG ──────────────────────────────────────────────────────────
const API = 'https://expense-tracker-y3f6.onrender.com/api';

// ── CATEGORIES ──────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'food',      emoji: '🍕', label: 'Food' },
  { id: 'transport', emoji: '🚌', label: 'Transport' },
  { id: 'academic',  emoji: '📚', label: 'Academic' },
  { id: 'personal',  emoji: '🎮', label: 'Personal' },
  { id: 'social',    emoji: '👥', label: 'Social' },
  { id: 'health',    emoji: '🏥', label: 'Health' },
  { id: 'subscript', emoji: '📱', label: 'Subscriptions' },
  { id: 'other',     emoji: '❓', label: 'Other' },
];

// ── STATE ────────────────────────────────────────────────────────────
let accessToken  = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');
let currentUser  = JSON.parse(localStorage.getItem('currentUser') || 'null');
let transactions = [];
let selectedCat  = 'food';
let selectedPay  = 'UPI';
let splits       = [];
let participants = [];
let splitMode    = 'split-ipaid';

// ── API FETCH ────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  options.headers = options.headers || {};
  if (accessToken) options.headers['Authorization'] = 'Bearer ' + accessToken;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  let res = await fetch(API + path, options);

  if (res.status === 401 && refreshToken) {
    // Try to refresh
    const rr = await fetch(API + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (rr.ok) {
      const data = await rr.json();
      accessToken = data.accessToken;
      if (data.refreshToken) refreshToken = data.refreshToken;
      localStorage.setItem('accessToken', accessToken);
      if (data.refreshToken) localStorage.setItem('refreshToken', refreshToken);
      options.headers['Authorization'] = 'Bearer ' + accessToken;
      res = await fetch(API + path, options);
    } else {
      logoutLocal();
      return null;
    }
  }

  return res;
}

// ── AUTH ─────────────────────────────────────────────────────────────
function showAuthTab(tab) {
  document.getElementById('login-form').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('forgot-form').style.display   = tab === 'forgot'   ? '' : 'none';
  document.querySelectorAll('.auth-tab').forEach(b => {
    const isActive = b.getAttribute('onclick') && b.getAttribute('onclick').includes(tab);
    b.style.background  = isActive ? 'var(--card)' : 'transparent';
    b.style.color       = isActive ? 'var(--primary)' : 'var(--text-muted)';
    b.style.boxShadow   = isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
  });
  clearAuthError();
}

function showForgot() {
  document.getElementById('login-form').style.display    = 'none';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('forgot-form').style.display   = '';
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = '';
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  el.textContent = '';
  el.style.display = 'none';
}

async function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { showAuthError('Please fill in all fields'); return; }
  clearAuthError();
  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.message || 'Login failed'); return; }
    saveSession(data);
    initApp();
  } catch (e) {
    showAuthError('Network error. Please try again.');
  }
}

async function register() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!name || !email || !password) { showAuthError('Please fill in all fields'); return; }
  if (password.length < 6) { showAuthError('Password must be at least 6 characters'); return; }
  clearAuthError();
  try {
    const res = await fetch(API + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.message || 'Registration failed'); return; }
    saveSession(data);
    initApp();
  } catch (e) {
    showAuthError('Network error. Please try again.');
  }
}

async function forgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { showAuthError('Please enter your email'); return; }
  clearAuthError();
  try {
    const res = await fetch(API + '/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.message || 'Request failed'); return; }
    toast('Reset link sent! Check your email.');
    showAuthTab('login');
  } catch (e) {
    showAuthError('Network error. Please try again.');
  }
}

function saveSession(data) {
  accessToken  = data.accessToken;
  refreshToken = data.refreshToken;
  currentUser  = data.user || data;
  localStorage.setItem('accessToken',  accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('currentUser',  JSON.stringify(currentUser));
}

async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (_) {}
  logoutLocal();
}

function logoutLocal() {
  accessToken  = null;
  refreshToken = null;
  currentUser  = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('currentUser');
  transactions = [];
  splits       = [];
  participants = [];
  document.getElementById('app-screen').style.display  = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

// ── INIT APP ─────────────────────────────────────────────────────────
async function initApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = '';

  try {
    const res = await apiFetch('/auth/me');
    if (res && res.ok) {
      const data = await res.json();
      currentUser = data.user || data;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  } catch (_) {}

  if (currentUser) {
    const shortName = (currentUser.name || currentUser.email || '').split(' ')[0];
    const nameEl = document.getElementById('user-name-short');
    if (nameEl) nameEl.textContent = 'Hi, ' + shortName + ' 👋';
    const profileName  = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    if (profileName)  profileName.value  = currentUser.name  || '';
    if (profileEmail) profileEmail.value = currentUser.email || '';
  }

  await loadTransactions();
  await loadSplits();
  renderCatGrid();
  renderHeader();
  renderSummary();
  renderHistory();
  renderSettings();
  renderBalances();
}

// ── TRANSACTIONS ─────────────────────────────────────────────────────
async function loadTransactions() {
  try {
    const res = await apiFetch('/expenses');
    if (res && res.ok) {
      const data = await res.json();
      transactions = Array.isArray(data) ? data : (data.expenses || []);
    }
  } catch (_) {}
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel() {
  return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function thisMonthTx() {
  const key = currentMonthKey();
  return transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return m === key;
  });
}

function renderHeader() {
  const monthEl = document.getElementById('month-label');
  if (monthEl) monthEl.textContent = monthLabel();

  const txs     = thisMonthTx();
  const spent   = txs.reduce((s, t) => s + (t.amount || 0), 0);
  const budget  = (currentUser && currentUser.budget && currentUser.budget.monthly) || 5000;
  const remaining = budget - spent;
  const pct     = Math.min(100, Math.round((spent / budget) * 100));

  const spentEl = document.getElementById('spent-amount');
  if (spentEl) spentEl.textContent = '₹' + spent.toLocaleString('en-IN');

  const remEl = document.getElementById('remaining-amount');
  if (remEl) {
    remEl.textContent = '₹' + Math.abs(remaining).toLocaleString('en-IN');
    remEl.style.color = remaining < 0 ? 'var(--danger)' : remaining < budget * 0.2 ? 'var(--warning)' : 'var(--success)';
  }

  const bar = document.getElementById('budget-progress');
  if (bar) {
    bar.style.width      = pct + '%';
    bar.style.background = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--success)';
  }

  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const metaEl = document.getElementById('budget-meta');
  if (metaEl) metaEl.textContent = `₹${budget.toLocaleString('en-IN')} budget • ${pct}% used • ${daysLeft} days left`;
}

function renderCatGrid() {
  const grid = document.getElementById('cat-grid');
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(c => `
    <button class="cat-btn ${c.id === selectedCat ? 'selected' : ''}"
      data-cat="${c.id}" onclick="selectCat(this)">
      <span class="emoji">${c.emoji}</span>${c.label}
    </button>
  `).join('');
}

function selectCat(btn) {
  selectedCat = btn.dataset.cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function selectPay(btn) {
  selectedPay = btn.dataset.pay;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function addExpense() {
  const amountEl = document.getElementById('amount');
  const amount   = parseFloat(amountEl.value);
  if (!amount || amount <= 0) { toast('Enter a valid amount'); amountEl.focus(); return; }

  const note = document.getElementById('note').value.trim();
  const cat  = CATEGORIES.find(c => c.id === selectedCat);

  const body = {
    amount,
    category: selectedCat,
    payment:  selectedPay,
    note:     note || cat.label,
    date:     new Date().toISOString(),
  };

  try {
    const res = await apiFetch('/expenses', { method: 'POST', body });
    if (!res || !res.ok) { toast('Failed to save expense'); return; }
    const saved = await res.json();
    transactions.unshift(saved.expense || saved);
  } catch (_) {
    toast('Network error'); return;
  }

  amountEl.value = '';
  document.getElementById('note').value = '';

  renderHeader();
  renderSummary();
  renderHistory();
  toast(`₹${amount} logged ✓`);
}

async function renderSummary() {
  // Category breakdown
  const txs       = thisMonthTx();
  const container = document.getElementById('cat-breakdown');

  if (container) {
    if (txs.length === 0) {
      container.innerHTML = '<div class="empty"><div class="icon">📊</div><p>No expenses yet this month</p></div>';
    } else {
      const totals     = {};
      txs.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
      const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

      container.innerHTML = CATEGORIES
        .filter(c => totals[c.id])
        .sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))
        .map(c => {
          const amt = totals[c.id] || 0;
          const pct = Math.round((amt / grandTotal) * 100);
          return `
            <div class="cat-row">
              <div class="cat-emoji">${c.emoji}</div>
              <div class="cat-info">
                <div class="cat-name">${c.label}</div>
                <div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
              </div>
              <div>
                <div class="cat-amount">₹${amt.toLocaleString('en-IN')}</div>
                <div class="cat-pct">${pct}%</div>
              </div>
            </div>`;
        }).join('');
    }
  }

  // 6-month trend chart using /expenses/summary
  const chartEl  = document.getElementById('trend-chart');
  const labelsEl = document.getElementById('trend-labels');
  if (!chartEl || !labelsEl) return;

  let monthlyTotals = [];
  try {
    const res = await apiFetch('/expenses/summary');
    if (res && res.ok) {
      const data = await res.json();
      monthlyTotals = Array.isArray(data) ? data : (data.monthly || data.summary || []);
    }
  } catch (_) {}

  // Build last 6 months if API didn't return enough
  if (!monthlyTotals.length) {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = transactions
        .filter(t => {
          const td = new Date(t.date || t.createdAt);
          return `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}` === key;
        })
        .reduce((s, t) => s + (t.amount || 0), 0);
      monthlyTotals.push({ month: key, total });
    }
  }

  // Keep last 6
  const last6  = monthlyTotals.slice(-6);
  const maxVal = Math.max(...last6.map(m => m.total || 0), 1);

  chartEl.innerHTML = last6.map(m => {
    const pct   = Math.round(((m.total || 0) / maxVal) * 100);
    const label = (() => {
      const [y, mo] = (m.month || '').split('-');
      if (!y || !mo) return '';
      return new Date(+y, +mo - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
    })();
    return `
      <div class="chart-bar-col" style="display:inline-flex;flex-direction:column;align-items:center;flex:1;gap:4px;">
        <div style="font-size:11px;color:var(--text-muted);">₹${(m.total||0).toLocaleString('en-IN')}</div>
        <div class="chart-bar" style="width:100%;height:${Math.max(pct * 0.6, 2)}px;background:var(--primary);border-radius:3px 3px 0 0;"></div>
      </div>`;
  }).join('');
  chartEl.style.display        = 'flex';
  chartEl.style.alignItems     = 'flex-end';
  chartEl.style.gap            = '4px';
  chartEl.style.height         = '80px';
  chartEl.style.marginBottom   = '4px';

  labelsEl.innerHTML = last6.map(m => {
    const [y, mo] = (m.month || '').split('-');
    const label   = (!y || !mo) ? '' : new Date(+y, +mo - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
    return `<div style="flex:1;text-align:center;">${label}</div>`;
  }).join('');
  labelsEl.style.display = 'flex';
}

function renderHistory() {
  const container = document.getElementById('tx-list');
  if (!container) return;
  const txs = thisMonthTx();

  if (txs.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">🧾</div><p>No transactions yet</p></div>';
    return;
  }

  container.innerHTML = txs.map(t => {
    const cat     = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[7];
    const d       = new Date(t.date || t.createdAt);
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const id      = t._id || t.id;
    return `
      <div class="tx-item">
        <div class="tx-emoji">${cat.emoji}</div>
        <div class="tx-info">
          <div class="tx-note">${t.note || cat.label}</div>
          <div class="tx-meta">${dateStr}, ${timeStr} · ${t.payment || ''}</div>
        </div>
        <div class="tx-amount">₹${(t.amount || 0).toLocaleString('en-IN')}</div>
        <button class="tx-delete" onclick="deleteTransaction('${id}')" title="Delete">✕</button>
      </div>`;
  }).join('');
}

async function deleteTransaction(id) {
  try {
    const res = await apiFetch('/expenses/' + id, { method: 'DELETE' });
    if (!res || !res.ok) { toast('Failed to delete'); return; }
  } catch (_) {
    toast('Network error'); return;
  }
  transactions = transactions.filter(t => (t._id || t.id) !== id);
  renderHeader();
  renderSummary();
  renderHistory();
  toast('Transaction removed');
}

async function renderSettings() {
  const budget = (currentUser && currentUser.budget) || { monthly: 5000, categories: {} };
  const container = document.getElementById('budget-settings');
  if (!container) return;

  container.innerHTML = `
    <div class="setting-row">
      <div class="setting-label">Monthly total</div>
      <input class="setting-input" type="number" value="${budget.monthly || 5000}"
        onchange="updateBudget('monthly', this.value)">
    </div>
    ${CATEGORIES.map(c => `
      <div class="setting-row">
        <div class="setting-label">${c.emoji} ${c.label}</div>
        <input class="setting-input" type="number" value="${(budget.categories && budget.categories[c.id]) || 0}"
          onchange="updateBudget('cat:${c.id}', this.value)">
      </div>
    `).join('')}
  `;
}

async function updateBudget(key, value) {
  const val = parseInt(value) || 0;
  if (!currentUser) return;
  currentUser.budget = currentUser.budget || { monthly: 5000, categories: {} };
  if (key === 'monthly') {
    currentUser.budget.monthly = val;
  } else {
    currentUser.budget.categories = currentUser.budget.categories || {};
    currentUser.budget.categories[key.replace('cat:', '')] = val;
  }
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  try {
    await apiFetch('/auth/profile', { method: 'PUT', body: { budget: currentUser.budget } });
  } catch (_) {}
  renderHeader();
}

async function updateProfile() {
  const name  = (document.getElementById('profile-name')  || {}).value || '';
  const email = (document.getElementById('profile-email') || {}).value || '';
  if (!name || !email) { toast('Name and email required'); return; }
  try {
    const res = await apiFetch('/auth/profile', { method: 'PUT', body: { name, email } });
    if (!res || !res.ok) { toast('Update failed'); return; }
    currentUser = { ...currentUser, name, email };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    toast('Profile updated ✓');
  } catch (_) {
    toast('Network error');
  }
}

async function changePassword() {
  const curPass = (document.getElementById('cur-pass') || {}).value || '';
  const newPass = (document.getElementById('new-pass') || {}).value || '';
  if (!curPass || !newPass) { toast('Fill in both fields'); return; }
  if (newPass.length < 6) { toast('New password too short'); return; }
  try {
    const res = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: { currentPassword: curPass, newPassword: newPass },
    });
    if (!res || !res.ok) {
      const d = await res.json().catch(() => ({}));
      toast(d.message || 'Failed to change password'); return;
    }
    document.getElementById('cur-pass').value = '';
    document.getElementById('new-pass').value = '';
    toast('Password changed ✓');
  } catch (_) {
    toast('Network error');
  }
}

async function clearMonth() {
  if (!confirm(`Clear all transactions for ${monthLabel()}? This cannot be undone.`)) return;
  const key = currentMonthKey();
  const toDelete = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === key;
  });
  for (const t of toDelete) {
    try { await apiFetch('/expenses/' + (t._id || t.id), { method: 'DELETE' }); } catch (_) {}
  }
  transactions = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` !== key;
  });
  renderHeader();
  renderSummary();
  renderHistory();
  toast('Month cleared');
}

function exportBackup() {
  const backup = { transactions, exportedAt: new Date().toISOString() };
  const blob   = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `expenses-backup-${currentMonthKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── TAB SWITCHING ────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'summary')  renderSummary();
  if (name === 'history')  renderHistory();
  if (name === 'settings') renderSettings();
  if (name === 'splits')   { renderBalances(); renderSplits(); }
}

// ── TOAST ────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── PWA INSTALL ──────────────────────────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.style.display = '';
    banner.innerHTML = `
      <p style="font-size:14px;font-weight:500;margin-bottom:8px;">Install Expense Tracker for quick access</p>
      <button onclick="installPWA()" style="padding:10px 20px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font);margin-right:8px;">Install</button>
      <button onclick="document.getElementById('install-banner').style.display='none'" style="padding:10px 16px;background:transparent;color:var(--text-muted);border:none;font-size:14px;cursor:pointer;font-family:var(--font);">Not now</button>
    `;
  }
});

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
  });
}

// ── SPLITS & SETTLE ──────────────────────────────────────────────────
const MODE_CONFIG = {
  'split-ipaid': {
    label:       'Split (I paid)',
    description: 'You paid for a group — others owe you their share',
    showPeople:  true,
    singleLabel: null,
  },
  'split-theypaid': {
    label:       'Split (They paid)',
    description: 'Someone else paid — you owe your share',
    showPeople:  true,
    singleLabel: null,
  },
  'lend': {
    label:       'Lend',
    description: 'You lent money to someone',
    showPeople:  false,
    singleLabel: 'Borrower',
  },
  'borrow': {
    label:       'Borrow',
    description: 'You borrowed money from someone',
    showPeople:  false,
    singleLabel: 'Lender',
  },
};

function setMode(mode) {
  splitMode = mode;
  const cfg = MODE_CONFIG[mode];
  const peopleSection = document.getElementById('split-people-section');
  const singleSection = document.getElementById('single-person-section');
  const personLabel   = document.getElementById('person-label');

  if (cfg.showPeople) {
    if (peopleSection) peopleSection.style.display = '';
    if (singleSection) singleSection.style.display = 'none';
  } else {
    if (peopleSection) peopleSection.style.display = 'none';
    if (singleSection) singleSection.style.display = '';
    if (personLabel)   personLabel.textContent = cfg.singleLabel;
  }
  updateSplitPreview();
}

function addParticipant() {
  const input = document.getElementById('participant-input');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  if (participants.includes(name)) { toast('Already added'); return; }
  participants.push(name);
  input.value = '';
  renderParticipantTags();
  updateSplitPreview();
}

function removeParticipant(name) {
  participants = participants.filter(p => p !== name);
  renderParticipantTags();
  updateSplitPreview();
}

function renderParticipantTags() {
  const el = document.getElementById('participants-list');
  if (!el) return;
  if (participants.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">` +
    participants.map(p => `
      <span style="display:inline-flex;align-items:center;gap:4px;background:var(--primary-light);color:var(--primary);padding:4px 10px;border-radius:20px;font-size:13px;font-weight:500;">
        ${p}
        <button onclick="removeParticipant('${p}')" style="background:none;border:none;cursor:pointer;color:var(--primary);font-size:14px;line-height:1;padding:0;">×</button>
      </span>`).join('') +
    `</div>`;
}

function updateSplitPreview() {
  const el     = document.getElementById('split-preview');
  if (!el) return;
  const amount = parseFloat((document.getElementById('split-amount') || {}).value) || 0;
  if (!amount) { el.textContent = ''; return; }

  const cfg = MODE_CONFIG[splitMode];
  if (cfg.showPeople) {
    const count = participants.length + 1; // +1 for self
    if (count < 2) { el.textContent = 'Add at least one participant'; return; }
    const share = (amount / count).toFixed(2);
    if (splitMode === 'split-ipaid') {
      el.textContent = `Each person owes you ₹${share} (${count} people total)`;
    } else {
      el.textContent = `Your share is ₹${share} (${count} people total)`;
    }
  } else {
    const person = (document.getElementById('single-person') || {}).value || 'person';
    if (splitMode === 'lend') {
      el.textContent = `${person || 'Person'} owes you ₹${amount.toFixed(2)}`;
    } else {
      el.textContent = `You owe ${person || 'person'} ₹${amount.toFixed(2)}`;
    }
  }
}

async function addSplit() {
  const desc   = (document.getElementById('split-desc')   || {}).value || '';
  const amount = parseFloat((document.getElementById('split-amount') || {}).value) || 0;
  const due    = (document.getElementById('split-due')    || {}).value || '';

  if (!desc)   { toast('Enter a description'); return; }
  if (!amount) { toast('Enter an amount');     return; }

  const cfg = MODE_CONFIG[splitMode];
  let people = [];

  if (cfg.showPeople) {
    if (participants.length === 0) { toast('Add at least one participant'); return; }
    const share = parseFloat((amount / (participants.length + 1)).toFixed(2));
    people = participants.map(name => ({ name, share, settled: false }));
  } else {
    const personEl = document.getElementById('single-person');
    const name     = personEl ? personEl.value.trim() : '';
    if (!name) { toast('Enter a person name'); return; }
    people = [{ name, share: amount, settled: false }];
  }

  const body = { description: desc, amount, mode: splitMode, people, dueDate: due || undefined };

  try {
    const res = await apiFetch('/splits', { method: 'POST', body });
    if (!res || !res.ok) { toast('Failed to save split'); return; }
    const saved = await res.json();
    splits.unshift(saved.split || saved);
  } catch (_) {
    toast('Network error'); return;
  }

  // Reset form
  document.getElementById('split-desc').value   = '';
  document.getElementById('split-amount').value = '';
  if (document.getElementById('split-due')) document.getElementById('split-due').value = '';
  participants = [];
  renderParticipantTags();
  const singleEl = document.getElementById('single-person');
  if (singleEl) singleEl.value = '';
  document.getElementById('split-preview').textContent = '';

  renderBalances();
  renderSplits();
  toast('Split added ✓');
}

async function loadSplits() {
  try {
    const res = await apiFetch('/splits');
    if (res && res.ok) {
      const data = await res.json();
      splits = Array.isArray(data) ? data : (data.splits || []);
    }
  } catch (_) {}
}

async function settlePerson(splitId, name) {
  try {
    const res = await apiFetch(`/splits/${splitId}/settle`, {
      method: 'POST',
      body: { name },
    });
    if (!res || !res.ok) { toast('Failed to settle'); return; }
    const updated = await res.json();
    const idx = splits.findIndex(s => (s._id || s.id) === splitId);
    if (idx !== -1) splits[idx] = updated.split || updated;
  } catch (_) {
    toast('Network error'); return;
  }
  renderBalances();
  renderSplits();
  toast(`Settled with ${name} ✓`);
}

async function deleteSplit(id) {
  if (!confirm('Delete this split?')) return;
  try {
    const res = await apiFetch('/splits/' + id, { method: 'DELETE' });
    if (!res || !res.ok) { toast('Failed to delete'); return; }
  } catch (_) {
    toast('Network error'); return;
  }
  splits = splits.filter(s => (s._id || s.id) !== id);
  renderBalances();
  renderSplits();
  toast('Split deleted');
}

function renderBalances() {
  const container = document.getElementById('balance-summary');
  if (!container) return;

  // Compute net balances per person
  const balances = {};
  splits.forEach(s => {
    (s.people || []).forEach(p => {
      if (p.settled) return;
      balances[p.name] = (balances[p.name] || 0);
      if (s.mode === 'split-ipaid' || s.mode === 'lend') {
        balances[p.name] += p.share; // they owe me
      } else {
        balances[p.name] -= p.share; // I owe them
      }
    });
  });

  const names = Object.keys(balances);
  if (names.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">🤝</div><p>All settled up!</p></div>';
    return;
  }

  container.innerHTML = names.map(name => balanceRow(name, balances[name], balances[name] > 0)).join('');
}

function balanceRow(name, balance, owesMe) {
  const abs   = Math.abs(balance).toLocaleString('en-IN');
  const color = owesMe ? 'var(--success)' : 'var(--danger)';
  const label = owesMe ? `${name} owes you ₹${abs}` : `You owe ${name} ₹${abs}`;
  return `
    <div class="split-item">
      <div>
        <div style="font-size:14px;font-weight:500;">${name}</div>
        <div style="font-size:12px;color:${color};margin-top:2px;">${label}</div>
      </div>
      <div style="font-size:15px;font-weight:700;color:${color};">${owesMe ? '+' : '-'}₹${abs}</div>
    </div>`;
}

function renderSplits() {
  const container = document.getElementById('splits-list');
  if (!container) return;

  if (splits.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">📋</div><p>No splits recorded</p></div>';
    return;
  }

  container.innerHTML = splits.map(s => {
    const id      = s._id || s.id;
    const date    = new Date(s.createdAt || s.date || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const modeLabel = (MODE_CONFIG[s.mode] || {}).label || s.mode || '';
    const peopleHtml = (s.people || []).map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F1F5F9;">
        <div>
          <span style="font-size:13px;">${p.name}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:6px;">₹${(p.share||0).toLocaleString('en-IN')}</span>
          ${p.settled ? '<span style="font-size:11px;color:var(--success);margin-left:6px;">✓ settled</span>' : ''}
        </div>
        ${!p.settled ? `<button onclick="settlePerson('${id}','${p.name}')" style="font-size:12px;padding:4px 10px;background:var(--primary-light);color:var(--primary);border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-weight:500;">Settle</button>` : ''}
      </div>`).join('');

    return `
      <div style="padding:12px 0;border-bottom:1px solid #F1F5F9;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div>
            <div style="font-size:14px;font-weight:600;">${s.description || ''}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${modeLabel} · ${date} · ₹${(s.amount||0).toLocaleString('en-IN')}</div>
          </div>
          <button onclick="deleteSplit('${id}')" style="background:none;border:none;cursor:pointer;color:#CBD5E1;font-size:16px;padding:4px;" title="Delete">✕</button>
        </div>
        ${peopleHtml}
      </div>`;
  }).join('');
}

// ── STARTUP ──────────────────────────────────────────────────────────
if (accessToken && currentUser) {
  initApp();
} else {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display  = 'none';
}
