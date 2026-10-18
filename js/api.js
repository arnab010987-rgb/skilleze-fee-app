/**
 * SKILLEZE TECHNOLOGIES — Fee Payment Management System
 * API Layer (api.js)
 * 
 * Connects HTML/CSS/JS frontend to Google Apps Script Web App
 * which reads/writes Google Sheets.
 * 
 * Features:
 * - Ultra-fast local-first rendering (0ms startup latency)
 * - Stale-While-Revalidate caching with background Sheets sync
 * - In-flight request deduplication (prevents duplicate network calls)
 * - AbortController network timeouts to prevent UI hang
 * - Offline / Local Mode fallback
 */

// ============================================================
// SINGLE CONFIGURATION POINT — Replace with your actual URL
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbyx1WBNEUPVscZIZz6ByZo38qjce5PDjsL9JqYVuQrZ5sTbA2BdWtiOr1N_ZgdOU9XA/exec';

// ============================================================
// DATA STORE INITIALIZATION
// ============================================================
const SAMPLE_DATA = {
  students: [],
  payments: [],
  installments: []
};

// Official Institution Settings
const DEFAULT_SETTINGS = {
  Institute_Name: 'SKILLEZE TECHNOLOGIES',
  Institute_Address: 'Flat No. 8A, Second Floor, Kanchana Kiran Apartment, behind Raymond Showroom, beside UCN Call Centre, Ramdaspeth, Nagpur, Maharashtra 440010',
  Contact_Number: '+91 88051 57074, +91 9373630284',
  Email: 'grow@skilleze.digiteease.com',
  Website: 'www.skilleze.digiteease.com',
  Receipt_Prefix: 'SKZ',
  Default_Installment_Days: '30',
  Currency_Symbol: '₹'
};

// Local storage persistence helper
function loadLocalStore() {
  try {
    if (localStorage.getItem('skilleze_prod_clean_v2') !== 'true') {
      localStorage.removeItem('skilleze_fee_store_v2');
      localStorage.setItem('skilleze_prod_clean_v2', 'true');
    }

    const raw = localStorage.getItem('skilleze_fee_store_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        students: Array.isArray(parsed.students) ? parsed.students : [],
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        installments: Array.isArray(parsed.installments) ? parsed.installments : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        isConnectedToSheets: false,
        paymentIdCounter: parsed.paymentIdCounter || 1,
        studentIdCounter: parsed.studentIdCounter || 1,
        cachedDashboard: parsed.cachedDashboard || null,
        cachedDashboardTime: parsed.cachedDashboardTime || 0
      };
    }
  } catch (e) {
    console.warn('Could not read localStorage', e);
  }
  return {
    students: [],
    payments: [],
    installments: [],
    settings: { ...DEFAULT_SETTINGS },
    isConnectedToSheets: false,
    paymentIdCounter: 1,
    studentIdCounter: 1,
    cachedDashboard: null,
    cachedDashboardTime: 0
  };
}

function persistLocalStore() {
  try {
    localStorage.setItem('skilleze_fee_store_v2', JSON.stringify({
      students: _localStore.students,
      payments: _localStore.payments,
      installments: _localStore.installments,
      settings: _localStore.settings,
      paymentIdCounter: _localStore.paymentIdCounter,
      studentIdCounter: _localStore.studentIdCounter,
      cachedDashboard: _localStore.cachedDashboard,
      cachedDashboardTime: _localStore.cachedDashboardTime
    }));
  } catch (e) { }
}

let _localStore = loadLocalStore();

// ============================================================
// MEMORY CACHE & STATE
// ============================================================
let _isUsingLocalData = true; // Will be set to false if Sheets is connected

const _cache = {
  dashboard: null,
  dashboardTime: 0,
  students: null,
  studentsTime: 0,
  payments: null,
  paymentsTime: 0,
  installments: null,
  installmentsTime: 0,
  reports: null,
  reportsTime: 0
};

function clearCache() {
  _cache.dashboard = null;
  _cache.dashboardTime = 0;
  _cache.students = null;
  _cache.studentsTime = 0;
  _cache.payments = null;
  _cache.paymentsTime = 0;
  _cache.installments = null;
  _cache.installmentsTime = 0;
  _cache.reports = null;
  _cache.reportsTime = 0;
  _localStore.cachedDashboard = null;
  _localStore.cachedDashboardTime = 0;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function formatCurrency(amount, symbol = '₹') {
  const num = parseFloat(amount) || 0;
  return symbol + num.toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return dateStr; }
}

function toISODate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  } catch (e) { return dateStr; }
}

function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function calculateInstallmentStatus(dueDate, remaining, paid) {
  if (parseFloat(remaining) <= 0 && (parseFloat(paid) || 0) > 0) return 'Completed';
  if (parseFloat(paid) > 0 && parseFloat(remaining) <= 0) return 'Completed';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  if (isNaN(due.getTime())) return 'Upcoming';

  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due Today';
  if (diffDays <= 7) return 'Due Soon';
  return 'Upcoming';
}

function getDaysOverdue(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((today - due) / (1000 * 60 * 60 * 24)));
}

function generateStudentId() {
  const existing = _localStore.students.map(s => {
    const num = parseInt((s.Student_ID || '').replace('STU', ''), 10);
    return isNaN(num) ? 0 : num;
  });
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return 'STU' + String(max + 1).padStart(3, '0');
}

function generatePaymentId() {
  const existing = _localStore.payments.map(p => {
    const num = parseInt((p.Payment_ID || '').replace('PAY', ''), 10);
    return isNaN(num) ? 0 : num;
  });
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return 'PAY' + String(max + 1).padStart(3, '0');
}

function generateReceiptNumber(paymentId) {
  const year = new Date().getFullYear();
  const num = (paymentId || '').replace('PAY', '').padStart(4, '0');
  return `SKZ-${year}-${num}`;
}

// ============================================================
// HTTP HELPERS WITH TIMEOUT & DEDUPLICATION
// ============================================================
const REQUEST_TIMEOUT_MS = 10000;
const _inFlightRequests = new Map();

async function apiGet(params = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.append(k, v);
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    if (!res.ok) throw new Error('HTTP error ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function apiGetDeduped(params = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const key = JSON.stringify(params);
  if (_inFlightRequests.has(key)) {
    return _inFlightRequests.get(key);
  }
  const promise = apiGet(params, timeoutMs).finally(() => {
    _inFlightRequests.delete(key);
  });
  _inFlightRequests.set(key, promise);
  return promise;
}

async function apiPost(data = {}) {
  // NOTE: Use 'text/plain' to avoid CORS preflight
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    if (!res.ok) throw new Error('HTTP error ' + res.status);
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) {
      console.error('Apps Script returned non-JSON:', text.substring(0, 300));
      throw new Error('Non-JSON response from Apps Script');
    }
  } finally {
    clearTimeout(timer);
  }
}

// Check if Google Sheets is connected
async function checkSheetsConnection() {
  if (API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL' || !API_URL.startsWith('http')) {
    _isUsingLocalData = true;
    return false;
  }
  try {
    const res = await apiGetDeduped({ action: 'getDashboard' }, 8000);
    _isUsingLocalData = !res.success;
    _localStore.isConnectedToSheets = res.success;
    if (res.success && res.data) {
      _cache.dashboard = res.data;
      _cache.dashboardTime = Date.now();
      _localStore.cachedDashboard = res.data;
      _localStore.cachedDashboardTime = Date.now();
      persistLocalStore();

      // Background prefetch for instant tab switches
      setTimeout(prefetchSheetsData, 600);
    }
    return res.success;
  } catch (e) {
    _isUsingLocalData = true;
    _localStore.isConnectedToSheets = false;
    return false;
  }
}

function prefetchSheetsData() {
  if (_isUsingLocalData) return;
  if (!_cache.students || (Date.now() - _cache.studentsTime > 60000)) {
    apiGetDeduped({ action: 'getStudents' }).then(res => {
      if (res && res.success && Array.isArray(res.data)) {
        _localStore.students = res.data;
        _cache.students = res.data;
        _cache.studentsTime = Date.now();
        persistLocalStore();
      }
    }).catch(() => {});
  }
  if (!_cache.payments || (Date.now() - _cache.paymentsTime > 60000)) {
    apiGetDeduped({ action: 'getPayments' }).then(res => {
      if (res && res.success && Array.isArray(res.data)) {
        _localStore.payments = res.data;
        _cache.payments = res.data;
        _cache.paymentsTime = Date.now();
        persistLocalStore();
      }
    }).catch(() => {});
  }
  if (!_cache.installments || (Date.now() - _cache.installmentsTime > 60000)) {
    apiGetDeduped({ action: 'getInstallments' }).then(res => {
      if (res && res.success && Array.isArray(res.data)) {
        _localStore.installments = res.data;
        _cache.installments = res.data;
        _cache.installmentsTime = Date.now();
        persistLocalStore();
      }
    }).catch(() => {});
  }
}

// ============================================================
// STUDENT API FUNCTIONS
// ============================================================
async function getStudents(params = {}) {
  const { search = '', status = 'All', forceRefresh = false } = params;

  const filterStudents = (list) => {
    let students = [...list];
    if (search) {
      const q = search.toLowerCase();
      students = students.filter(s =>
        (s.Student_Name || '').toLowerCase().includes(q) ||
        (s.Student_ID || '').toLowerCase().includes(q) ||
        (s.Mobile || '').toString().includes(q) ||
        (s.Course || '').toLowerCase().includes(q)
      );
    }
    if (status && status !== 'All') {
      students = students.filter(s => s.Payment_Status === status);
    }
    return students;
  };

  const isFresh = _cache.students && (Date.now() - _cache.studentsTime < 60000);
  if (!forceRefresh && isFresh) {
    return filterStudents(_cache.students);
  }

  if (!forceRefresh && _localStore.students && _localStore.students.length > 0) {
    if (!_isUsingLocalData) {
      apiGetDeduped({ action: 'getStudents' }).then(res => {
        if (res && res.success && Array.isArray(res.data)) {
          _localStore.students = res.data;
          _cache.students = res.data;
          _cache.studentsTime = Date.now();
          persistLocalStore();
        }
      }).catch(() => {});
    }
    return filterStudents(_localStore.students);
  }

  if (!_isUsingLocalData) {
    try {
      const res = await apiGetDeduped({ action: 'getStudents' });
      if (res && res.success && Array.isArray(res.data)) {
        _localStore.students = res.data;
        _cache.students = res.data;
        _cache.studentsTime = Date.now();
        persistLocalStore();
        return filterStudents(res.data);
      }
    } catch (e) {
      console.warn('Remote getStudents failed, falling back to local', e);
    }
  }

  return filterStudents(_localStore.students || []);
}

async function getStudent(id) {
  const found = _localStore.students.find(s => s.Student_ID === id);
  if (found) return found;

  if (!_isUsingLocalData) {
    try {
      const res = await apiGetDeduped({ action: 'getStudent', id });
      if (res && res.success && res.data) return res.data;
    } catch (e) { }
  }
  return null;
}

async function addStudent(data) {
  clearCache();

  const studentId = generateStudentId();
  const now = new Date().toISOString();
  const totalFee = parseFloat(data.Total_Fee) || 0;
  const firstPayment = parseFloat(data.First_Payment_Amount) || 0;
  const totalPaid = firstPayment;
  const remaining = totalFee - totalPaid;
  const numInstallments = parseInt(data.Num_Installments) || 1;

  let nextInstallment = 0;
  if (remaining > 0 && numInstallments > 1) {
    nextInstallment = Math.ceil(remaining / (numInstallments - 1));
  } else if (remaining > 0) {
    nextInstallment = remaining;
  }

  let paymentStatus = 'Pending';
  if (remaining <= 0 && totalFee > 0) paymentStatus = 'Completed';
  else if (totalPaid > 0) paymentStatus = 'Partially Paid';

  const student = {
    Student_ID: studentId,
    Student_Name: data.Student_Name || '',
    Mobile: data.Mobile || '',
    Email: data.Email || '',
    Course: data.Course || '',
    Enrollment_Date: data.Enrollment_Date || now.split('T')[0],
    Total_Fee: totalFee,
    Installment_Plan: data.Installment_Plan || 'Monthly',
    Num_Installments: numInstallments,
    Total_Paid: totalPaid,
    Remaining_Fee: remaining,
    Next_Installment_Amount: nextInstallment,
    Next_Due_Date: data.Next_Due_Date || '',
    Payment_Status: paymentStatus,
    College_Org: data.College_Org || '',
    Address: data.Address || '',
    Notes: data.Notes || '',
    Created_At: now,
    Updated_At: now
  };

  _localStore.students.push(student);

  // Record initial payment
  if (firstPayment > 0) {
    const paymentId = generatePaymentId();
    const payment = {
      Payment_ID: paymentId,
      Student_ID: studentId,
      Student_Name: data.Student_Name,
      Course: data.Course,
      Payment_Date: data.First_Payment_Date || now.split('T')[0],
      Amount_Paid: firstPayment,
      Payment_Mode: 'Cash',
      Transaction_ID: '',
      Installment_Number: 1,
      Remaining_After_Payment: remaining,
      Remarks: 'Initial payment on enrollment',
      Created_At: now
    };
    _localStore.payments.push(payment);
    _createLocalInstallments(studentId, data.Student_Name, data.Course, totalFee, firstPayment, numInstallments, data.Next_Due_Date, data.Installment_Plan);
  } else {
    _createLocalInstallments(studentId, data.Student_Name, data.Course, totalFee, 0, numInstallments, data.Next_Due_Date || data.First_Payment_Date, data.Installment_Plan);
  }

  persistLocalStore();

  if (!_isUsingLocalData) {
    try {
      const res = await apiPost({ action: 'addStudent', data });
      if (res && res.success) {
        if (res.data?.studentId && res.data.studentId !== studentId) {
          const s = _localStore.students.find(x => x.Student_ID === studentId);
          if (s) s.Student_ID = res.data.studentId;
          _localStore.payments.forEach(p => { if (p.Student_ID === studentId) p.Student_ID = res.data.studentId; });
          _localStore.installments.forEach(i => { if (i.Student_ID === studentId) i.Student_ID = res.data.studentId; });
          persistLocalStore();
        }
        return res;
      }
    } catch (e) {
      console.warn('Remote addStudent failed, student kept locally', e);
    }
  }

  return { success: true, data: { studentId }, message: 'Student added successfully' };
}

function _createLocalInstallments(studentId, studentName, course, totalFee, firstPayment, numInstallments, firstDueDate, plan) {
  const remaining = totalFee - firstPayment;
  let installmentAmount = numInstallments > 1 ? Math.ceil(remaining / (numInstallments - 1)) : remaining;

  // First installment (paid if firstPayment > 0)
  if (firstPayment > 0) {
    _localStore.installments.push({
      Installment_ID: `INS-${studentId}-001`,
      Student_ID: studentId,
      Student_Name: studentName,
      Course: course,
      Installment_Number: 1,
      Installment_Amount: firstPayment,
      Due_Date: new Date().toISOString().split('T')[0],
      Paid_Amount: firstPayment,
      Remaining_Amount: 0,
      Status: 'Paid',
      Paid_Date: new Date().toISOString().split('T')[0]
    });
  }

  const startInst = firstPayment > 0 ? 2 : 1;
  let dueDateObj = firstDueDate ? new Date(firstDueDate) : new Date();

  for (let i = startInst; i <= numInstallments; i++) {
    const isLast = i === numInstallments;
    const amount = isLast ? Math.max(0, remaining - installmentAmount * (numInstallments - startInst)) : installmentAmount;
    _localStore.installments.push({
      Installment_ID: `INS-${studentId}-${String(i).padStart(3, '0')}`,
      Student_ID: studentId,
      Student_Name: studentName,
      Course: course,
      Installment_Number: i,
      Installment_Amount: Math.max(0, amount > 0 ? amount : installmentAmount),
      Due_Date: dueDateObj.toISOString().split('T')[0],
      Paid_Amount: 0,
      Remaining_Amount: Math.max(0, amount > 0 ? amount : installmentAmount),
      Status: calculateInstallmentStatus(dueDateObj.toISOString().split('T')[0], amount, 0),
      Paid_Date: ''
    });
    const days = plan === 'Weekly' ? 7 : plan === 'Quarterly' ? 90 : 30;
    dueDateObj = new Date(dueDateObj.getTime() + days * 24 * 60 * 60 * 1000);
  }
}

async function updateStudent(data) {
  clearCache();

  const idx = _localStore.students.findIndex(s => s.Student_ID === data.Student_ID);
  if (idx >= 0) {
    _localStore.students[idx] = { ..._localStore.students[idx], ...data, Updated_At: new Date().toISOString() };
    persistLocalStore();
  }

  if (!_isUsingLocalData) {
    try {
      const res = await apiPost({ action: 'updateStudent', data });
      if (res && res.success) return res;
    } catch (e) {
      console.warn('Remote updateStudent failed, updated locally', e);
    }
  }

  return { success: true, message: 'Student updated successfully' };
}

async function deleteStudent(studentId) {
  clearCache();

  _localStore.students = _localStore.students.filter(s => s.Student_ID !== studentId);
  _localStore.payments = _localStore.payments.filter(p => p.Student_ID !== studentId);
  _localStore.installments = _localStore.installments.filter(i => i.Student_ID !== studentId);
  persistLocalStore();

  if (!_isUsingLocalData) {
    try {
      const res = await apiPost({ action: 'deleteStudent', id: studentId });
      if (res && res.success) return res;
    } catch (e) {
      console.warn('Remote deleteStudent failed, deleted locally', e);
    }
  }

  return { success: true, message: 'Student deleted successfully' };
}

// ============================================================
// PAYMENT API FUNCTIONS
// ============================================================
async function recordPayment(data) {
  clearCache();

  const student = _localStore.students.find(s => s.Student_ID === data.Student_ID);
  if (!student) return { success: false, message: 'Student not found' };

  const amountPaid = parseFloat(data.Amount_Paid) || 0;
  if (amountPaid <= 0) return { success: false, message: 'Payment amount must be greater than 0' };

  const remaining = parseFloat(student.Remaining_Fee) || 0;
  if (amountPaid > remaining) return { success: false, message: 'Payment amount exceeds remaining fee' };

  const paymentId = generatePaymentId();
  const now = new Date().toISOString();
  const currentPaid = parseFloat(student.Total_Paid) || 0;
  const newTotalPaid = currentPaid + amountPaid;
  const newRemaining = parseFloat(student.Total_Fee || 0) - newTotalPaid;

  let paymentStatus = 'Partially Paid';
  if (newRemaining <= 0) paymentStatus = 'Completed';
  else if (newTotalPaid === 0) paymentStatus = 'Pending';

  const existingPayments = _localStore.payments.filter(p => p.Student_ID === data.Student_ID);
  const installmentNumber = parseInt(data.Installment_Number) || (existingPayments.length + 1);

  const numInstallments = parseInt(student.Num_Installments) || 1;
  const remainingInstallments = Math.max(0, numInstallments - installmentNumber);
  const nextInstallmentAmount = remainingInstallments > 0 ? Math.ceil(newRemaining / remainingInstallments) : newRemaining;

  let nextDueDate = '';
  if (newRemaining > 0) {
    const payDate = data.Payment_Date ? new Date(data.Payment_Date) : new Date();
    let days = 30;
    if (student.Installment_Plan === 'Weekly') days = 7;
    else if (student.Installment_Plan === 'Quarterly') days = 90;
    payDate.setDate(payDate.getDate() + days);
    nextDueDate = payDate.toISOString().split('T')[0];
  }

  student.Total_Paid = newTotalPaid;
  student.Remaining_Fee = newRemaining;
  student.Payment_Status = paymentStatus;
  student.Next_Installment_Amount = nextInstallmentAmount;
  student.Next_Due_Date = nextDueDate;
  student.Updated_At = now;

  const payment = {
    Payment_ID: paymentId,
    Student_ID: data.Student_ID,
    Student_Name: student.Student_Name,
    Course: student.Course,
    Payment_Date: data.Payment_Date || now.split('T')[0],
    Amount_Paid: amountPaid,
    Payment_Mode: data.Payment_Mode || 'Cash',
    Transaction_ID: data.Transaction_ID || '',
    Installment_Number: installmentNumber,
    Remaining_After_Payment: newRemaining,
    Remarks: data.Remarks || '',
    Created_At: now,
    Updated_At: now
  };
  _localStore.payments.push(payment);

  // Update installment status
  const instIdx = _localStore.installments.findIndex(
    i => i.Student_ID === data.Student_ID && parseInt(i.Installment_Number) === installmentNumber
  );
  if (instIdx >= 0) {
    _localStore.installments[instIdx].Paid_Amount = amountPaid;
    _localStore.installments[instIdx].Remaining_Amount = Math.max(0, _localStore.installments[instIdx].Installment_Amount - amountPaid);
    _localStore.installments[instIdx].Status = _localStore.installments[instIdx].Remaining_Amount <= 0 ? 'Completed' : 'Paid';
    _localStore.installments[instIdx].Paid_Date = data.Payment_Date || now.split('T')[0];
  }

  const receiptNumber = generateReceiptNumber(paymentId);
  persistLocalStore();

  if (!_isUsingLocalData) {
    try {
      const res = await apiPost({ action: 'addPayment', data });
      if (res && res.success) {
        return res;
      }
    } catch (e) {
      console.warn('Remote addPayment failed, payment kept locally', e);
    }
  }

  return {
    success: true,
    message: 'Payment recorded successfully',
    data: {
      paymentId,
      receiptNumber,
      newTotalPaid,
      newRemaining,
      nextInstallmentAmount,
      nextDueDate,
      paymentStatus,
      installmentNumber
    }
  };
}

async function getPayments(studentId = null, { forceRefresh = false } = {}) {
  const filterList = (list) => {
    let payments = [...list];
    if (studentId) payments = payments.filter(p => p.Student_ID === studentId);
    return payments;
  };

  const isFresh = _cache.payments && (Date.now() - _cache.paymentsTime < 60000);
  if (!forceRefresh && isFresh) {
    return filterList(_cache.payments);
  }

  if (!forceRefresh && _localStore.payments && _localStore.payments.length > 0) {
    if (!_isUsingLocalData) {
      apiGetDeduped({ action: 'getPayments' }).then(res => {
        if (res && res.success && Array.isArray(res.data)) {
          _localStore.payments = res.data;
          _cache.payments = res.data;
          _cache.paymentsTime = Date.now();
          persistLocalStore();
        }
      }).catch(() => {});
    }
    return filterList(_localStore.payments);
  }

  if (!_isUsingLocalData) {
    try {
      const res = await apiGetDeduped({ action: 'getPayments' });
      if (res && res.success && Array.isArray(res.data)) {
        _localStore.payments = res.data;
        _cache.payments = res.data;
        _cache.paymentsTime = Date.now();
        persistLocalStore();
        return filterList(res.data);
      }
    } catch (e) {
      console.warn('Remote getPayments failed, using local store', e);
    }
  }

  return filterList(_localStore.payments || []);
}

// ============================================================
// INSTALLMENT API FUNCTIONS
// ============================================================
async function getInstallments(studentId = null, { forceRefresh = false } = {}) {
  const mapStatuses = (list) => {
    return list.map(inst => ({
      ...inst,
      Status: inst.Status === 'Paid' || inst.Status === 'Completed'
        ? inst.Status
        : calculateInstallmentStatus(inst.Due_Date, inst.Remaining_Amount, inst.Paid_Amount),
      Days_Overdue: getDaysOverdue(inst.Due_Date)
    }));
  };

  const filterList = (list) => {
    let installments = [...list];
    if (studentId) installments = installments.filter(i => i.Student_ID === studentId);
    return mapStatuses(installments);
  };

  const isFresh = _cache.installments && (Date.now() - _cache.installmentsTime < 60000);
  if (!forceRefresh && isFresh) {
    return filterList(_cache.installments);
  }

  if (!forceRefresh && _localStore.installments && _localStore.installments.length > 0) {
    if (!_isUsingLocalData) {
      apiGetDeduped({ action: 'getInstallments' }).then(res => {
        if (res && res.success && Array.isArray(res.data)) {
          _localStore.installments = res.data;
          _cache.installments = res.data;
          _cache.installmentsTime = Date.now();
          persistLocalStore();
        }
      }).catch(() => {});
    }
    return filterList(_localStore.installments);
  }

  if (!_isUsingLocalData) {
    try {
      const res = await apiGetDeduped({ action: 'getInstallments' });
      if (res && res.success && Array.isArray(res.data)) {
        _localStore.installments = res.data;
        _cache.installments = res.data;
        _cache.installmentsTime = Date.now();
        persistLocalStore();
        return filterList(res.data);
      }
    } catch (e) {
      console.warn('Remote getInstallments failed, using local store', e);
    }
  }

  return filterList(_localStore.installments || []);
}

// ============================================================
// DASHBOARD API FUNCTION
// ============================================================
function computeLocalDashboard() {
  const students = _localStore.students || [];
  const payments = _localStore.payments || [];
  const installments = _localStore.installments || [];

  const totalStudents = students.length;
  const totalFees = students.reduce((sum, s) => sum + (parseFloat(s.Total_Fee) || 0), 0);
  const totalCollected = students.reduce((sum, s) => sum + (parseFloat(s.Total_Paid) || 0), 0);
  const totalPending = students.reduce((sum, s) => sum + (parseFloat(s.Remaining_Fee) || 0), 0);

  const paidCount = students.filter(s => s.Payment_Status === 'Completed').length;
  const partialCount = students.filter(s => s.Payment_Status === 'Partially Paid').length;
  const pendingCount = students.filter(s => s.Payment_Status === 'Pending').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeInstallments = installments.filter(i => i.Status !== 'Paid' && i.Status !== 'Completed');
  const dueTodayCount = activeInstallments.filter(i => {
    const d = new Date(i.Due_Date); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;
  const upcomingCount = activeInstallments.filter(i => {
    const d = new Date(i.Due_Date); d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    return diff > 0 && diff <= 7;
  }).length;
  const overdueCount = activeInstallments.filter(i => {
    const d = new Date(i.Due_Date); d.setHours(0, 0, 0, 0);
    return d < today;
  }).length;

  const recentPayments = [...payments].reverse().slice(0, 5);

  const overdueInstallments = activeInstallments
    .filter(i => {
      const d = new Date(i.Due_Date); d.setHours(0, 0, 0, 0);
      return d < today;
    })
    .map(i => ({ ...i, Days_Overdue: getDaysOverdue(i.Due_Date) }))
    .slice(0, 5);

  const upcomingInstallments = activeInstallments
    .filter(i => {
      const d = new Date(i.Due_Date); d.setHours(0, 0, 0, 0);
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 30;
    })
    .sort((a, b) => new Date(a.Due_Date) - new Date(b.Due_Date))
    .slice(0, 5);

  return {
    totalStudents, totalFees, totalCollected, totalPending,
    paidCount, partialCount, pendingCount, overdueCount,
    dueTodayCount, upcomingCount,
    recentPayments, overdueInstallments, upcomingInstallments
  };
}

function getCachedDashboard() {
  if (_cache.dashboard) return _cache.dashboard;
  if (_localStore.cachedDashboard) return _localStore.cachedDashboard;
  if (_localStore.students && _localStore.students.length > 0) return computeLocalDashboard();
  return null;
}

async function getDashboard({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = getCachedDashboard();
    const isFresh = _cache.dashboard && (Date.now() - _cache.dashboardTime < 60000);
    if (isFresh && cached) {
      return cached;
    }
    if (cached) {
      if (!_isUsingLocalData) {
        apiGetDeduped({ action: 'getDashboard' }).then(res => {
          if (res && res.success && res.data) {
            _cache.dashboard = res.data;
            _cache.dashboardTime = Date.now();
            _localStore.cachedDashboard = res.data;
            _localStore.cachedDashboardTime = Date.now();
            persistLocalStore();
          }
        }).catch(() => {});
      }
      return cached;
    }
  }

  if (!_isUsingLocalData) {
    try {
      const res = await apiGetDeduped({ action: 'getDashboard' });
      if (res && res.success && res.data) {
        _cache.dashboard = res.data;
        _cache.dashboardTime = Date.now();
        _localStore.cachedDashboard = res.data;
        _localStore.cachedDashboardTime = Date.now();
        persistLocalStore();
        return res.data;
      }
    } catch (e) {
      console.warn('Remote getDashboard failed, falling back to local calculation', e);
    }
  }

  return computeLocalDashboard();
}

// ============================================================
// REPORTS API FUNCTION
// ============================================================
async function getReports({ forceRefresh = false } = {}) {
  const isFresh = _cache.reports && (Date.now() - _cache.reportsTime < 60000);
  if (!forceRefresh && isFresh) {
    return _cache.reports;
  }

  if (!_isUsingLocalData) {
    try {
      const res = await apiGetDeduped({ action: 'getReports' });
      if (res && res.success && res.data) {
        _cache.reports = res.data;
        _cache.reportsTime = Date.now();
        return res.data;
      }
    } catch (e) {
      console.warn('Remote getReports failed, falling back to local calculation', e);
    }
  }

  const payments = _localStore.payments || [];
  const students = _localStore.students || [];

  const dailyMap = {};
  const monthlyMap = {};
  const courseMap = {};

  payments.forEach(p => {
    const date = p.Payment_Date ? new Date(p.Payment_Date) : null;
    const amount = parseFloat(p.Amount_Paid) || 0;
    const course = p.Course || 'Unknown';

    if (date && !isNaN(date)) {
      const dayKey = date.toISOString().split('T')[0];
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + amount;
      const monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + amount;
    }
    courseMap[course] = (courseMap[course] || 0) + amount;
  });

  const dailyCollection = Object.entries(dailyMap)
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)
    .map(([date, amount]) => ({ date, amount }));

  const monthlyCollection = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
    .map(([month, amount]) => ({ month, amount }));

  const courseCollection = Object.entries(courseMap)
    .sort((a, b) => b[1] - a[1])
    .map(([course, amount]) => ({ course, amount }));

  const pendingFees = students
    .filter(s => (parseFloat(s.Remaining_Fee) || 0) > 0)
    .map(s => ({ Student_ID: s.Student_ID, Student_Name: s.Student_Name, Course: s.Course, Remaining_Fee: s.Remaining_Fee, Payment_Status: s.Payment_Status }))
    .sort((a, b) => b.Remaining_Fee - a.Remaining_Fee);

  const localReports = { dailyCollection, monthlyCollection, courseCollection, pendingFees };
  _cache.reports = localReports;
  _cache.reportsTime = Date.now();
  return localReports;
}

// ============================================================
// SETTINGS API FUNCTION
// ============================================================
async function getSettings() {
  if (!_isUsingLocalData) {
    try {
      const res = await apiGetDeduped({ action: 'getSettings' });
      if (res && res.success) {
        _localStore.settings = res.data;
        persistLocalStore();
        return res.data;
      }
    } catch (e) { }
  }
  return _localStore.settings;
}

async function saveSettings(data) {
  if (!_isUsingLocalData) {
    try {
      const res = await apiPost({ action: 'updateSettings', data });
      if (res && res.success) {
        _localStore.settings = { ..._localStore.settings, ...data };
        persistLocalStore();
        return res;
      }
    } catch (e) { }
  }
  _localStore.settings = { ..._localStore.settings, ...data };
  persistLocalStore();
  return { success: true, message: 'Settings saved' };
}

// ============================================================
// RECEIPT GENERATION
// ============================================================
function generateReceiptData(paymentId, studentId) {
  const payment = _localStore.payments.find(p => p.Payment_ID === paymentId);
  const student = _localStore.students.find(s => s.Student_ID === studentId);
  if (!payment || !student) return null;

  let nextDueDate = student.Next_Due_Date || '';
  let nextInstAmount = student.Next_Installment_Amount || 0;
  if (!nextDueDate && Array.isArray(_localStore.installments)) {
    const pendingInst = _localStore.installments
      .filter(i => i.Student_ID === studentId && (i.Status === 'Pending' || i.Status === 'Overdue'))
      .sort((a, b) => new Date(a.Due_Date) - new Date(b.Due_Date))[0];
    if (pendingInst) {
      nextDueDate = pendingInst.Due_Date || '';
      if (!nextInstAmount) nextInstAmount = pendingInst.Amount || 0;
    }
  }

  return {
    receiptNumber: generateReceiptNumber(paymentId),
    paymentId: payment.Payment_ID,
    studentName: student.Student_Name,
    studentId: student.Student_ID,
    course: student.Course,
    paymentDate: payment.Payment_Date,
    amountPaid: payment.Amount_Paid,
    paymentMode: payment.Payment_Mode,
    transactionId: payment.Transaction_ID,
    totalFee: student.Total_Fee,
    totalPaid: student.Total_Paid,
    remainingFee: student.Remaining_Fee,
    nextInstallment: nextInstAmount || student.Next_Installment_Amount,
    nextDueDate: nextDueDate,
    paymentStatus: student.Payment_Status,
    installmentNumber: payment.Installment_Number,
    remarks: payment.Remarks,
    studentMobile: student.Mobile || '',
    studentEmail: student.Email || '',
    studentCollege: student.College_Org || '',
    studentAddress: student.Address || '',
    numInstallments: student.Num_Installments || 1,
    enrollmentDate: student.Enrollment_Date || '',
    createdDate: payment.Created_At || payment.Payment_Date
  };
}
