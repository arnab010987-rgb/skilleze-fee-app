/**
 * SKILLEZE TECHNOLOGIES — Fee Payment Management System
 * Main Application Script (script.js)
 * 
 * Handles: Navigation, Dashboard, Students, Payments,
 *          Installments, Reports, Settings, Receipts
 */

'use strict';

// ============================================================
// APP STATE
// ============================================================
const App = {
  currentPage: 'dashboard',
  currentStudentId: null,
  viewingStudentId: null,
  editingStudentId: null,
  receiptData: null,
  studentFilter: 'All',
  studentSearch: '',
  installmentFilter: 'All',
};

// ============================================================
// DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initSidebar();
  initModals();
  updateTopbarDate();

  // Load dashboard immediately from cache / local data — 0ms instant render
  navigateTo('dashboard');

  // Check Sheets connection in background (non-blocking)
  checkSheetsConnection().then(connected => {
    const statusText = document.getElementById('topbar-status-text');
    const statusDot = document.querySelector('.topbar-status .status-dot');
    if (connected) {
      if (statusText) statusText.textContent = 'Sheets Live';
      if (statusDot) statusDot.style.background = 'var(--success)';
      showToast('success', 'Connected', 'Google Sheets connected successfully.');
      // Refresh current dashboard view in-place if user is still on dashboard
      if (App.currentPage === 'dashboard') {
        const cached = typeof getCachedDashboard === 'function' ? getCachedDashboard() : null;
        if (cached) {
          renderDashboardStats(cached);
          renderRecentPayments(cached.recentPayments || []);
          renderOverdueInstallments(cached.overdueInstallments || [], cached.overdueCount || 0);
          renderUpcomingInstallments(cached.upcomingInstallments || []);
          renderCollectionChart(cached);
        }
      }
    } else {
      if (statusText) statusText.textContent = 'Local Mode';
      if (statusDot) statusDot.style.background = 'var(--accent)';
      showToast('info', 'Ready', 'System loaded in Local Mode. Connect Google Sheets in Settings to sync online.');
    }
  });
});

// ============================================================
// NAVIGATION
// ============================================================
function initNavigation() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      navigateTo(page);
      // Close sidebar on mobile
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

function navigateTo(page) {
  App.currentPage = page;

  // Update nav active state
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-page') === page);
  });

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    students: 'Student Management',
    payments: 'Payment Records',
    installments: 'Installments',
    reports: 'Reports',
    settings: 'Settings',
    'student-profile': 'Student Profile',
    receipt: 'Fee Receipt'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Render page
  const container = document.getElementById('page-container');
  container.innerHTML = '';
  container.className = 'page-content page-section';

  switch (page) {
    case 'dashboard':    renderDashboard(container); break;
    case 'students':     renderStudents(container); break;
    case 'payments':     renderPayments(container); break;
    case 'installments': renderInstallments(container); break;
    case 'reports':      renderReports(container); break;
    case 'settings':     renderSettings(container); break;
    case 'student-profile': renderStudentProfile(container, App.viewingStudentId); break;
    case 'receipt':      renderReceiptPage(container); break;
  }
}

// ============================================================
// SIDEBAR (Mobile)
// ============================================================
function initSidebar() {
  const hamburger = document.getElementById('hamburger-btn');
  const overlay = document.getElementById('sidebar-overlay');
  if (hamburger) hamburger.addEventListener('click', toggleSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('visible');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
}

// ============================================================
// DATE IN TOPBAR
// ============================================================
function updateTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-dismiss" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn .3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================
// LOADING OVERLAY
// ============================================================
function showLoading(text = 'Loading...') {
  const el = document.getElementById('loading-overlay');
  if (el) {
    el.querySelector('.loading-text').textContent = text;
    el.classList.add('show');
  }
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.remove('show');
}

// ============================================================
// MODAL MANAGEMENT (Anchored to body / #modals-root)
// ============================================================
function initModals() {
  const root = document.getElementById('modals-root');
  if (root && (!root.innerHTML || root.innerHTML.trim() === '')) {
    root.innerHTML = `
      ${renderAddStudentModal()}
      ${renderPaymentModal()}
      ${renderEditStudentModal()}
      ${renderDeleteConfirmModal()}
    `;
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}

function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.add('open');
    const pageContent = document.querySelector('.page-content');
    if (pageContent) pageContent.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.remove('open');
    const pageContent = document.querySelector('.page-content');
    if (pageContent) pageContent.style.overflow = 'auto';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
  const pageContent = document.querySelector('.page-content');
  if (pageContent) pageContent.style.overflow = 'auto';
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard(container) {
  const cached = typeof getCachedDashboard === 'function' ? getCachedDashboard() : null;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>📊 Dashboard Overview</h1>
        <p>Welcome to Skilleze Fee Management System</p>
      </div>
      <button class="btn btn-outline" id="btn-refresh-dashboard" onclick="refreshDashboard()">
        🔄 Refresh
      </button>
    </div>
    <div id="dashboard-stats" class="stats-grid">
      ${cached ? '' : [1,2,3,4,5,6,7].map(() => `<div class="stat-card stat-blue" style="min-height:100px;"><div class="spinner spinner-sm" style="margin:auto"></div></div>`).join('')}
    </div>
    <div class="dashboard-grid">
      <div>
        <div class="card mb-6">
          <div class="card-header">
            <div class="card-title">💰 Recent Payments</div>
            <button class="btn btn-sm btn-outline" onclick="navigateTo('payments')">View All</button>
          </div>
          <div id="recent-payments-list" class="card-body" style="padding:0">
            ${cached ? '' : '<div style="padding:2rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">⏰ Overdue Installments</div>
            <span id="overdue-badge" class="badge badge-danger">—</span>
          </div>
          <div id="overdue-list" class="card-body" style="padding:0">
            ${cached ? '' : '<div style="padding:2rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>'}
          </div>
        </div>
      </div>
      <div>
        <div class="card mb-6">
          <div class="card-header">
            <div class="card-title">📅 Due Soon (7 Days)</div>
          </div>
          <div id="upcoming-list" class="card-body" style="padding:0">
            ${cached ? '' : '<div style="padding:2rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">📈 Fee Collection</div>
          </div>
          <div class="card-body" id="collection-chart">
            ${cached ? '' : '<div style="padding:1rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>'}
          </div>
        </div>
      </div>
    </div>
  `;

  if (cached) {
    renderDashboardStats(cached);
    renderRecentPayments(cached.recentPayments || []);
    renderOverdueInstallments(cached.overdueInstallments || [], cached.overdueCount || 0);
    renderUpcomingInstallments(cached.upcomingInstallments || []);
    renderCollectionChart(cached);
  }

  try {
    const data = await getDashboard();
    if (App.currentPage === 'dashboard') {
      renderDashboardStats(data);
      renderRecentPayments(data.recentPayments || []);
      renderOverdueInstallments(data.overdueInstallments || [], data.overdueCount || 0);
      renderUpcomingInstallments(data.upcomingInstallments || []);
      renderCollectionChart(data);
    }
  } catch (err) {
    console.error('Dashboard error:', err);
    if (!cached) {
      showToast('error', 'Error', 'Failed to load dashboard data.');
    }
  }
}

async function refreshDashboard() {
  const btn = document.getElementById('btn-refresh-dashboard');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm" style="margin-right:6px"></span> Syncing...';
  }
  try {
    const data = await getDashboard({ forceRefresh: true });
    if (App.currentPage === 'dashboard') {
      renderDashboardStats(data);
      renderRecentPayments(data.recentPayments || []);
      renderOverdueInstallments(data.overdueInstallments || [], data.overdueCount || 0);
      renderUpcomingInstallments(data.upcomingInstallments || []);
      renderCollectionChart(data);
    }
    showToast('success', 'Updated', 'Dashboard synchronized with Google Sheets.');
  } catch (err) {
    showToast('error', 'Sync Failed', 'Could not refresh from Google Sheets.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Refresh';
    }
  }
}

function renderDashboardStats(data) {
  const statsEl = document.getElementById('dashboard-stats');
  if (!statsEl) return;

  const stats = [
    { label: 'Total Students', value: data.totalStudents || 0, icon: '👨‍🎓', color: 'blue', suffix: '' },
    { label: 'Total Course Fees', value: formatCurrency(data.totalFees || 0), icon: '💼', color: 'purple', suffix: '' },
    { label: 'Total Collected', value: formatCurrency(data.totalCollected || 0), icon: '✅', color: 'green', suffix: '' },
    { label: 'Total Pending', value: formatCurrency(data.totalPending || 0), icon: '⏳', color: 'orange', suffix: '' },
    { label: 'Due Today', value: data.dueTodayCount || 0, icon: '📅', color: 'red', suffix: '' },
    { label: 'Due This Week', value: data.upcomingCount || 0, icon: '🔔', color: 'teal', suffix: '' },
    { label: 'Overdue', value: data.overdueCount || 0, icon: '⚠️', color: 'red', suffix: '' },
  ];

  statsEl.innerHTML = stats.map(s => `
    <div class="stat-card stat-${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-info">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
      </div>
    </div>
  `).join('');
}

function renderRecentPayments(payments) {
  const el = document.getElementById('recent-payments-list');
  if (!el) return;

  if (!payments.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><h3>No Recent Payments</h3><p>Payments will appear here.</p></div>`;
    return;
  }

  el.innerHTML = payments.map(p => `
    <div class="activity-item" style="padding:0.75rem 1.25rem">
      <div class="activity-avatar">${getInitials(p.Student_Name)}</div>
      <div class="activity-info">
        <div class="activity-name">${p.Student_Name}</div>
        <div class="activity-detail">${p.Course} · ${p.Payment_Mode} · Inst. #${p.Installment_Number}</div>
      </div>
      <div style="text-align:right">
        <div class="activity-amount">${formatCurrency(p.Amount_Paid)}</div>
        <div class="activity-time">${formatDate(p.Payment_Date)}</div>
      </div>
    </div>
  `).join('');
}

function renderOverdueInstallments(installments, count) {
  const badge = document.getElementById('overdue-badge');
  if (badge) badge.textContent = count;

  const el = document.getElementById('overdue-list');
  if (!el) return;

  if (!installments.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><h3>No Overdue Installments</h3><p>All installments are on track!</p></div>`;
    return;
  }

  el.innerHTML = installments.map(i => `
    <div class="activity-item" style="padding:0.75rem 1.25rem">
      <div class="activity-avatar" style="background:linear-gradient(135deg,#ef4444,#dc2626)">${getInitials(i.Student_Name)}</div>
      <div class="activity-info">
        <div class="activity-name">${i.Student_Name}</div>
        <div class="activity-detail">${i.Course} · Due ${formatDate(i.Due_Date)}</div>
      </div>
      <div style="text-align:right">
        <div class="activity-amount" style="color:var(--danger)">${formatCurrency(i.Remaining_Amount)}</div>
        <div class="activity-time" style="color:var(--danger)">${i.Days_Overdue} days overdue</div>
      </div>
    </div>
  `).join('');
}

function renderUpcomingInstallments(installments) {
  const el = document.getElementById('upcoming-list');
  if (!el) return;

  if (!installments.length) {
    el.innerHTML = `<div class="empty-state" style="padding:1.5rem"><div class="empty-icon">📅</div><h3>No Upcoming</h3><p>No installments due this week.</p></div>`;
    return;
  }

  el.innerHTML = installments.map(i => `
    <div class="activity-item" style="padding:0.75rem 1.25rem">
      <div class="activity-avatar" style="background:linear-gradient(135deg,#f59e0b,#d97706)">${getInitials(i.Student_Name)}</div>
      <div class="activity-info">
        <div class="activity-name">${i.Student_Name}</div>
        <div class="activity-detail">Inst. #${i.Installment_Number} · ${formatDate(i.Due_Date)}</div>
      </div>
      <div class="activity-amount" style="color:var(--warning)">${formatCurrency(i.Installment_Amount)}</div>
    </div>
  `).join('');
}

function renderCollectionChart(data) {
  const el = document.getElementById('collection-chart');
  if (!el) return;

  const totalFee = parseFloat(data.totalFees) || 1;
  const collected = parseFloat(data.totalCollected) || 0;
  const pending = parseFloat(data.totalPending) || 0;
  const pct = Math.min(100, Math.round((collected / totalFee) * 100));

  el.innerHTML = `
    <div style="text-align:center;margin-bottom:1.25rem">
      <div style="font-size:2.5rem;font-weight:800;font-family:var(--font-heading);color:var(--primary-light)">${pct}%</div>
      <div style="font-size:0.8rem;color:var(--gray-400);margin-top:4px">Collection Rate</div>
    </div>
    <div style="background:var(--gray-100);border-radius:var(--radius-full);height:12px;overflow:hidden;margin-bottom:1.25rem">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary-light),var(--accent));border-radius:var(--radius-full);transition:width .8s ease"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:0.8rem">
      <span style="color:var(--success);font-weight:600">✓ Collected: ${formatCurrency(collected)}</span>
      <span style="color:var(--warning);font-weight:600">⏳ Pending: ${formatCurrency(pending)}</span>
    </div>
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gray-100)">
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.5rem">
        <span style="color:var(--gray-500)">Completed Students</span><span style="font-weight:700;color:var(--success)">${data.paidCount || 0}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.5rem">
        <span style="color:var(--gray-500)">Partial Payment</span><span style="font-weight:700;color:var(--warning)">${data.partialCount || 0}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.8rem">
        <span style="color:var(--gray-500)">Pending</span><span style="font-weight:700;color:var(--danger)">${data.pendingCount || 0}</span>
      </div>
    </div>
  `;
}

// ============================================================
// STUDENTS PAGE
// ============================================================
async function renderStudents(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>👨‍🎓 Student Management</h1>
        <p>Manage all student enrollments and fee details</p>
      </div>
      <button class="btn btn-primary" id="btn-add-student">+ Add Student</button>
    </div>

    <div class="card mb-6">
      <div class="card-body" style="padding:1rem 1.25rem">
        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
          <div class="search-bar" style="flex:1;min-width:200px">
            <span class="search-icon">🔍</span>
            <input type="text" id="student-search" placeholder="Search by name, ID, mobile, course..." value="${App.studentSearch}">
          </div>
          <div class="filter-tabs">
            ${['All','Completed','Partially Paid','Pending','Overdue'].map(f =>
              `<button class="filter-tab ${App.studentFilter === f ? 'active' : ''}" data-filter="${f}">${f}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">👥 All Students</div>
        <span id="student-count" class="badge badge-primary">Loading...</span>
      </div>
      <div class="table-wrapper">
        <div id="students-table-body">
          <div style="padding:3rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-add-student').addEventListener('click', openAddStudentModal);

  // Search
  const searchInput = document.getElementById('student-search');
  searchInput.addEventListener('input', debounce(() => {
    App.studentSearch = searchInput.value;
    loadStudentsTable();
  }, 300));

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      App.studentFilter = tab.getAttribute('data-filter');
      loadStudentsTable();
    });
  });

  initModals();
  await loadStudentsTable();
}

async function loadStudentsTable() {
  const tbody = document.getElementById('students-table-body');
  if (!tbody) return;

  if (!tbody.querySelector('table') && (!Array.isArray(_localStore.students) || _localStore.students.length === 0)) {
    tbody.innerHTML = `<div style="padding:3rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;
  }

  try {
    const students = await getStudents({ search: App.studentSearch, status: App.studentFilter });

    const countEl = document.getElementById('student-count');
    if (countEl) countEl.textContent = `${students.length} Students`;

    if (!students.length) {
      tbody.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👨‍🎓</div>
          <h3>No Students Found</h3>
          <p>Try adjusting your search or filter, or add a new student.</p>
        </div>`;
      return;
    }

    tbody.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Student</th>
            <th>Mobile</th>
            <th>Course</th>
            <th>Total Fee</th>
            <th>Paid</th>
            <th>Remaining</th>
            <th>Next Inst.</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => `
            <tr>
              <td><span style="font-family:monospace;font-size:0.8rem;color:var(--gray-500)">${s.Student_ID}</span></td>
              <td>
                <div style="display:flex;align-items:center;gap:0.625rem">
                  <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary-light),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;font-weight:700;flex-shrink:0">${getInitials(s.Student_Name)}</div>
                  <div>
                    <div style="font-weight:600;color:var(--gray-900)">${s.Student_Name}</div>
                    <div style="font-size:0.75rem;color:var(--gray-400)">${s.Email || '—'}</div>
                  </div>
                </div>
              </td>
              <td>${s.Mobile || '—'}</td>
              <td>${s.Course || '—'}</td>
              <td class="fw-600">${formatCurrency(s.Total_Fee)}</td>
              <td style="color:var(--success);font-weight:600">${formatCurrency(s.Total_Paid)}</td>
              <td style="color:${parseFloat(s.Remaining_Fee) > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:600">${formatCurrency(s.Remaining_Fee)}</td>
              <td>${parseFloat(s.Next_Installment_Amount) > 0 ? formatCurrency(s.Next_Installment_Amount) : '—'}</td>
              <td>${s.Next_Due_Date ? formatDate(s.Next_Due_Date) : '—'}</td>
              <td>${getStatusBadge(s.Payment_Status)}</td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-sm btn-outline" onclick="viewStudent('${s.Student_ID}')">👁 View</button>
                  <button class="btn btn-sm btn-outline-gray" onclick="editStudent('${s.Student_ID}')">✏️ Edit</button>
                  <button class="btn btn-sm btn-success" onclick="openRecordPayment('${s.Student_ID}')">💰 Pay</button>
                  <button class="btn btn-sm btn-danger" onclick="confirmDeleteStudent('${s.Student_ID}','${s.Student_Name}')">🗑 Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Error loading students:', err);
    tbody.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Failed to load students</h3><p>${err.message}</p></div>`;
  }
}

function getStatusBadge(status) {
  const map = {
    'Completed':     'badge-success',
    'Partially Paid':'badge-warning',
    'Pending':       'badge-gray',
    'Overdue':       'badge-danger',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status || 'Unknown'}</span>`;
}

function getInstallmentStatusBadge(status) {
  const map = {
    'Paid':       'badge-success',
    'Completed':  'badge-success',
    'Upcoming':   'badge-gray',
    'Due Soon':   'badge-warning',
    'Due Today':  'badge-orange',
    'Overdue':    'badge-danger',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status || 'Unknown'}</span>`;
}

// ============================================================
// ADD STUDENT MODAL
// ============================================================
function renderAddStudentModal() {
  return `
  <div class="modal-overlay" id="modal-add-student">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title">➕ Add New Student</div>
        <button class="modal-close" onclick="closeModal('modal-add-student')">✕</button>
      </div>
      <div class="modal-body">
        <form id="form-add-student" novalidate>
          <div style="background:var(--info-light);border-radius:var(--radius-md);padding:0.75rem 1rem;margin-bottom:1.25rem;font-size:0.8rem;color:var(--info-dark)">
            📋 Fields marked with <span style="color:var(--danger)">*</span> are required.
          </div>

          <div style="font-weight:700;color:var(--gray-700);margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--gray-200)">👤 Personal Information</div>
          <div class="form-grid" style="margin-bottom:1.25rem">
            <div class="form-group">
              <label class="form-label">Student Name <span class="required">*</span></label>
              <input type="text" id="add-name" class="form-control" placeholder="Full Name" required>
              <span class="form-error d-none" id="err-name"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Mobile Number <span class="required">*</span></label>
              <input type="tel" id="add-mobile" class="form-control" placeholder="10-digit mobile" required>
              <span class="form-error d-none" id="err-mobile"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="add-email" class="form-control" placeholder="student@email.com">
            </div>
            <div class="form-group">
              <label class="form-label">College / Organization</label>
              <input type="text" id="add-college" class="form-control" placeholder="Optional">
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Address</label>
              <input type="text" id="add-address" class="form-control" placeholder="City, State">
            </div>
          </div>

          <div style="font-weight:700;color:var(--gray-700);margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--gray-200)">📚 Course Details</div>
          <div class="form-grid" style="margin-bottom:1.25rem">
            <div class="form-group">
              <label class="form-label">Course / Subject <span class="required">*</span></label>
              <select id="add-course" class="form-control" required>
                <option value="">Select Course</option>
                <option>Full Stack Development</option>
                <option>Data Science & ML</option>
                <option>UI/UX Design</option>
                <option>Digital Marketing</option>
                <option>Python Programming</option>
                <option>Java Development</option>
                <option>Cloud Computing</option>
                <option>Cybersecurity</option>
                <option>Business Analytics</option>
                <option>Mobile App Development</option>
                <option value="custom">Other (specify)</option>
              </select>
              <span class="form-error d-none" id="err-course"></span>
            </div>
            <div class="form-group" id="custom-course-group" style="display:none">
              <label class="form-label">Custom Course Name <span class="required">*</span></label>
              <input type="text" id="add-course-custom" class="form-control" placeholder="Enter course name">
            </div>
            <div class="form-group">
              <label class="form-label">Enrollment Date <span class="required">*</span></label>
              <input type="date" id="add-enrollment-date" class="form-control" required>
            </div>
          </div>

          <div style="font-weight:700;color:var(--gray-700);margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--gray-200)">💰 Fee & Payment Plan</div>
          <div class="form-grid" style="margin-bottom:1.25rem">
            <div class="form-group">
              <label class="form-label">Total Course Fee (₹) <span class="required">*</span></label>
              <input type="number" id="add-total-fee" class="form-control" placeholder="e.g. 30000" min="1" required>
              <span class="form-error d-none" id="err-total-fee"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Installment Plan</label>
              <select id="add-installment-plan" class="form-control">
                <option value="Monthly">Monthly</option>
                <option value="Weekly">Weekly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Number of Installments <span class="required">*</span></label>
              <input type="number" id="add-num-installments" class="form-control" placeholder="e.g. 3" min="1" max="36" value="1" required>
              <span class="form-hint">Total fee will be split across this many installments</span>
            </div>
            <div class="form-group">
              <label class="form-label">First Payment Amount (₹)</label>
              <input type="number" id="add-first-payment" class="form-control" placeholder="0 if not paid yet" min="0" value="0">
              <span class="form-error d-none" id="err-first-payment"></span>
            </div>
            <div class="form-group">
              <label class="form-label">First Payment Date</label>
              <input type="date" id="add-first-payment-date" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">Next Installment Due Date</label>
              <input type="date" id="add-next-due-date" class="form-control">
            </div>
          </div>

          <div style="font-weight:700;color:var(--gray-700);margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--gray-200)">📝 Fee Preview</div>
          <div id="fee-preview" style="background:var(--gray-50);border-radius:var(--radius-md);padding:1rem;font-size:0.875rem;color:var(--gray-600)">
            Enter fee details above to see preview.
          </div>

          <div class="form-group mt-4">
            <label class="form-label">Notes / Remarks</label>
            <textarea id="add-notes" class="form-control" placeholder="Additional information..."></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-gray" onclick="closeModal('modal-add-student')">Cancel</button>
        <button class="btn btn-primary" id="btn-save-student">💾 Save Student</button>
      </div>
    </div>
  </div>`;
}

function openAddStudentModal() {
  openModal('modal-add-student');

  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('add-enrollment-date').value = today;
  document.getElementById('add-first-payment-date').value = today;

  // Set next due date 30 days from today
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  document.getElementById('add-next-due-date').value = nextMonth.toISOString().split('T')[0];

  // Course custom field
  document.getElementById('add-course').addEventListener('change', function () {
    const customGroup = document.getElementById('custom-course-group');
    customGroup.style.display = this.value === 'custom' ? 'flex' : 'none';
  });

  // Fee preview
  ['add-total-fee', 'add-first-payment', 'add-num-installments'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateFeePreview);
  });

  // Save handler
  document.getElementById('btn-save-student').onclick = saveNewStudent;
}

function updateFeePreview() {
  const totalFee = parseFloat(document.getElementById('add-total-fee').value) || 0;
  const firstPayment = parseFloat(document.getElementById('add-first-payment').value) || 0;
  const numInstallments = parseInt(document.getElementById('add-num-installments').value) || 1;
  const remaining = totalFee - firstPayment;
  const remainingInstallments = Math.max(0, numInstallments - (firstPayment > 0 ? 1 : 0));
  const nextInst = remainingInstallments > 0 ? Math.ceil(remaining / remainingInstallments) : 0;

  const preview = document.getElementById('fee-preview');
  if (!preview) return;

  preview.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.75rem">
      <div style="background:#fff;padding:0.75rem;border-radius:var(--radius-md);border:1px solid var(--gray-200);text-align:center">
        <div style="font-size:0.72rem;color:var(--gray-400);text-transform:uppercase;font-weight:600;margin-bottom:4px">Total Fee</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--gray-900);font-family:var(--font-heading)">${formatCurrency(totalFee)}</div>
      </div>
      <div style="background:#fff;padding:0.75rem;border-radius:var(--radius-md);border:1px solid var(--gray-200);text-align:center">
        <div style="font-size:0.72rem;color:var(--gray-400);text-transform:uppercase;font-weight:600;margin-bottom:4px">First Payment</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--success);font-family:var(--font-heading)">${formatCurrency(firstPayment)}</div>
      </div>
      <div style="background:#fff;padding:0.75rem;border-radius:var(--radius-md);border:1px solid var(--gray-200);text-align:center">
        <div style="font-size:0.72rem;color:var(--gray-400);text-transform:uppercase;font-weight:600;margin-bottom:4px">Remaining</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--danger);font-family:var(--font-heading)">${formatCurrency(remaining)}</div>
      </div>
      <div style="background:#fff;padding:0.75rem;border-radius:var(--radius-md);border:1px solid var(--gray-200);text-align:center">
        <div style="font-size:0.72rem;color:var(--gray-400);text-transform:uppercase;font-weight:600;margin-bottom:4px">Next Installment</div>
        <div style="font-weight:800;font-size:1.1rem;color:var(--warning);font-family:var(--font-heading)">${formatCurrency(nextInst)}</div>
      </div>
    </div>
    ${remaining < 0 ? `<div style="color:var(--danger);margin-top:0.5rem;font-weight:600">⚠ First payment cannot exceed total fee!</div>` : ''}
  `;
}

async function saveNewStudent() {
  // Validate
  let valid = true;

  const nameVal = document.getElementById('add-name').value.trim();
  const mobileVal = document.getElementById('add-mobile').value.trim();
  let courseVal = document.getElementById('add-course').value;
  if (courseVal === 'custom') courseVal = document.getElementById('add-course-custom').value.trim();
  const enrollmentDate = document.getElementById('add-enrollment-date').value;
  const totalFee = parseFloat(document.getElementById('add-total-fee').value) || 0;
  const firstPayment = parseFloat(document.getElementById('add-first-payment').value) || 0;

  const clearErr = id => { const el = document.getElementById(id); if(el){el.classList.add('d-none');el.textContent='';} };
  const showErr = (id, msg) => { const el = document.getElementById(id); if(el){el.classList.remove('d-none');el.textContent=msg;} valid = false; };
  const clearFC = id => document.getElementById(id)?.classList.remove('error');
  const setFC = id => document.getElementById(id)?.classList.add('error');

  clearErr('err-name'); clearErr('err-mobile'); clearErr('err-course'); clearErr('err-total-fee'); clearErr('err-first-payment');
  clearFC('add-name'); clearFC('add-mobile'); clearFC('add-course'); clearFC('add-total-fee'); clearFC('add-first-payment');

  if (!nameVal) { showErr('err-name', 'Student name is required'); setFC('add-name'); }
  if (!mobileVal || !/^\d{10}$/.test(mobileVal)) { showErr('err-mobile', 'Enter a valid 10-digit mobile number'); setFC('add-mobile'); }
  if (!courseVal) { showErr('err-course', 'Please select or enter a course'); setFC('add-course'); }
  if (totalFee <= 0) { showErr('err-total-fee', 'Total fee must be greater than 0'); setFC('add-total-fee'); }
  if (firstPayment < 0) { showErr('err-first-payment', 'Payment cannot be negative'); setFC('add-first-payment'); }
  if (firstPayment > totalFee) { showErr('err-first-payment', 'Payment cannot exceed total fee'); setFC('add-first-payment'); }

  if (!valid) return;

  const btn = document.getElementById('btn-save-student');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Saving...';

  try {
    const result = await addStudent({
      Student_Name: nameVal,
      Mobile: mobileVal,
      Email: document.getElementById('add-email').value.trim(),
      Course: courseVal,
      Enrollment_Date: enrollmentDate,
      Total_Fee: totalFee,
      Installment_Plan: document.getElementById('add-installment-plan').value,
      Num_Installments: parseInt(document.getElementById('add-num-installments').value) || 1,
      First_Payment_Amount: firstPayment,
      First_Payment_Date: document.getElementById('add-first-payment-date').value,
      Next_Due_Date: document.getElementById('add-next-due-date').value,
      College_Org: document.getElementById('add-college').value.trim(),
      Address: document.getElementById('add-address').value.trim(),
      Notes: document.getElementById('add-notes').value.trim()
    });

    if (result.success) {
      showToast('success', 'Student Added', `${nameVal} has been enrolled. ID: ${result.data?.studentId}`);
      closeModal('modal-add-student');
      document.getElementById('form-add-student').reset();
      await loadStudentsTable();
    } else {
      showToast('error', 'Error', result.message || 'Failed to add student.');
    }
  } catch (err) {
    showToast('error', 'Error', 'Failed to save student. Please try again.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 Save Student';
  }
}

// ============================================================
// VIEW STUDENT PROFILE
// ============================================================
function viewStudent(studentId) {
  App.viewingStudentId = studentId;
  navigateTo('student-profile');
}

async function renderStudentProfile(container, studentId) {
  container.innerHTML = `<div style="padding:4rem;text-align:center"><div class="spinner" style="margin:0 auto;margin-bottom:1rem"></div><div class="loading-text">Loading student profile...</div></div>`;

  try {
    const [student, payments, installments] = await Promise.all([
      getStudent(studentId),
      getPayments(studentId),
      getInstallments(studentId)
    ]);

    if (!student) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Student Not Found</h3><p>The student you are looking for does not exist.</p><button class="btn btn-primary mt-4" onclick="navigateTo('students')">Back to Students</button></div>`;
      return;
    }

    const totalFee = parseFloat(student.Total_Fee) || 0;
    const totalPaid = parseFloat(student.Total_Paid) || 0;
    const remaining = parseFloat(student.Remaining_Fee) || 0;
    const pct = totalFee > 0 ? Math.min(100, Math.round((totalPaid / totalFee) * 100)) : 0;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>👁 Student Profile</h1>
          <p>${student.Student_Name} · ${student.Student_ID}</p>
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
          <button class="btn btn-outline-gray" onclick="navigateTo('students')">← Back</button>
          <button class="btn btn-outline" onclick="editStudent('${student.Student_ID}')">✏️ Edit</button>
          <button class="btn btn-success" onclick="openRecordPayment('${student.Student_ID}')">💰 Record Payment</button>
          <button class="btn btn-primary" onclick="printStudentReceipt('${student.Student_ID}')">🖨 Print Latest Receipt</button>
        </div>
      </div>

      <div class="profile-header">
        <div class="profile-avatar">${getInitials(student.Student_Name)}</div>
        <div class="profile-name">${student.Student_Name}</div>
        <div class="profile-meta">
          <div class="profile-meta-item">📋 ${student.Student_ID}</div>
          <div class="profile-meta-item">📱 ${student.Mobile || '—'}</div>
          <div class="profile-meta-item">📧 ${student.Email || '—'}</div>
          <div class="profile-meta-item">📚 ${student.Course}</div>
          <div class="profile-meta-item">📅 Enrolled: ${formatDate(student.Enrollment_Date)}</div>
          ${student.College_Org ? `<div class="profile-meta-item">🏫 ${student.College_Org}</div>` : ''}
        </div>
      </div>

      <div class="fee-summary-grid">
        <div class="fee-summary-card">
          <div class="fee-label">Total Course Fee</div>
          <div class="fee-value">${formatCurrency(totalFee)}</div>
        </div>
        <div class="fee-summary-card">
          <div class="fee-label">Total Paid</div>
          <div class="fee-value" style="color:var(--success)">${formatCurrency(totalPaid)}</div>
        </div>
        <div class="fee-summary-card">
          <div class="fee-label">Remaining</div>
          <div class="fee-value" style="color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(remaining)}</div>
        </div>
        <div class="fee-summary-card">
          <div class="fee-label">Next Installment</div>
          <div class="fee-value" style="color:var(--warning)">${parseFloat(student.Next_Installment_Amount) > 0 ? formatCurrency(student.Next_Installment_Amount) : '—'}</div>
        </div>
        <div class="fee-summary-card">
          <div class="fee-label">Next Due Date</div>
          <div class="fee-value" style="font-size:1rem">${student.Next_Due_Date ? formatDate(student.Next_Due_Date) : '—'}</div>
        </div>
        <div class="fee-summary-card">
          <div class="fee-label">Payment Status</div>
          <div class="fee-value" style="font-size:1rem">${getStatusBadge(student.Payment_Status)}</div>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header">
          <div class="card-title">📊 Payment Progress</div>
          <span style="font-size:0.875rem;font-weight:700;color:var(--primary-light)">${pct}% Paid</span>
        </div>
        <div class="card-body">
          <div style="background:var(--gray-100);border-radius:var(--radius-full);height:16px;overflow:hidden;margin-bottom:0.75rem">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--success),var(--accent));border-radius:var(--radius-full);transition:width 1s ease"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--gray-500)">
            <span>₹0</span>
            <span style="font-weight:600;color:var(--primary-light)">${formatCurrency(totalPaid)} paid</span>
            <span>${formatCurrency(totalFee)}</span>
          </div>
          ${student.Notes ? `<div style="margin-top:0.75rem;padding:0.75rem;background:var(--gray-50);border-radius:var(--radius-md);font-size:0.8rem;color:var(--gray-600)">📝 ${student.Notes}</div>` : ''}
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">💳 Payment History</div>
            <span class="badge badge-primary">${payments.length} Payments</span>
          </div>
          <div class="table-wrapper">
            ${payments.length ? `
            <table class="table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Txn ID</th>
                  <th>Inst. #</th>
                  <th>Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => `
                  <tr>
                    <td><span style="font-family:monospace;font-size:0.8rem">${p.Payment_ID}</span></td>
                    <td>${formatDate(p.Payment_Date)}</td>
                    <td style="font-weight:700;color:var(--success)">${formatCurrency(p.Amount_Paid)}</td>
                    <td><span class="badge badge-info">${p.Payment_Mode}</span></td>
                    <td style="font-size:0.8rem;color:var(--gray-700);font-family:monospace;word-break:break-all;max-width:180px">${p.Transaction_ID || '—'}</td>
                    <td>${p.Installment_Number || '—'}</td>
                    <td>${formatCurrency(p.Remaining_After_Payment)}</td>
                    <td style="display:flex;gap:0.4rem;flex-wrap:wrap">
                      <button class="btn btn-sm btn-outline" onclick="viewReceipt('${p.Payment_ID}','${student.Student_ID}')">🖨 Receipt</button>
                      <button class="btn btn-sm btn-outline" style="border-color:var(--primary);color:var(--primary)" onclick="openEditPayment('${p.Payment_ID}')">✏️ Edit</button>
                      <button class="btn btn-sm btn-danger" onclick="confirmDeletePayment('${p.Payment_ID}','${p.Amount_Paid}','${p.Payment_Date}')">🗑 Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>` : `<div class="empty-state" style="padding:2rem"><div class="empty-icon">💳</div><h3>No Payments Yet</h3></div>`}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">📅 Installments</div>
          </div>
          <div style="padding:0">
            ${installments.length ? installments.map(i => {
              const isOverdue = i.Status === 'Overdue';
              return `
              <div style="padding:0.875rem 1.25rem;border-bottom:1px solid var(--gray-100);display:flex;align-items:center;gap:0.75rem">
                <div style="width:28px;height:28px;border-radius:50%;background:${isOverdue ? 'var(--danger)' : i.Status === 'Paid' || i.Status === 'Completed' ? 'var(--success)' : 'var(--gray-300)'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">${i.Installment_Number}</div>
                <div style="flex:1">
                  <div style="font-size:0.8rem;font-weight:600;color:var(--gray-800)">${formatCurrency(i.Installment_Amount)} · Due ${formatDate(i.Due_Date)}</div>
                  ${isOverdue ? `<div style="font-size:0.72rem;color:var(--danger)">${i.Days_Overdue} days overdue</div>` : ''}
                </div>
                ${getInstallmentStatusBadge(i.Status)}
              </div>`;
            }).join('') : `<div class="empty-state" style="padding:2rem"><div class="empty-icon">📅</div><h3>No Installments</h3></div>`}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Profile error:', err);
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error Loading Profile</h3><p>${err.message}</p></div>`;
  }
}

// ============================================================
// EDIT STUDENT MODAL
// ============================================================
function renderEditStudentModal() {
  return `
  <div class="modal-overlay" id="modal-edit-student">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title">✏️ Edit Student</div>
        <button class="modal-close" onclick="closeModal('modal-edit-student')">✕</button>
      </div>
      <div class="modal-body">
        <form id="form-edit-student" novalidate>
          <input type="hidden" id="edit-student-id">
          <div class="form-grid" style="margin-bottom:1.25rem">
            <div class="form-group">
              <label class="form-label">Student Name <span class="required">*</span></label>
              <input type="text" id="edit-name" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Mobile Number</label>
              <input type="tel" id="edit-mobile" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="edit-email" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">Course</label>
              <input type="text" id="edit-course" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">College / Organization</label>
              <input type="text" id="edit-college" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <input type="text" id="edit-address" class="form-control">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea id="edit-notes" class="form-control"></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-gray" onclick="closeModal('modal-edit-student')">Cancel</button>
        <button class="btn btn-primary" id="btn-update-student">💾 Update Student</button>
      </div>
    </div>
  </div>`;
}

async function editStudent(studentId) {
  const student = await getStudent(studentId);
  if (!student) { showToast('error', 'Error', 'Student not found.'); return; }

  App.editingStudentId = studentId;
  openModal('modal-edit-student');
  initModals();

  document.getElementById('edit-student-id').value = student.Student_ID;
  document.getElementById('edit-name').value = student.Student_Name || '';
  document.getElementById('edit-mobile').value = student.Mobile || '';
  document.getElementById('edit-email').value = student.Email || '';
  document.getElementById('edit-course').value = student.Course || '';
  document.getElementById('edit-college').value = student.College_Org || '';
  document.getElementById('edit-address').value = student.Address || '';
  document.getElementById('edit-notes').value = student.Notes || '';

  document.getElementById('btn-update-student').onclick = async () => {
    const btn = document.getElementById('btn-update-student');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Saving...';

    try {
      const result = await updateStudent({
        Student_ID: studentId,
        Student_Name: document.getElementById('edit-name').value.trim(),
        Mobile: document.getElementById('edit-mobile').value.trim(),
        Email: document.getElementById('edit-email').value.trim(),
        Course: document.getElementById('edit-course').value.trim(),
        College_Org: document.getElementById('edit-college').value.trim(),
        Address: document.getElementById('edit-address').value.trim(),
        Notes: document.getElementById('edit-notes').value.trim()
      });

      if (result.success) {
        showToast('success', 'Updated', 'Student information updated successfully.');
        closeModal('modal-edit-student');
        if (App.currentPage === 'students') await loadStudentsTable();
        else if (App.currentPage === 'student-profile') renderStudentProfile(document.getElementById('page-container'), studentId);
      } else {
        showToast('error', 'Error', result.message || 'Update failed.');
      }
    } catch (err) {
      showToast('error', 'Error', 'Failed to update student.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '💾 Update Student';
    }
  };
}

// ============================================================
// DELETE CONFIRMATION MODAL
// ============================================================
function renderDeleteConfirmModal() {
  return `
  <div class="modal-overlay" id="modal-delete-confirm">
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title" style="color:var(--danger)">⚠️ Delete Student</div>
        <button class="modal-close" onclick="closeModal('modal-delete-confirm')">✕</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--gray-600)">Are you sure you want to delete this student? This will also delete all payment and installment records.</p>
        <p style="font-weight:700;color:var(--danger);margin-top:0.75rem">This action cannot be undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-gray" onclick="closeModal('modal-delete-confirm')">Cancel</button>
        <button class="btn btn-danger" id="btn-confirm-delete">Delete</button>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="modal-delete-payment-confirm">
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title" style="color:var(--danger)">🗑️ Delete Payment</div>
        <button class="modal-close" onclick="closeModal('modal-delete-payment-confirm')">✕</button>
      </div>
      <div class="modal-body">
        <p id="del-pay-msg" style="color:var(--gray-600)">Are you sure you want to delete this payment?</p>
        <p style="font-weight:700;color:var(--danger);margin-top:0.75rem">This will reverse the student balance and remove the record from Google Sheets. Cannot be undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-gray" onclick="closeModal('modal-delete-payment-confirm')">Cancel</button>
        <button class="btn btn-danger" id="btn-confirm-delete-payment">🗑 Delete Payment</button>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="modal-purge-confirm">
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title" style="color:var(--danger)">🔴 Purge All Payments</div>
        <button class="modal-close" onclick="closeModal('modal-purge-confirm')">✕</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--gray-600)">This will <strong>permanently delete ALL payments and installments</strong> from both the app and Google Sheets.</p>
        <p style="color:var(--gray-600);margin-top:0.5rem">Student records are kept but all fee balances reset to ₹0 paid / Pending status.</p>
        <p style="font-weight:700;color:var(--danger);margin-top:0.75rem">⚠️ Payment IDs will restart from PAY001. This CANNOT be undone!</p>
        <div style="margin-top:1rem">
          <label style="font-size:0.85rem;color:var(--gray-600);font-weight:600">Type <code>PURGE</code> to confirm:</label>
          <input type="text" id="purge-confirm-input" class="form-control" placeholder="Type PURGE here" style="margin-top:0.35rem">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-gray" onclick="closeModal('modal-purge-confirm')">Cancel</button>
        <button class="btn btn-danger" id="btn-confirm-purge">🔴 Purge All Payments</button>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="modal-edit-payment">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">✏️ Edit Payment</div>
        <button class="modal-close" onclick="closeModal('modal-edit-payment')">✕</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="edit-pay-id">
        <input type="hidden" id="edit-pay-student-id">
        <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:0.75rem 1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:0.75rem;color:var(--gray-500)">Payment ID</div>
            <div id="edit-pay-id-label" style="font-family:monospace;font-weight:700;color:var(--primary)"></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--gray-500)">Student</div>
            <div id="edit-pay-student-label" style="font-weight:700;color:var(--gray-800)"></div>
          </div>
        </div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:1rem">
          <div class="form-group">
            <label class="form-label">Payment Date *</label>
            <input type="date" id="edit-pay-date" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">Amount Paid (₹) *</label>
            <input type="number" id="edit-pay-amount" class="form-control" min="1" step="0.01" required>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Mode *</label>
            <select id="edit-pay-mode" class="form-control">
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Installment Number</label>
            <input type="number" id="edit-pay-installment-num" class="form-control" min="1" max="24">
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Transaction ID / UPI Reference (Full)</label>
            <input type="text" id="edit-pay-transaction-id" class="form-control" placeholder="UPI ref / UTR / Txn ID">
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Remarks</label>
            <textarea id="edit-pay-remarks" class="form-control" style="min-height:50px" placeholder="Optional notes..."></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-gray" onclick="closeModal('modal-edit-payment')">Cancel</button>
        <button class="btn btn-primary" id="btn-save-edit-payment" onclick="saveEditedPayment()">💾 Save Changes</button>
      </div>
    </div>
  </div>`;
}

function confirmDeleteStudent(studentId, studentName) {
  openModal('modal-delete-confirm');

  // Update the modal body to show the student name
  const modalBody = document.querySelector('#modal-delete-confirm .modal-body p:first-child');
  if (modalBody) {
    modalBody.innerHTML = `Are you sure you want to delete <strong>${studentName}</strong>? This will also delete all their payment and installment records.`;
  }

  const btn = document.getElementById('btn-confirm-delete');
  // Remove previous listener to avoid stacking
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.onclick = async () => {
    newBtn.disabled = true;
    newBtn.innerHTML = '<div class="spinner spinner-sm"></div> Deleting...';
    try {
      const result = await deleteStudent(studentId);
      if (result.success) {
        showToast('success', 'Deleted', `${studentName} has been removed.`);
        closeModal('modal-delete-confirm');
        await loadStudentsTable();
      } else {
        showToast('error', 'Error', result.message || 'Failed to delete student.');
      }
    } catch (err) {
      showToast('error', 'Error', 'Failed to delete student.');
      console.error(err);
    } finally {
      newBtn.disabled = false;
      newBtn.textContent = 'Delete';
    }
  };
}

// ============================================================
// DELETE PAYMENT CONFIRMATION
// ============================================================
function confirmDeletePayment(paymentId, amount, date) {
  openModal('modal-delete-payment-confirm');
  const msg = document.getElementById('del-pay-msg');
  if (msg) {
    msg.innerHTML = `Are you sure you want to delete payment <strong>${paymentId}</strong> of <strong>${formatCurrency(parseFloat(amount))}</strong> on ${formatDate(date)}?`;
  }

  const btn = document.getElementById('btn-confirm-delete-payment');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.onclick = async () => {
    newBtn.disabled = true;
    newBtn.innerHTML = '<div class="spinner spinner-sm"></div> Deleting...';
    try {
      const result = await deletePayment(paymentId);
      if (result.success) {
        showToast('success', 'Payment Deleted', `Payment ${paymentId} removed from the system and Google Sheets.`);
        closeModal('modal-delete-payment-confirm');
        if (App.currentPage === 'student-profile') {
          renderStudentProfile(document.getElementById('page-container'), App.viewingStudentId);
        } else if (App.currentPage === 'payments') {
          navigateTo('payments');
        } else {
          navigateTo('dashboard');
        }
      } else {
        showToast('error', 'Error', result.message || 'Failed to delete payment.');
      }
    } catch (err) {
      showToast('error', 'Error', 'Failed to delete payment.');
      console.error(err);
    } finally {
      newBtn.disabled = false;
      newBtn.innerHTML = '🗑 Delete Payment';
    }
  };
}

// ============================================================
// PURGE ALL PAYMENTS (FRESH START)
// ============================================================
function openPurgeModal() {
  openModal('modal-purge-confirm');
  const input = document.getElementById('purge-confirm-input');
  if (input) input.value = '';

  const btn = document.getElementById('btn-confirm-purge');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.onclick = async () => {
    const confirmInput = document.getElementById('purge-confirm-input');
    if (!confirmInput || confirmInput.value.trim().toUpperCase() !== 'PURGE') {
      showToast('warning', 'Confirmation Required', 'Please type PURGE in the box to confirm this destructive action.');
      return;
    }
    newBtn.disabled = true;
    newBtn.innerHTML = '<div class="spinner spinner-sm"></div> Purging...';
    try {
      const result = await purgeAllPayments();
      if (result.success) {
        showToast('success', '✅ Fresh Start Done', 'All payments wiped. IDs reset from PAY001. System ready for fresh use.');
        closeModal('modal-purge-confirm');
        navigateTo('dashboard');
      } else {
        showToast('error', 'Error', result.message || 'Purge failed.');
      }
    } catch (err) {
      showToast('error', 'Error', 'Failed to purge payments.');
      console.error(err);
    } finally {
      newBtn.disabled = false;
      newBtn.innerHTML = '🔴 Purge All Payments';
    }
  };
}

// ============================================================
// EDIT PAYMENT
// ============================================================
function openEditPayment(paymentId) {
  const p = _localStore.payments.find(x => x.Payment_ID === paymentId);
  if (!p) {
    showToast('error', 'Error', 'Payment record not found.');
    return;
  }
  const s = _localStore.students.find(stu => stu.Student_ID === p.Student_ID);

  document.getElementById('edit-pay-id').value = p.Payment_ID;
  document.getElementById('edit-pay-student-id').value = p.Student_ID;
  document.getElementById('edit-pay-id-label').textContent = p.Payment_ID;
  document.getElementById('edit-pay-student-label').textContent = s ? `${s.Student_Name} (${s.Student_ID})` : p.Student_ID;

  let d = p.Payment_Date || '';
  if (d.includes('T')) d = d.split('T')[0];
  document.getElementById('edit-pay-date').value = d;
  document.getElementById('edit-pay-amount').value = p.Amount_Paid || '';
  document.getElementById('edit-pay-mode').value = p.Payment_Mode || 'UPI';
  document.getElementById('edit-pay-installment-num').value = p.Installment_Number || 1;
  document.getElementById('edit-pay-transaction-id').value = p.Transaction_ID || '';
  document.getElementById('edit-pay-remarks').value = p.Remarks || '';

  openModal('modal-edit-payment');
}

async function saveEditedPayment() {
  const paymentId = document.getElementById('edit-pay-id').value;
  const studentId = document.getElementById('edit-pay-student-id').value;
  const payDate = document.getElementById('edit-pay-date').value;
  const amount = parseFloat(document.getElementById('edit-pay-amount').value);
  const mode = document.getElementById('edit-pay-mode').value;
  const instNo = parseInt(document.getElementById('edit-pay-installment-num').value) || 1;
  const txnId = document.getElementById('edit-pay-transaction-id').value.trim();
  const remarks = document.getElementById('edit-pay-remarks').value.trim();

  if (isNaN(amount) || amount <= 0) {
    showToast('warning', 'Validation', 'Please enter a valid payment amount.');
    return;
  }
  if (!payDate) {
    showToast('warning', 'Validation', 'Please select a payment date.');
    return;
  }

  const btn = document.getElementById('btn-save-edit-payment');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Saving...';

  try {
    const res = await updatePayment({
      Payment_ID: paymentId,
      Student_ID: studentId,
      Payment_Date: payDate,
      Amount_Paid: amount,
      Payment_Mode: mode,
      Transaction_ID: txnId,
      Installment_Number: instNo,
      Remarks: remarks
    });

    if (res && res.success) {
      showToast('success', 'Payment Updated', `Payment ${paymentId} updated successfully.`);
      closeModal('modal-edit-payment');

      // Refresh UI depending on active page
      if (App.currentPage === 'student-profile') {
        renderStudentProfile(document.getElementById('page-container'), studentId);
      } else if (App.currentPage === 'payments') {
        renderPayments(document.getElementById('page-container'));
      } else if (App.currentPage === 'receipt') {
        App.receiptData = generateReceiptData(paymentId, studentId);
        renderReceiptPage(document.getElementById('page-container'));
      } else if (App.currentPage === 'dashboard') {
        renderDashboard(document.getElementById('page-container'));
      }
    } else {
      showToast('error', 'Error', res?.message || 'Failed to update payment.');
    }
  } catch (err) {
    showToast('error', 'Error', 'Failed to update payment: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 Save Changes';
  }
}

// ============================================================
// RECORD PAYMENT MODAL
// ============================================================
function renderPaymentModal() {
  return `
  <div class="modal-overlay" id="modal-record-payment">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">💰 Record Payment</div>
        <button class="modal-close" onclick="closeModal('modal-record-payment')">✕</button>
      </div>
      <div class="modal-body">
        <div id="payment-student-info" style="background:var(--gray-50);border-radius:var(--radius-md);padding:0.875rem 1rem;margin-bottom:1.25rem;font-size:0.875rem"></div>
        <form id="form-record-payment" novalidate>
          <input type="hidden" id="pay-student-id">
          <div class="form-grid" style="margin-bottom:1rem">
            <div class="form-group">
              <label class="form-label">Payment Date <span class="required">*</span></label>
              <input type="date" id="pay-date" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Amount Paid (₹) <span class="required">*</span></label>
              <input type="number" id="pay-amount" class="form-control" placeholder="Enter amount" min="1" required>
              <span class="form-error d-none" id="err-pay-amount"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Mode</label>
              <select id="pay-mode" class="form-control">
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Installment Number</label>
              <input type="number" id="pay-installment-num" class="form-control" placeholder="Auto" min="1">
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Transaction ID / Reference</label>
              <input type="text" id="pay-transaction-id" class="form-control" placeholder="UPI ref / Cheque no. (optional)">
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Remarks</label>
              <textarea id="pay-remarks" class="form-control" style="min-height:60px" placeholder="Optional remarks..."></textarea>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-gray" onclick="closeModal('modal-record-payment')">Cancel</button>
        <button class="btn btn-success" id="btn-save-payment">✅ Record Payment</button>
      </div>
    </div>
  </div>`;
}

async function openQuickPaymentModal() {
  const students = _localStore.students || [];
  if (students.length === 0) {
    showToast('info', 'No Students', 'Please add a student first.');
    openAddStudentModal();
    return;
  }

  // If viewing a student, default to that student
  if (App.viewingStudentId) {
    openRecordPayment(App.viewingStudentId, true);
    return;
  }

  // Find first student with pending balance
  const dueStudent = students.find(s => (parseFloat(s.Remaining_Fee) || 0) > 0);
  const targetId = dueStudent ? dueStudent.Student_ID : students[0].Student_ID;
  openRecordPayment(targetId, true);
}

async function openRecordPayment(studentId, showSelector = false) {
  const student = await getStudent(studentId);
  if (!student) { showToast('error', 'Error', 'Student not found.'); return; }

  const remaining = parseFloat(student.Remaining_Fee) || 0;
  if (remaining <= 0 && !showSelector) {
    showToast('info', 'Fully Paid', 'This student has no remaining balance.');
    return;
  }

  openModal('modal-record-payment');

  document.getElementById('pay-student-id').value = studentId;
  document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];

  const existingPayments = _localStore.payments.filter(p => p.Student_ID === studentId);
  const nextInstNum = existingPayments.length + 1;
  document.getElementById('pay-installment-num').value = nextInstNum;
  document.getElementById('pay-amount').value = student.Next_Installment_Amount > 0 ? student.Next_Installment_Amount : (remaining > 0 ? remaining : '');

  const allStudents = _localStore.students || [];
  const selectorHtml = (showSelector && allStudents.length > 1) ? `
    <div style="margin-bottom:0.875rem">
      <label class="form-label" style="font-size:0.75rem;color:var(--gray-500)">Select Student to Record Payment</label>
      <select id="pay-student-selector" class="form-control" style="font-size:0.85rem;font-weight:600" onchange="openRecordPayment(this.value, true)">
        ${allStudents.map(s => `
          <option value="${s.Student_ID}" ${s.Student_ID === studentId ? 'selected' : ''}>
            ${s.Student_Name} (${s.Student_ID}) — ${s.Course} [Due: ${formatCurrency(s.Remaining_Fee)}]
          </option>
        `).join('')}
      </select>
    </div>
  ` : '';

  document.getElementById('payment-student-info').innerHTML = `
    ${selectorHtml}
    <div style="display:flex;align-items:center;gap:0.75rem;padding-top:${showSelector ? '0.25rem' : '0'}">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--primary-light),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0">${getInitials(student.Student_Name)}</div>
      <div style="flex:1">
        <div style="font-weight:700;color:var(--gray-900)">${student.Student_Name}</div>
        <div style="font-size:0.8rem;color:var(--gray-500)">${student.Course} · ${student.Student_ID}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:0.75rem;color:var(--gray-400)">Remaining Balance</div>
        <div style="font-weight:800;color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'};font-size:1.1rem;font-family:var(--font-heading)">${formatCurrency(remaining)}</div>
        ${student.Next_Installment_Amount > 0 ? `<div style="font-size:0.72rem;color:var(--warning)">Suggested: ${formatCurrency(student.Next_Installment_Amount)}</div>` : ''}
      </div>
    </div>
  `;

  document.getElementById('btn-save-payment').onclick = async () => {
    const amountEl = document.getElementById('pay-amount');
    const amount = parseFloat(amountEl.value) || 0;
    const errEl = document.getElementById('err-pay-amount');

    errEl.classList.add('d-none');
    amountEl.classList.remove('error');

    if (amount <= 0) {
      errEl.textContent = 'Please enter a valid payment amount.';
      errEl.classList.remove('d-none');
      amountEl.classList.add('error');
      return;
    }

    if (amount > remaining && remaining > 0) {
      errEl.textContent = `Amount cannot exceed remaining balance of ${formatCurrency(remaining)}.`;
      errEl.classList.remove('d-none');
      amountEl.classList.add('error');
      return;
    }

    const btn = document.getElementById('btn-save-payment');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Processing...';

    try {
      const result = await recordPayment({
        Student_ID: studentId,
        Payment_Date: document.getElementById('pay-date').value,
        Amount_Paid: amount,
        Payment_Mode: document.getElementById('pay-mode').value,
        Transaction_ID: document.getElementById('pay-transaction-id').value.trim(),
        Installment_Number: document.getElementById('pay-installment-num').value || nextInstNum,
        Remarks: document.getElementById('pay-remarks').value.trim()
      });

      if (result.success) {
        showToast('success', 'Payment Recorded', `${formatCurrency(amount)} payment recorded. Receipt: ${result.data?.receiptNumber}`);
        closeModal('modal-record-payment');

        // Automatically store receipt data for printing
        if (result.data?.paymentId) {
          App.receiptData = generateReceiptData(result.data.paymentId, studentId);
        }

        // Refresh current view
        if (App.currentPage === 'students') await loadStudentsTable();
        else if (App.currentPage === 'student-profile') {
          renderStudentProfile(document.getElementById('page-container'), studentId);
        } else if (App.currentPage === 'dashboard') {
          renderDashboard(document.getElementById('page-container'));
        } else if (App.currentPage === 'installments') {
          renderInstallments(document.getElementById('page-container'));
        } else if (App.currentPage === 'payments') {
          renderPayments(document.getElementById('page-container'));
        }
      } else {
        showToast('error', 'Error', result.message || 'Payment failed.');
      }
    } catch (err) {
      showToast('error', 'Error', 'Failed to record payment.');
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '✅ Record Payment';
    }
  };
}

async function viewReceipt(paymentId, studentId) {
  // Ensure local store has payment & student data (needed when Sheets Live is active)
  if (!_localStore.payments.find(p => p.Payment_ID === paymentId)) {
    const allPayments = await getPayments();
    _localStore.payments = allPayments;
  }
  if (!_localStore.students.find(s => s.Student_ID === studentId)) {
    const allStudents = await getStudents();
    _localStore.students = allStudents;
  }
  App.receiptData = generateReceiptData(paymentId, studentId);
  App.viewingStudentId = studentId;
  navigateTo('receipt');
}

function printStudentReceipt(studentId) {
  const payments = _localStore.payments.filter(p => p.Student_ID === studentId);
  if (!payments.length) { showToast('info', 'No Payments', 'No payment records found.'); return; }
  const lastPayment = payments[payments.length - 1];
  viewReceipt(lastPayment.Payment_ID, studentId);
}

// ============================================================
// PAYMENTS PAGE
// ============================================================
async function renderPayments(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>💳 Payment Records</h1>
        <p>All payment transactions across all students</p>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body" style="padding:1rem 1.25rem">
        <div class="search-bar" style="max-width:400px">
          <span class="search-icon">🔍</span>
          <input type="text" id="payment-search" placeholder="Search by student name or course...">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 All Payments</div>
        <span id="payment-count" class="badge badge-primary">Loading...</span>
      </div>
      <div class="table-wrapper" id="payments-table">
        <div style="padding:3rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>
      </div>
    </div>
  `;

  const loadPaymentsTable = async (search = '') => {
    const tableEl = document.getElementById('payments-table');
    let payments = await getPayments();

    if (search) {
      const s = search.toLowerCase();
      payments = payments.filter(p =>
        (p.Student_Name || '').toLowerCase().includes(s) ||
        (p.Course || '').toLowerCase().includes(s) ||
        (p.Payment_ID || '').toLowerCase().includes(s)
      );
    }

    const countEl = document.getElementById('payment-count');
    if (countEl) countEl.textContent = `${payments.length} Payments`;

    if (!payments.length) {
      tableEl.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><h3>No Payments Found</h3></div>`;
      return;
    }

    tableEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Pay ID</th>
            <th>Date</th>
            <th>Student</th>
            <th>Course</th>
            <th>Amount</th>
            <th>Mode</th>
            <th>Txn ID</th>
            <th>Inst. #</th>
            <th>Balance After</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td><span style="font-family:monospace;font-size:0.8rem">${p.Payment_ID}</span></td>
              <td>${formatDate(p.Payment_Date)}</td>
              <td>
                <div style="font-weight:600">${p.Student_Name}</div>
                <div style="font-size:0.75rem;color:var(--gray-400)">${p.Student_ID}</div>
              </td>
              <td>${p.Course || '—'}</td>
              <td style="font-weight:700;color:var(--success)">${formatCurrency(p.Amount_Paid)}</td>
              <td><span class="badge badge-info">${p.Payment_Mode}</span></td>
              <td style="font-size:0.8rem;color:var(--gray-700);font-family:monospace;word-break:break-all;max-width:180px">${p.Transaction_ID || '—'}</td>
              <td>${p.Installment_Number || '—'}</td>
              <td>${formatCurrency(p.Remaining_After_Payment)}</td>
              <td style="display:flex;gap:0.4rem;flex-wrap:wrap">
                <button class="btn btn-sm btn-outline" onclick="viewReceipt('${p.Payment_ID}','${p.Student_ID}')">🖨 Receipt</button>
                <button class="btn btn-sm btn-outline" style="border-color:var(--primary);color:var(--primary)" onclick="openEditPayment('${p.Payment_ID}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="confirmDeletePayment('${p.Payment_ID}','${p.Amount_Paid}','${p.Payment_Date}')">🗑 Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  document.getElementById('payment-search').addEventListener('input', debounce(e => {
    loadPaymentsTable(e.target.value);
  }, 300));

  await loadPaymentsTable();
}

// ============================================================
// INSTALLMENTS PAGE
// ============================================================
async function renderInstallments(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>📅 Installment Schedule</h1>
        <p>Track all installments and their due status</p>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body" style="padding:1rem 1.25rem">
        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
          <div class="search-bar" style="flex:1;min-width:200px">
            <span class="search-icon">🔍</span>
            <input type="text" id="inst-search" placeholder="Search by student name or course...">
          </div>
          <div class="filter-tabs">
            ${['All','Paid','Upcoming','Due Soon','Due Today','Overdue','Completed'].map(f =>
              `<button class="filter-tab ${App.installmentFilter === f ? 'active' : ''}" data-filter="${f}">${f}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 All Installments</div>
        <span id="inst-count" class="badge badge-primary">Loading...</span>
      </div>
      <div class="table-wrapper" id="installments-table">
        <div style="padding:3rem;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>
      </div>
    </div>
  `;

  const loadInstTable = async (search = '', filter = App.installmentFilter) => {
    const tableEl = document.getElementById('installments-table');
    let installments = await getInstallments();

    // Recalculate statuses
    const today = new Date(); today.setHours(0,0,0,0);
    installments = installments.map(i => {
      if (i.Status !== 'Paid' && i.Status !== 'Completed') {
        i.Status = calculateInstallmentStatus(i.Due_Date, i.Remaining_Amount, i.Paid_Amount);
        i.Days_Overdue = getDaysOverdue(i.Due_Date);
      }
      return i;
    });

    if (search) {
      const s = search.toLowerCase();
      installments = installments.filter(i =>
        (i.Student_Name || '').toLowerCase().includes(s) ||
        (i.Course || '').toLowerCase().includes(s)
      );
    }

    if (filter !== 'All') {
      installments = installments.filter(i => i.Status === filter);
    }

    const countEl = document.getElementById('inst-count');
    if (countEl) countEl.textContent = `${installments.length} Installments`;

    if (!installments.length) {
      tableEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>No Installments Found</h3></div>`;
      return;
    }

    tableEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Course</th>
            <th>Inst. #</th>
            <th>Amount</th>
            <th>Due Date</th>
            <th>Paid</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Days Overdue</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${installments.map(i => `
            <tr style="${i.Status === 'Overdue' ? 'background:rgba(239,68,68,.03)' : ''}">
              <td>
                <div style="font-weight:600">${i.Student_Name}</div>
                <div style="font-size:0.75rem;color:var(--gray-400)">${i.Student_ID}</div>
              </td>
              <td>${i.Course}</td>
              <td>${i.Installment_Number}</td>
              <td style="font-weight:600">${formatCurrency(i.Installment_Amount)}</td>
              <td>${formatDate(i.Due_Date)}</td>
              <td style="color:var(--success);font-weight:600">${formatCurrency(i.Paid_Amount)}</td>
              <td style="color:${parseFloat(i.Remaining_Amount) > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:600">${formatCurrency(i.Remaining_Amount)}</td>
              <td>${getInstallmentStatusBadge(i.Status)}</td>
              <td>${i.Status === 'Overdue' ? `<span style="color:var(--danger);font-weight:700">${i.Days_Overdue} days</span>` : '—'}</td>
              <td>
                ${parseFloat(i.Remaining_Amount) > 0 ? `<button class="btn btn-sm btn-success" onclick="openRecordPayment('${i.Student_ID}')">💰 Pay</button>` : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  document.getElementById('inst-search').addEventListener('input', debounce(e => {
    loadInstTable(e.target.value, App.installmentFilter);
  }, 300));

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      App.installmentFilter = tab.getAttribute('data-filter');
      loadInstTable(document.getElementById('inst-search')?.value || '', App.installmentFilter);
    });
  });

  await loadInstTable();
}

// ============================================================
// REPORTS PAGE
// ============================================================
async function renderReports(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>📈 Reports & Analytics</h1>
        <p>Visual overview of fee collection and student performance</p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem" id="reports-grid">
      <div class="card" style="padding:3rem;text-align:center;grid-column:span 2"><div class="spinner" style="margin:0 auto"></div></div>
    </div>
  `;

  try {
    const data = await getReports();
    renderReportsContent(data);
  } catch (err) {
    console.error('Reports error:', err);
    showToast('error', 'Error', 'Failed to load reports.');
  }
}

function renderReportsContent(data) {
  const grid = document.getElementById('reports-grid');
  if (!grid) return;

  const daily = data.dailyCollection || [];
  const monthly = data.monthlyCollection || [];
  const courses = data.courseCollection || [];
  const pending = data.pendingFees || [];

  const maxDaily = daily.length ? Math.max(...daily.map(d => d.amount)) : 1;
  const maxMonthly = monthly.length ? Math.max(...monthly.map(m => m.amount)) : 1;
  const maxCourse = courses.length ? Math.max(...courses.map(c => c.amount)) : 1;

  grid.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">📅 Daily Collection (Last 7 Days)</div></div>
      <div class="card-body">
        ${daily.length ? daily.map(d => `
          <div class="chart-bar-row">
            <div class="chart-bar-label">${formatDate(d.date)}</div>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((d.amount / maxDaily) * 100)}%"></div></div>
            <div class="chart-bar-value">${formatCurrency(d.amount)}</div>
          </div>
        `).join('') : `<div class="empty-state" style="padding:2rem"><div class="empty-icon">📅</div><h3>No Data</h3></div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">📆 Monthly Collection (Last 6 Months)</div></div>
      <div class="card-body">
        ${monthly.length ? monthly.map(m => `
          <div class="chart-bar-row">
            <div class="chart-bar-label">${m.month}</div>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((m.amount / maxMonthly) * 100)}%;background:linear-gradient(90deg,var(--purple),var(--accent))"></div></div>
            <div class="chart-bar-value">${formatCurrency(m.amount)}</div>
          </div>
        `).join('') : `<div class="empty-state" style="padding:2rem"><div class="empty-icon">📆</div><h3>No Data</h3></div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">📚 Course-wise Collection</div></div>
      <div class="card-body">
        ${courses.length ? courses.map((c, idx) => {
          const colors = ['var(--primary-light)', 'var(--success)', 'var(--warning)', 'var(--purple)', 'var(--danger)', 'var(--accent)'];
          const col = colors[idx % colors.length];
          return `
          <div class="chart-bar-row">
            <div class="chart-bar-label" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.course}</div>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((c.amount / maxCourse) * 100)}%;background:linear-gradient(90deg,${col},${col}88)"></div></div>
            <div class="chart-bar-value">${formatCurrency(c.amount)}</div>
          </div>`;
        }).join('') : `<div class="empty-state" style="padding:2rem"><div class="empty-icon">📚</div><h3>No Data</h3></div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">⏳ Pending Fees by Student</div>
        <span class="badge badge-danger">${pending.length} Students</span>
      </div>
      <div class="table-wrapper">
        ${pending.length ? `
        <table class="table">
          <thead>
            <tr><th>Student</th><th>Course</th><th>Remaining</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${pending.map(p => `
              <tr>
                <td>
                  <div style="font-weight:600">${p.Student_Name}</div>
                  <div style="font-size:0.75rem;color:var(--gray-400)">${p.Student_ID}</div>
                </td>
                <td>${p.Course}</td>
                <td style="font-weight:700;color:var(--danger)">${formatCurrency(p.Remaining_Fee)}</td>
                <td>${getStatusBadge(p.Payment_Status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : `<div class="empty-state" style="padding:2rem"><div class="empty-icon">🎉</div><h3>No Pending Fees!</h3><p>All students are fully paid.</p></div>`}
      </div>
    </div>
  `;
}

// ============================================================
// SETTINGS PAGE
// ============================================================
async function renderSettings(container) {
  const settings = await getSettings();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>⚙️ Settings</h1>
        <p>Configure the Fee Management System</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="card">
        <div class="card-header"><div class="card-title">🏫 Institute Information</div></div>
        <div class="card-body">
          <div class="settings-section">
            <div class="form-grid" style="margin-bottom:1rem">
              <div class="form-group col-span-2">
                <label class="form-label">Institute Name</label>
                <input type="text" id="set-inst-name" class="form-control" value="${settings.Institute_Name || 'SKILLEZE TECHNOLOGIES'}">
              </div>
              <div class="form-group col-span-2">
                <label class="form-label">Address</label>
                <input type="text" id="set-address" class="form-control" value="${settings.Institute_Address || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Contact Number</label>
                <input type="tel" id="set-phone" class="form-control" value="${settings.Contact_Number || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="set-email" class="form-control" value="${settings.Email || ''}">
              </div>
              <div class="form-group col-span-2">
                <label class="form-label">Website</label>
                <input type="text" id="set-website" class="form-control" value="${settings.Website || 'www.skilleze.digiteease.com'}">
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">💰 Fee & Receipt Settings</div></div>
        <div class="card-body">
          <div class="settings-section">
            <div class="form-grid" style="margin-bottom:1rem">
              <div class="form-group">
                <label class="form-label">Receipt Prefix</label>
                <input type="text" id="set-receipt-prefix" class="form-control" value="${settings.Receipt_Prefix || 'SKZ'}">
                <span class="form-hint">e.g., SKZ → SKZ-2026-0001</span>
              </div>
              <div class="form-group">
                <label class="form-label">Default Installment Days</label>
                <input type="number" id="set-inst-days" class="form-control" value="${settings.Default_Installment_Days || '30'}">
              </div>
              <div class="form-group">
                <label class="form-label">Currency Symbol</label>
                <input type="text" id="set-currency" class="form-control" value="${settings.Currency_Symbol || '₹'}" style="max-width:80px">
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">🔗 Google Sheets Connection</div></div>
        <div class="card-body">
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Google Apps Script Web App URL</label>
            <input type="url" id="set-api-url" class="form-control" value="${typeof API_URL !== 'undefined' ? API_URL : ''}" placeholder="https://script.google.com/macros/...">
            <span class="form-hint">Paste your deployed Apps Script URL here. See SETUP.md for instructions.</span>
          </div>
          <div id="sheets-connection-status" style="padding:0.75rem;border-radius:var(--radius-md);font-size:0.85rem;margin-bottom:1rem;background:${_localStore.isConnectedToSheets ? 'var(--success-light)' : 'var(--warning-light)'};color:${_localStore.isConnectedToSheets ? 'var(--success-dark)' : 'var(--warning-dark)'}">
            ${_localStore.isConnectedToSheets ? '✅ Connected to Google Sheets' : 'ℹ️ Operating in Local Mode — Google Sheets not connected'}
          </div>
          <button class="btn btn-outline" id="btn-test-connection">🔌 Test Connection</button>
        </div>
      </div>

      <div class="card" style="border:2px solid var(--danger)">
        <div class="card-header" style="background:var(--danger-light)"><div class="card-title" style="color:var(--danger)">⚠️ Danger Zone</div></div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:0.75rem">
            <div style="padding:0.875rem;background:var(--danger-light);border-radius:var(--radius-md);font-size:0.85rem;color:var(--danger-dark)">
              ⚠️ These actions are irreversible. Proceed with caution.
            </div>
            <button class="btn btn-danger" id="btn-clear-sample">🗑️ Clear All Local Data</button>
            <div style="margin-top:0.5rem;padding:1rem;border:1px solid var(--danger);border-radius:var(--radius-md);background:#fff">
              <div style="font-weight:700;color:var(--danger);margin-bottom:0.35rem;font-size:0.95rem">🔴 Purge All Payments — Fresh Start</div>
              <div style="font-size:0.82rem;color:var(--gray-600);margin-bottom:0.75rem">Removes <strong>ALL payment records and installments</strong> from both the app and Google Sheets. Student profiles are kept. Payment IDs restart from PAY001. Completely irreversible.</div>
              <button class="btn btn-danger" onclick="openPurgeModal()" style="font-weight:700;letter-spacing:0.02em">🔴 Purge All Payments &amp; Reset IDs</button>
            </div>
            <button class="btn btn-outline-gray" onclick="navigateTo('settings')">🔄 Refresh Settings</button>
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top:1.5rem;display:flex;justify-content:flex-end">
      <button class="btn btn-primary btn-lg" id="btn-save-settings">💾 Save Settings</button>
    </div>
  `;

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-settings');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Saving...';

    try {
      const result = await saveSettings({
        Institute_Name: document.getElementById('set-inst-name').value.trim(),
        Institute_Address: document.getElementById('set-address').value.trim(),
        Contact_Number: document.getElementById('set-phone').value.trim(),
        Email: document.getElementById('set-email').value.trim(),
        Website: document.getElementById('set-website').value.trim(),
        Receipt_Prefix: document.getElementById('set-receipt-prefix').value.trim(),
        Default_Installment_Days: document.getElementById('set-inst-days').value.trim(),
        Currency_Symbol: document.getElementById('set-currency').value.trim()
      });

      // Update API URL if changed
      const newUrl = document.getElementById('set-api-url').value.trim();
      if (newUrl && newUrl !== API_URL) {
        // Store in a variable for runtime use (note: changing const at runtime)
        showToast('info', 'URL Updated', 'Reload the page to apply the new API URL.');
      }

      if (result.success) showToast('success', 'Saved', 'Settings saved successfully.');
    } catch (err) {
      showToast('error', 'Error', 'Failed to save settings.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '💾 Save Settings';
    }
  });

  document.getElementById('btn-test-connection').addEventListener('click', async () => {
    const btn = document.getElementById('btn-test-connection');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Testing...';

    const connected = await checkSheetsConnection();
    const statusEl = document.getElementById('sheets-connection-status');
    if (statusEl) {
      statusEl.style.background = connected ? 'var(--success-light)' : 'var(--danger-light)';
      statusEl.style.color = connected ? 'var(--success-dark)' : 'var(--danger-dark)';
      statusEl.textContent = connected ? '✅ Connected to Google Sheets successfully!' : '❌ Cannot connect to Google Sheets. Check your URL and deployment.';
    }

    btn.disabled = false;
    btn.innerHTML = '🔌 Test Connection';
  });

  document.getElementById('btn-clear-sample').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all data? This removes all students, payments, and installments.')) {
      _localStore.students = [];
      _localStore.payments = [];
      _localStore.installments = [];
      if (typeof persistLocalStore === 'function') persistLocalStore();
      showToast('success', 'Cleared', 'All data has been cleared. The system is ready for production use.');
      navigateTo(App.currentPage || 'dashboard');
    }
  });
}

// ============================================================
// RECEIPT PAGE — PROFESSIONAL INSTITUTIONAL VOUCHER & INVOICE
// ============================================================

function generateReceiptData(paymentId, studentId) {
  const payment  = _localStore.payments.find(p => p.Payment_ID === paymentId);
  const student  = _localStore.students.find(s => s.Student_ID === studentId);
  const settings = _localStore.settings || {};
  if (!payment || !student) return null;

  const prefix = settings.Receipt_Prefix || 'SKZ';
  const year   = new Date().getFullYear();
  const num    = (paymentId || '').replace('PAY', '').padStart(4, '0');
  const receiptNumber = `${prefix}-${year}-${num}`;

  const totalFee = parseFloat(student.Total_Fee || 0);
  const totalPaid = parseFloat(student.Total_Paid !== undefined ? student.Total_Paid : (student.Paid_Amount || 0));
  const remainingFee = parseFloat(student.Remaining_Fee !== undefined ? student.Remaining_Fee : Math.max(0, totalFee - totalPaid));
  const isFullPaid = remainingFee <= 0;

  let nextDueDate = '';
  let nextInstAmount = parseFloat(student.Next_Installment_Amount || 0);

  if (!isFullPaid) {
    // 1. Look for subsequent installment in local store
    if (Array.isArray(_localStore.installments)) {
      const currNum = parseInt(payment.Installment_Number) || 0;
      const nextInst = _localStore.installments.find(i =>
        i.Student_ID === studentId &&
        parseInt(i.Installment_Number) > currNum &&
        (i.Status === 'Pending' || i.Status === 'Overdue')
      );
      if (nextInst) {
        nextDueDate = nextInst.Due_Date || '';
        if (!nextInstAmount) nextInstAmount = parseFloat(nextInst.Installment_Amount || nextInst.Amount || 0);
      } else {
        const anyPending = _localStore.installments
          .filter(i => i.Student_ID === studentId && (i.Status === 'Pending' || i.Status === 'Overdue'))
          .sort((a, b) => new Date(a.Due_Date) - new Date(b.Due_Date))[0];
        if (anyPending) {
          nextDueDate = anyPending.Due_Date || '';
          if (!nextInstAmount) nextInstAmount = parseFloat(anyPending.Installment_Amount || anyPending.Amount || 0);
        }
      }
    }

    // 2. Fall back to student's Next_Due_Date
    if (!nextDueDate && student.Next_Due_Date) {
      nextDueDate = student.Next_Due_Date;
    }

    // 3. Fall back to 30 days after payment date
    if (!nextDueDate && payment.Payment_Date) {
      const d = new Date(payment.Payment_Date);
      const days = student.Installment_Plan === 'Weekly' ? 7 : student.Installment_Plan === 'Quarterly' ? 90 : 30;
      d.setDate(d.getDate() + days);
      nextDueDate = d.toISOString().split('T')[0];
    }
  }

  const numInstallments = parseInt(student.Num_Installments || student.No_Of_Installments || student.Installments || 1);

  return {
    receiptNumber,
    paymentId:         payment.Payment_ID,
    studentId:         student.Student_ID,
    studentName:       student.Student_Name,
    course:            student.Course || payment.Course || '—',
    batchId:           student.Batch_ID || '—',
    paymentDate:       payment.Payment_Date,
    amountPaid:        parseFloat(payment.Amount_Paid || 0),
    paymentMode:       payment.Payment_Mode || '—',
    transactionId:     payment.Transaction_ID || '',
    installmentNumber: payment.Installment_Number || 1,
    numInstallments:   numInstallments,
    totalFee:          totalFee,
    totalPaid:         totalPaid,
    remainingFee:      remainingFee,
    nextInstallment:   nextInstAmount,
    nextDueDate:       nextDueDate,
    paymentStatus:     student.Payment_Status || (isFullPaid ? 'Completed' : 'Partially Paid'),
    studentMobile:     student.Mobile || student.Phone || '—',
    studentCollege:    student.College_Org || student.College || '—',
    // Institute info
    instituteName:    settings.Institute_Name    || 'SKILLEZE TECHNOLOGIES',
    instituteAddress: settings.Institute_Address || '',
    contactNumber:    settings.Contact_Number    || '',
    email:            settings.Email             || '',
    website:          settings.Website           || '',
  };
}

// (Merged into the primary renderReceiptPage function below — this duplicate removed)

function renderReceiptDisplay(data) {
  if (!data) {
    showToast('warning', 'Error', 'Could not load receipt data.');
    return;
  }
  App.receiptData = data;
  const area = document.getElementById('receipt-display-area');
  if (!area) return;

  const settings = _localStore.settings || {};
  area.innerHTML = `
    <div style="display:flex;gap:1rem;justify-content:flex-end;margin-bottom:1rem;flex-wrap:wrap">
      <button class="btn btn-success" onclick="window.print()">🖨️ Print Receipt</button>
      <button class="btn btn-outline" onclick="copyReceiptSummary()">📋 Copy Summary</button>
    </div>
    ${generateReceiptSheetHTML(data, settings, 'STUDENT COPY')}
    <div style="margin-top:1.5rem;border-top:2px dashed var(--gray-200);padding-top:1.5rem">
      ${generateReceiptSheetHTML(data, settings, 'INSTITUTION COPY')}
    </div>
  `;

  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function numberToWords(amount) {
  const num = Math.round(parseFloat(amount) || 0);
  if (num === 0) return 'Zero';
  if (num < 0) return 'Minus ' + numberToWords(Math.abs(num));

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
             'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  }

  function convertHundreds(n) {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      str += inWords(n) + ' ';
    }
    return str.trim();
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  let rem = num % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  const hundreds = rem;

  if (crore > 0) words += convertHundreds(crore) + ' Crore ';
  if (lakh > 0) words += convertHundreds(lakh) + ' Lakh ';
  if (thousand > 0) words += convertHundreds(thousand) + ' Thousand ';
  if (hundreds > 0) words += convertHundreds(hundreds) + ' ';

  return words.trim();
}

function generateReceiptQR(receiptNumber, studentId, amount) {
  return `
    <svg viewBox="0 0 100 100" width="62" height="62" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#ffffff"/>
      <!-- Top-Left Finder -->
      <rect x="8" y="8" width="28" height="28" fill="#0d2257" rx="3"/>
      <rect x="14" y="14" width="16" height="16" fill="#ffffff" rx="2"/>
      <rect x="18" y="18" width="8" height="8" fill="#0d2257" rx="1"/>
      <!-- Top-Right Finder -->
      <rect x="64" y="8" width="28" height="28" fill="#0d2257" rx="3"/>
      <rect x="70" y="14" width="16" height="16" fill="#ffffff" rx="2"/>
      <rect x="74" y="18" width="8" height="8" fill="#0d2257" rx="1"/>
      <!-- Bottom-Left Finder -->
      <rect x="8" y="64" width="28" height="28" fill="#0d2257" rx="3"/>
      <rect x="14" y="70" width="16" height="16" fill="#ffffff" rx="2"/>
      <rect x="18" y="74" width="8" height="8" fill="#0d2257" rx="1"/>
      <!-- Data Matrices -->
      <rect x="42" y="10" width="6" height="6" fill="#0d2257"/>
      <rect x="52" y="10" width="6" height="6" fill="#0d2257"/>
      <rect x="46" y="20" width="8" height="6" fill="#0d2257"/>
      <rect x="40" y="30" width="6" height="8" fill="#0d2257"/>
      <rect x="50" y="30" width="8" height="6" fill="#0d2257"/>
      <rect x="10" y="42" width="6" height="6" fill="#0d2257"/>
      <rect x="22" y="44" width="8" height="6" fill="#0d2257"/>
      <rect x="36" y="42" width="8" height="8" fill="#0d2257"/>
      <rect x="48" y="44" width="6" height="8" fill="#0d2257"/>
      <rect x="60" y="42" width="8" height="6" fill="#0d2257"/>
      <rect x="74" y="44" width="6" height="8" fill="#0d2257"/>
      <rect x="86" y="42" width="6" height="6" fill="#0d2257"/>
      <rect x="10" y="52" width="8" height="6" fill="#0d2257"/>
      <rect x="24" y="52" width="6" height="8" fill="#0d2257"/>
      <rect x="36" y="54" width="6" height="6" fill="#0d2257"/>
      <rect x="48" y="54" width="8" height="6" fill="#0d2257"/>
      <rect x="62" y="52" width="6" height="8" fill="#0d2257"/>
      <rect x="76" y="54" width="8" height="6" fill="#0d2257"/>
      <rect x="88" y="52" width="6" height="6" fill="#0d2257"/>
      <rect x="42" y="66" width="6" height="8" fill="#0d2257"/>
      <rect x="52" y="64" width="8" height="6" fill="#0d2257"/>
      <rect x="66" y="66" width="6" height="6" fill="#0d2257"/>
      <rect x="78" y="64" width="6" height="8" fill="#0d2257"/>
      <rect x="40" y="78" width="8" height="6" fill="#0d2257"/>
      <rect x="54" y="76" width="6" height="8" fill="#0d2257"/>
      <rect x="66" y="78" width="8" height="6" fill="#0d2257"/>
      <rect x="80" y="76" width="6" height="8" fill="#0d2257"/>
      <rect x="46" y="88" width="8" height="6" fill="#0d2257"/>
      <rect x="60" y="86" width="6" height="8" fill="#0d2257"/>
      <rect x="72" y="88" width="8" height="6" fill="#0d2257"/>
      <rect x="86" y="86" width="6" height="6" fill="#0d2257"/>
    </svg>
  `;
}

function generateReceiptSheetHTML(data, settings, copyLabel = 'STUDENT COPY') {
  const isFullPaid = parseFloat(data.remainingFee) <= 0;
  const wordsAmount = numberToWords(data.amountPaid);
  const instituteName = settings.Institute_Name || 'SKILLEZE TECHNOLOGIES';

  return `
    <div class="official-receipt-sheet">
      <div class="receipt-watermark">SKILLEZE</div>
      <div class="receipt-content-layer">
        <!-- Letterhead Header (Centered Transparent Whole Logo & Brand Name) -->
        <header class="receipt-letterhead receipt-letterhead-centered">
          <div class="receipt-center-brand">
            <img src="assets/skilleze-logo-transparent.png" alt="Skilleze Technologies" class="brand-logo-full-center">
            <div class="org-subline">
              ${settings.Institute_Address || 'Flat No. 8A, Second Floor, Kanchana Kiran Apartment, behind Raymond Showroom, beside UCN Call Centre, Ramdaspeth, Nagpur, Maharashtra 440010'} &middot; 
              ${settings.Contact_Number ? `📞 ${settings.Contact_Number}` : '📞 +91 88051 57074, +91 9373630284'} &middot; 
              ${settings.Email ? `✉️ ${settings.Email}` : '✉️ grow@skilleze.digiteease.com'} &middot; 
              🌐 ${settings.Website || 'www.skilleze.digiteease.com'}
            </div>
          </div>

          <div class="receipt-voucher-meta-bar">
            <div class="voucher-title-badge">FEE PAYMENT RECEIPT</div>
            <div class="receipt-meta-inline">
              <span>Receipt No: <strong class="receipt-number-badge">${data.receiptNumber}</strong></span>
              <span>Issue Date: <strong>${formatDate(data.paymentDate)}</strong></span>
              <span>Academic Session: <strong>2026 — 2027</strong></span>
              <span class="copy-badge-pill">${copyLabel}</span>
            </div>
          </div>
        </header>

        <!-- Bento Metadata Cards -->
        <div class="receipt-bento-grid">
          <div class="receipt-bento-card">
            <div class="bento-header">
              <span>👤 Student Credentials</span>
              <span style="color:#2563eb;font-weight:800">${data.studentId}</span>
            </div>
            <div class="bento-body">
              <div class="receipt-info-row">
                <span class="info-label">Student Name</span>
                <span class="info-val" style="font-size:0.88rem;color:#0d2257">${data.studentName}</span>
              </div>
              <div class="receipt-info-row">
                <span class="info-label">Course Enrolled</span>
                <span class="info-val">${data.course}</span>
              </div>
              <div class="receipt-info-row">
                <span class="info-label">Contact Mobile</span>
                <span class="info-val">${data.studentMobile || '—'}</span>
              </div>
              <div class="receipt-info-row">
                <span class="info-label">College / Organization</span>
                <span class="info-val">${data.studentCollege || '—'}</span>
              </div>
            </div>
          </div>

          <div class="receipt-bento-card">
            <div class="bento-header">
              <span>💳 Transaction Reference</span>
              <span style="color:#10b981;font-weight:700">✓ Verified</span>
            </div>
            <div class="bento-body">
              <div class="receipt-info-row">
                <span class="info-label">Payment Date</span>
                <span class="info-val">${formatDate(data.paymentDate)}</span>
              </div>
              <div class="receipt-info-row">
                <span class="info-label">Payment Mode</span>
                <span class="info-val" style="color:#2563eb;font-weight:700">${data.paymentMode}</span>
              </div>
              <div class="receipt-info-row" style="align-items:flex-start">
                <span class="info-label" style="flex-shrink:0">Transaction / Ref ID</span>
                <span class="info-val" style="font-family:monospace;word-break:break-all;overflow-wrap:anywhere;text-align:right;max-width:65%;font-size:0.75rem">${data.transactionId || 'TXN-' + data.receiptNumber}</span>
              </div>
              <div class="receipt-info-row">
                <span class="info-label">Installment Stage</span>
                <span class="info-val">Installment #${data.installmentNumber} of ${data.numInstallments || 1}</span>
              </div>
              <div class="receipt-info-row">
                <span class="info-label">Next Installment Date</span>
                <span class="info-val" style="color:${isFullPaid ? '#059669' : '#b45309'};font-weight:700">
                  ${isFullPaid ? 'Nil (Full Fee Paid)' : (data.nextDueDate ? formatDate(data.nextDueDate) : 'As per schedule')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Particulars Accounting Table -->
        <table class="receipt-items-table">
          <thead>
            <tr>
              <th style="width:40px">#</th>
              <th>Particulars / Fee Component</th>
              <th style="width:130px">Fee Type</th>
              <th style="width:130px">Installment</th>
              <th style="width:150px;text-align:right">Amount Received</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <div class="receipt-item-desc">Training & Tuition Fee — ${data.course}</div>
                <div class="receipt-item-sub">Official Installment Payment &middot; Reference: ${data.receiptNumber}</div>
              </td>
              <td>Tuition Fee</td>
              <td>Inst. #${data.installmentNumber}</td>
              <td style="color:#059669;font-weight:800">${formatCurrency(data.amountPaid)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Amount In Words & Large Total Strip -->
        <div class="receipt-amount-strip">
          <div class="receipt-words-box">
            <div class="receipt-words-label">Amount in Words (INR):</div>
            <div class="receipt-words-text">Rupees ${wordsAmount} Only</div>
          </div>
          <div class="receipt-total-box">
            <div class="receipt-total-label">Total Amount Received</div>
            <div class="receipt-total-figure">${formatCurrency(data.amountPaid)}</div>
          </div>
        </div>

        <!-- Ledger / Balance Strip -->
        <div class="receipt-ledger-ribbon">
          <div class="ledger-cell cell-total">
            <div class="ledger-label">Total Course Fee</div>
            <div class="ledger-value">${formatCurrency(data.totalFee)}</div>
          </div>
          <div class="ledger-cell cell-paid">
            <div class="ledger-label">Cumulative Paid</div>
            <div class="ledger-value" style="color:#059669">${formatCurrency(data.totalPaid)}</div>
          </div>
          <div class="ledger-cell cell-due">
            <div class="ledger-label">Balance Outstanding</div>
            <div class="ledger-value" style="color:${isFullPaid ? '#059669' : '#dc2626'}">${formatCurrency(data.remainingFee)}</div>
          </div>
          <div class="ledger-cell cell-next">
            <div class="ledger-label">Next Installment Due</div>
            <div class="ledger-value" style="font-size:0.85rem">
              ${isFullPaid 
                ? '<span style="color:#059669">Nil (Completed)</span>'
                : (parseFloat(data.nextInstallment) > 0 ? formatCurrency(data.nextInstallment) : formatCurrency(data.remainingFee))
              }
            </div>
            <div class="ledger-sub-due" style="font-size:0.68rem;color:${isFullPaid ? '#059669' : '#b45309'};font-weight:700;margin-top:2px">
              ${isFullPaid ? '✓ All dues cleared' : 'Due: ' + (data.nextDueDate ? formatDate(data.nextDueDate) : 'As per schedule')}
            </div>
          </div>
        </div>

        <!-- Bottom Layout: Terms & Official Signatures (QR & Seal Removed) -->
        <div class="receipt-bottom-layout">
          <div class="receipt-declarations-box">
            <strong class="receipt-terms-heading">Official Terms &amp; Notice:</strong>
            <ol class="receipt-terms-list">
              <li>Computer-generated fee receipt issued by ${instituteName}.</li>
              <li>Fees once paid are non-refundable and non-transferable under all conditions.</li>
              <li>Online / Cheque payments are subject to standard bank realization.</li>
            </ol>
          </div>

          <div class="receipt-sig-block">
            <div class="sig-drawn-line"></div>
            <div class="sig-title">Authorized Signatory</div>
            <div class="sig-sub">${instituteName}</div>
          </div>
        </div>

        <!-- System Generated Disclaimer -->
        <div class="receipt-system-disclaimer">
          This is a system-generated payment receipt and does not require a physical signature.
        </div>

      </div>
    </div>
  `;
}

async function renderReceiptPage(container) {
  // If navigated here via the Receipt button, App.receiptData is already set
  const preloaded = App.receiptData;

  // If we already have receipt data, render full receipt view immediately
  if (preloaded) {
    const settings = _localStore.settings || {};
    const currentMode = App.receiptCopyType || 'student';

    let receiptSheetsHtml = '';
    if (currentMode === 'both') {
      receiptSheetsHtml = `
        ${generateReceiptSheetHTML(preloaded, settings, 'STUDENT COPY')}
        <div class="receipt-perforation"></div>
        ${generateReceiptSheetHTML(preloaded, settings, 'INSTITUTE RECORD COPY')}
      `;
    } else if (currentMode === 'office') {
      receiptSheetsHtml = generateReceiptSheetHTML(preloaded, settings, 'INSTITUTE RECORD COPY');
    } else {
      receiptSheetsHtml = generateReceiptSheetHTML(preloaded, settings, 'STUDENT COPY');
    }

    const backDestination = App.viewingStudentId ? 'Student Profile' : 'Payments';
    const backAction = App.viewingStudentId ? `navigateTo('student-profile')` : `navigateTo('payments')`;

    container.innerHTML = `
      <div class="receipt-page-view">
        <div class="receipt-action-bar no-print">
          <div class="receipt-action-left">
            <button class="btn btn-sm btn-outline-gray" onclick="${backAction}">
              ← Back to ${backDestination}
            </button>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span style="font-weight:700;color:var(--gray-800);font-size:0.95rem">Receipt:</span>
              <span class="receipt-number-badge">${preloaded.receiptNumber}</span>
            </div>
          </div>
          <div class="receipt-action-right">
            <div class="copy-mode-toggle">
              <button class="copy-mode-btn ${currentMode === 'student' ? 'active' : ''}" onclick="setReceiptCopyMode('student')">Student Copy</button>
              <button class="copy-mode-btn ${currentMode === 'office' ? 'active' : ''}" onclick="setReceiptCopyMode('office')">Office Copy</button>
              <button class="copy-mode-btn ${currentMode === 'both' ? 'active' : ''}" onclick="setReceiptCopyMode('both')">Both (Split Slip)</button>
            </div>
            <button class="btn btn-sm btn-outline-gray" onclick="copyReceiptSummary()">📋 Copy Info</button>
            <button class="btn btn-sm btn-primary" onclick="window.print()">🖨️ Print / Save PDF</button>
          </div>
        </div>
        <div class="receipt-preview-canvas">
          ${receiptSheetsHtml}
        </div>
      </div>
    `;
    return;
  }

  // No receipt pre-selected — show the payment picker
  const payments = await getPayments();
  const students = _localStore.students || [];

  const dropdownOptions = payments.slice().map(p => {
    const stu = students.find(s => s.Student_ID === p.Student_ID);
    const name = stu ? stu.Student_Name : p.Student_ID;
    return `<option value="${p.Payment_ID}" data-student="${p.Student_ID}">
      ${p.Payment_ID} &middot; ${name} &middot; ${formatCurrency(p.Amount_Paid)} (${p.Payment_Mode}) &middot; ${formatDate(p.Payment_Date)}
    </option>`;
  }).join('');

  container.innerHTML = `
    <div class="content-wrapper" style="max-width:760px;margin:2rem auto">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🖨️ Fee Receipt Generator</div>
          <button class="btn btn-sm btn-outline-gray" onclick="navigateTo('students')">View Students</button>
        </div>
        <div class="card-body">
          <div style="text-align:center;padding:1.5rem 0">
            <div style="font-size:3.5rem;margin-bottom:0.75rem">🧾</div>
            <h3 style="font-family:var(--font-heading);font-size:1.2rem;color:var(--gray-900);margin-bottom:0.5rem">Select a Payment to View or Print Receipt</h3>
            <p style="font-size:0.875rem;color:var(--gray-500);max-width:480px;margin:0 auto 1.5rem">
              Select any recorded student payment below to generate its official institutional receipt.
            </p>
          </div>
          <div style="border-top:1px solid var(--gray-200);padding-top:1.5rem">
            <label class="form-label" style="margin-bottom:0.5rem">Choose Recorded Payment</label>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
              <select id="select-receipt-payment" class="form-control" style="flex:1;min-width:260px">
                <option value="">-- Select a Recorded Payment --</option>
                ${dropdownOptions}
              </select>
              <button class="btn btn-primary" id="btn-generate-receipt">📄 Generate Receipt</button>
            </div>
            ${payments.length === 0 ? `<p style="color:var(--gray-400);margin-top:0.5rem;font-size:0.875rem">No payments recorded yet. <a href="#" onclick="navigateTo('students')">Add a student</a> and record a payment first.</p>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  const genBtn = document.getElementById('btn-generate-receipt');
  if (genBtn) genBtn.addEventListener('click', loadSelectedReceipt);
}

function setReceiptCopyMode(mode) {
  App.receiptCopyType = mode;
  const container = document.getElementById('page-container');
  if (container && App.currentPage === 'receipt') {
    renderReceiptPage(container);
  }
}

function copyReceiptSummary() {
  if (!App.receiptData) return;
  const d = App.receiptData;
  const summary = `
==================================================
SKILLEZE TECHNOLOGIES — OFFICIAL FEE RECEIPT
==================================================
Receipt Number   : ${d.receiptNumber}
Date of Payment  : ${formatDate(d.paymentDate)}
Student ID       : ${d.studentId}
Student Name     : ${d.studentName}
Course Enrolled  : ${d.course}
Installment No.  : #${d.installmentNumber}
Amount Paid      : ${formatCurrency(d.amountPaid)}
Amount in Words  : Indian Rupees ${numberToWords(d.amountPaid)} Only
Payment Mode     : ${d.paymentMode} ${d.transactionId ? `(Ref: ${d.transactionId})` : ''}
Total Fee        : ${formatCurrency(d.totalFee)}
Total Paid       : ${formatCurrency(d.totalPaid)}
Remaining Balance: ${formatCurrency(d.remainingFee)}
Payment Status   : ${d.paymentStatus}
==================================================
Official Computer Generated Receipt &middot; Verified
`.trim();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(summary).then(() => {
      showToast('success', 'Receipt Copied', 'Formatted receipt summary copied to clipboard.');
    }).catch(() => {
      showToast('info', 'Receipt Details', 'Receipt summary is ready.');
    });
  } else {
    showToast('success', 'Receipt Ready', `Receipt #${d.receiptNumber} verified.`);
  }
}

async function loadSelectedReceipt() {
  const sel = document.getElementById('select-receipt-payment');
  if (!sel || !sel.value) {
    showToast('warning', 'Selection Required', 'Please select a recorded payment from the dropdown.');
    return;
  }
  const paymentId = sel.value;
  const opt = sel.options[sel.selectedIndex];
  const studentId = opt.getAttribute('data-student');

  // Ensure local store is populated (important when Sheets Live is active)
  if (!_localStore.payments.find(p => p.Payment_ID === paymentId)) {
    const allPayments = await getPayments();
    _localStore.payments = allPayments;
  }
  if (!_localStore.students.find(s => s.Student_ID === studentId)) {
    const allStudents = await getStudents();
    _localStore.students = allStudents;
  }

  const data = generateReceiptData(paymentId, studentId);
  if (!data) {
    showToast('error', 'Error', 'Could not load receipt data. Please try again.');
    return;
  }
  // Store receipt data and re-render page in full receipt view
  App.receiptData = data;
  const container = document.getElementById('page-container');
  if (container) renderReceiptPage(container);
}


// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
