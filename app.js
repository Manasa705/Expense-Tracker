// ── CONFIG ──────────────────────────────────────────────────────────
const API = 'https://expense-tracker-y3f6.onrender.com/api';

// ── CATEGORIES ─────────────────────────────────────────────────────
const CATEGORIES = [
    { id: 'food',       emoji: '🍕', label: 'Food' },
    { id: 'transport',  emoji: '🚌', label: 'Transport' },
    { id: 'academic',   emoji: '📚', label: 'Academic' },
    { id: 'personal',   emoji: '🎮', label: 'Personal' },
    { id: 'social',     emoji: '👥', label: 'Social' },
    { id: 'health',     emoji: '🏥', label: 'Health' },
    { id: 'subscript',  emoji: '📱', label: 'Subscriptions' },
    { id: 'other',      emoji: '❓', label: 'Other' },
];

// ── DEFAULT DATA ────────────────────────────────────────────────────
const defaultBudget = {
    monthly: 5000,
    categories: { food: 2000, transport: 800, academic: 500, personal: 700, social: 500, health: 300, subscript: 200, other: 0 }
};

// ── STATE ───────────────────────────────────────────────────────────
let budget = load('college-hub:budget', defaultBudget);
let transactions = load('college-hub:transactions', []);
let selectedCat = 'food';
let selectedPay = 'UPI';

// ── MONTH HELPERS ───────────────────────────────────────────────────
function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel() {
    return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function thisMonthTx() {
    const key = currentMonthKey();
    return transactions.filter(t => t.month === key);
}

// ── RENDER HEADER ───────────────────────────────────────────────────
function renderHeader() {
    document.getElementById('month-label').textContent = monthLabel();

    const txs = thisMonthTx();
    const spent = txs.reduce((s, t) => s + t.amount, 0);
    const remaining = budget.monthly - spent;
    const pct = Math.min(100, Math.round((spent / budget.monthly) * 100));

    document.getElementById('spent-amount').textContent = `₹${spent.toLocaleString('en-IN')}`;

    const remEl = document.getElementById('remaining-amount');
    remEl.textContent = `₹${Math.abs(remaining).toLocaleString('en-IN')}`;
    remEl.style.color = remaining < 0 ? 'var(--danger)' : remaining < budget.monthly * 0.2 ? 'var(--warning)' : 'var(--success)';

    const bar = document.getElementById('budget-progress');
    bar.style.width = pct + '%';
    bar.style.background = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--success)';

    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
    document.getElementById('budget-meta').textContent =
        `₹${budget.monthly.toLocaleString('en-IN')} budget • ${pct}% used • ${daysLeft} days left`;
}

// ── RENDER CATEGORY GRID ────────────────────────────────────────────
function renderCatGrid() {
    const grid = document.getElementById('cat-grid');
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

// ── ADD EXPENSE ─────────────────────────────────────────────────────
function addExpense() {
    const amountEl = document.getElementById('amount');
    const amount = parseFloat(amountEl.value);
    if (!amount || amount <= 0) { toast('Enter a valid amount'); amountEl.focus(); return; }

    const note = document.getElementById('note').value.trim();
    const cat = CATEGORIES.find(c => c.id === selectedCat);

    const tx = {
        id: Date.now(),
        amount,
        category: selectedCat,
        payment: selectedPay,
        note: note || cat.label,
        date: new Date().toISOString(),
        month: currentMonthKey()
    };

    transactions.unshift(tx);
    save('college-hub:transactions', transactions);

    // Reset form
    amountEl.value = '';
    document.getElementById('note').value = '';

    renderHeader();
    renderSummary();
    renderHistory();
    toast(`₹${amount} logged ✓`);
}

// ── RENDER SUMMARY ──────────────────────────────────────────────────
function renderSummary() {
    const txs = thisMonthTx();
    const container = document.getElementById('cat-breakdown');

    if (txs.length === 0) {
        container.innerHTML = '<div class="empty"><div class="icon">📊</div><p>No expenses yet this month</p></div>';
        return;
    }

    const totals = {};
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

// ── RENDER HISTORY ──────────────────────────────────────────────────
function renderHistory() {
    const container = document.getElementById('tx-list');
    const txs = thisMonthTx();

    if (txs.length === 0) {
        container.innerHTML = '<div class="empty"><div class="icon">🧾</div><p>No transactions yet</p></div>';
        return;
    }

    container.innerHTML = txs.map(t => {
        const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[7];
        const d = new Date(t.date);
        const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return `
            <div class="tx-item">
                <div class="tx-emoji">${cat.emoji}</div>
                <div class="tx-info">
                    <div class="tx-note">${t.note}</div>
                    <div class="tx-meta">${dateStr}, ${timeStr} · ${t.payment}</div>
                </div>
                <div class="tx-amount">₹${t.amount.toLocaleString('en-IN')}</div>
                <button class="tx-delete" onclick="deleteTransaction(${t.id})" title="Delete">✕</button>
            </div>`;
    }).join('');
}

// ── DELETE TRANSACTION ──────────────────────────────────────────────
function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    save('college-hub:transactions', transactions);
    renderHeader();
    renderSummary();
    renderHistory();
    toast('Transaction removed');
}

// ── RENDER SETTINGS ─────────────────────────────────────────────────
function renderSettings() {
    const container = document.getElementById('budget-settings');
    container.innerHTML = `
        <div class="setting-row">
            <div class="setting-label">Monthly total</div>
            <input class="setting-input" type="number" value="${budget.monthly}"
                onchange="updateBudget('monthly', this.value)">
        </div>
        ${CATEGORIES.map(c => `
            <div class="setting-row">
                <div class="setting-label">${c.emoji} ${c.label}</div>
                <input class="setting-input" type="number" value="${budget.categories[c.id] || 0}"
                    onchange="updateBudget('cat:${c.id}', this.value)">
            </div>
        `).join('')}
    `;
}

function updateBudget(key, value) {
    const val = parseInt(value) || 0;
    if (key === 'monthly') {
        budget.monthly = val;
    } else {
        const catId = key.replace('cat:', '');
        budget.categories[catId] = val;
    }
    save('college-hub:budget', budget);
    renderHeader();
}

// ── CLEAR MONTH ─────────────────────────────────────────────────────
function clearMonth() {
    if (!confirm(`Clear all transactions for ${monthLabel()}? This cannot be undone.`)) return;
    const key = currentMonthKey();
    transactions = transactions.filter(t => t.month !== key);
    save('college-hub:transactions', transactions);
    renderHeader();
    renderSummary();
    renderHistory();
    toast('Month cleared');
}

// ── EXPORT BACKUP ───────────────────────────────────────────────────
function exportBackup() {
    const backup = { budget, transactions, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-backup-${currentMonthKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── TAB SWITCHING ───────────────────────────────────────────────────
function switchTab(name, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    btn.classList.add('active');
    if (name === 'summary') renderSummary();
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
}

// ── TOAST ───────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── INIT ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    renderCatGrid();
    renderSummary();
    renderHistory();
});
