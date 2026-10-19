/**
 * SKILLEZE TECHNOLOGIES — Fee Payment Management System
 * Google Apps Script Backend (Code.gs)
 * 
 * SETUP:
 * 1. Create a Google Spreadsheet named "Skilleze_Fee_Management"
 * 2. Create sheets: Students, Payments, Installments, Settings
 * 3. Open Extensions → Apps Script
 * 4. Paste this code
 * 5. Deploy as Web App (Execute as: Me, Access: Anyone)
 * 6. Copy the Web App URL
 * 7. Paste URL into js/api.js as API_URL
 */

// ============================================================
// CONFIGURATION
// ============================================================
const SPREADSHEET_ID = '1lNMsy0wm04HAi9mQwEpcI7Dzing19x6IezF-yMI2oQM'; // Replace with your Google Spreadsheet ID
const SHEET_STUDENTS    = 'Students';
const SHEET_PAYMENTS    = 'Payments';
const SHEET_INSTALLMENTS = 'Installments';
const SHEET_SETTINGS    = 'Settings';

// NOTE: Apps Script /exec handles CORS automatically when deployed with
// "Who has access: Anyone". No custom headers are needed or supported.

// ============================================================
// doGet — Handle GET Requests
// ============================================================
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    let result;

    switch (action) {
      case 'getStudents':
        result = getStudents(e.parameter);
        break;
      case 'getStudent':
        result = getStudent(e.parameter.id);
        break;
      case 'getPayments':
        result = getPayments(e.parameter.studentId);
        break;
      case 'getInstallments':
        result = getInstallments(e.parameter.studentId);
        break;
      case 'getDashboard':
        result = getDashboard();
        break;
      case 'getReports':
        result = getReports(e.parameter);
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'initSheets':
        result = initializeSheets();
        break;
      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// doPost — Handle POST Requests
// ============================================================
function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      body = {};
    }

    const action = body.action || '';
    let result;

    switch (action) {
      case 'addStudent':
        result = addStudent(body.data);
        break;
      case 'updateStudent':
        result = updateStudent(body.data);
        break;
      case 'deleteStudent':
        result = deleteStudent(body.id);
        break;
      case 'addPayment':
        result = addPayment(body.data);
        break;
      case 'updatePayment':
        result = updatePayment(body.data);
        break;
      case 'deletePayment':
        result = deletePayment(body.id);
        break;
      case 'purgeAllPayments':
        result = purgeAllPayments();
        break;
      case 'updateSettings':
        result = updateSettings(body.data);
        break;
      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// SHEET INITIALIZATION
// ============================================================
function initializeSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Students Sheet
  let studentsSheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!studentsSheet) {
    studentsSheet = ss.insertSheet(SHEET_STUDENTS);
  }
  if (studentsSheet.getLastRow() === 0) {
    studentsSheet.appendRow([
      'Student_ID', 'Student_Name', 'Mobile', 'Email', 'Course',
      'Enrollment_Date', 'Total_Fee', 'Installment_Plan', 'Num_Installments',
      'Total_Paid', 'Remaining_Fee', 'Next_Installment_Amount',
      'Next_Due_Date', 'Payment_Status', 'College_Org', 'Address', 'Notes',
      'Created_At', 'Updated_At'
    ]);
    // Style header row
    studentsSheet.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#1a4bbd').setFontColor('#ffffff');
  }

  // Payments Sheet
  let paymentsSheet = ss.getSheetByName(SHEET_PAYMENTS);
  if (!paymentsSheet) {
    paymentsSheet = ss.insertSheet(SHEET_PAYMENTS);
  }
  if (paymentsSheet.getLastRow() === 0) {
    paymentsSheet.appendRow([
      'Payment_ID', 'Student_ID', 'Student_Name', 'Course',
      'Payment_Date', 'Amount_Paid', 'Payment_Mode', 'Transaction_ID',
      'Installment_Number', 'Remaining_After_Payment', 'Remarks', 'Created_At'
    ]);
    paymentsSheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#1a4bbd').setFontColor('#ffffff');
  }

  // Installments Sheet
  let installmentsSheet = ss.getSheetByName(SHEET_INSTALLMENTS);
  if (!installmentsSheet) {
    installmentsSheet = ss.insertSheet(SHEET_INSTALLMENTS);
  }
  if (installmentsSheet.getLastRow() === 0) {
    installmentsSheet.appendRow([
      'Installment_ID', 'Student_ID', 'Student_Name', 'Course',
      'Installment_Number', 'Installment_Amount', 'Due_Date',
      'Paid_Amount', 'Remaining_Amount', 'Status', 'Paid_Date'
    ]);
    installmentsSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#1a4bbd').setFontColor('#ffffff');
  }

  // Settings Sheet
  let settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_SETTINGS);
  }
  if (settingsSheet.getLastRow() === 0) {
    const defaultSettings = [
      ['Setting', 'Value'],
      ['Institute_Name', 'SKILLEZE TECHNOLOGIES'],
      ['Institute_Address', 'Flat No. 8A, Second Floor, Kanchana Kiran Apartment, behind Raymond Showroom, beside UCN Call Centre, Ramdaspeth, Nagpur, Maharashtra 440010'],
      ['Contact_Number', '+91 88051 57074, +91 9373630284'],
      ['Email', 'grow@skilleze.digiteease.com'],
      ['Website', 'www.skilleze.digiteease.com'],
      ['Logo_URL', 'assets/skilleze-logo.png'],
      ['Receipt_Prefix', 'SKZ'],
      ['Default_Installment_Days', '30'],
      ['Currency_Symbol', '₹'],
    ];
    settingsSheet.getRange(1, 1, defaultSettings.length, 2).setValues(defaultSettings);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1a4bbd').setFontColor('#ffffff');
  }

  return { success: true, message: 'Sheets initialized successfully' };
}

// ============================================================
// STUDENT FUNCTIONS
// ============================================================
function getStudents(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const students = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // Skip empty rows
    const student = {};
    headers.forEach((h, idx) => { student[h] = row[idx]; });

    // Apply filters
    if (params && params.status && params.status !== 'All') {
      if (student.Payment_Status !== params.status) continue;
    }
    if (params && params.search) {
      const search = params.search.toLowerCase();
      const name = (student.Student_Name || '').toLowerCase();
      const id = (student.Student_ID || '').toLowerCase();
      const mobile = (student.Mobile || '').toString().toLowerCase();
      const course = (student.Course || '').toLowerCase();
      if (!name.includes(search) && !id.includes(search) && !mobile.includes(search) && !course.includes(search)) {
        continue;
      }
    }
    students.push(student);
  }

  return { success: true, data: students };
}

function getStudent(studentId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet) return { success: false, message: 'Sheet not found' };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == studentId) {
      const student = {};
      headers.forEach((h, idx) => { student[h] = data[i][idx]; });
      return { success: true, data: student };
    }
  }
  return { success: false, message: 'Student not found' };
}

function generateStudentId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'STU001';

  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const id = data[i][0] ? data[i][0].toString() : '';
    if (id.startsWith('STU')) {
      const num = parseInt(id.replace('STU', ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return 'STU' + String(maxNum + 1).padStart(3, '0');
}

function addStudent(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet) return { success: false, message: 'Students sheet not found' };

  const studentId = generateStudentId(sheet);
  const now = new Date().toISOString();
  const totalFee = parseFloat(data.Total_Fee) || 0;
  const firstPayment = parseFloat(data.First_Payment_Amount) || 0;
  const totalPaid = firstPayment;
  const remaining = totalFee - totalPaid;
  const numInstallments = parseInt(data.Num_Installments) || 1;
  const nextInstallment = numInstallments > 1 ? Math.ceil(remaining / (numInstallments - 1)) : (remaining > 0 ? remaining : 0);
  let paymentStatus = 'Pending';
  if (remaining <= 0) paymentStatus = 'Completed';
  else if (totalPaid > 0) paymentStatus = 'Partially Paid';

  sheet.appendRow([
    studentId,
    data.Student_Name || '',
    data.Mobile || '',
    data.Email || '',
    data.Course || '',
    data.Enrollment_Date || '',
    totalFee,
    data.Installment_Plan || '',
    numInstallments,
    totalPaid,
    remaining,
    nextInstallment,
    data.Next_Due_Date || '',
    paymentStatus,
    data.College_Org || '',
    data.Address || '',
    data.Notes || '',
    now,
    now
  ]);

  // Record first payment if amount > 0
  if (firstPayment > 0) {
    addPayment({
      Student_ID: studentId,
      Student_Name: data.Student_Name,
      Course: data.Course,
      Payment_Date: data.First_Payment_Date || now,
      Amount_Paid: firstPayment,
      Payment_Mode: 'Cash',
      Transaction_ID: '',
      Installment_Number: 1,
      Remaining_After_Payment: remaining,
      Remarks: 'Initial payment on enrollment'
    });

    // Create installments
    createInstallments(studentId, data.Student_Name, data.Course, totalFee, firstPayment, numInstallments, data.Next_Due_Date, data.Installment_Plan);
  }

  return { success: true, data: { studentId }, message: 'Student added successfully' };
}

function updateStudent(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet) return { success: false, message: 'Students sheet not found' };

  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] == data.Student_ID) {
      const row = i + 1;
      const now = new Date().toISOString();
      // Update specific fields
      if (data.Student_Name !== undefined)  sheet.getRange(row, 2).setValue(data.Student_Name);
      if (data.Mobile !== undefined)        sheet.getRange(row, 3).setValue(data.Mobile);
      if (data.Email !== undefined)         sheet.getRange(row, 4).setValue(data.Email);
      if (data.Course !== undefined)        sheet.getRange(row, 5).setValue(data.Course);
      if (data.Total_Fee !== undefined)     sheet.getRange(row, 7).setValue(data.Total_Fee);
      if (data.Total_Paid !== undefined)    sheet.getRange(row, 10).setValue(data.Total_Paid);
      if (data.Remaining_Fee !== undefined) sheet.getRange(row, 11).setValue(data.Remaining_Fee);
      if (data.Next_Installment_Amount !== undefined) sheet.getRange(row, 12).setValue(data.Next_Installment_Amount);
      if (data.Next_Due_Date !== undefined) sheet.getRange(row, 13).setValue(data.Next_Due_Date);
      if (data.Payment_Status !== undefined) sheet.getRange(row, 14).setValue(data.Payment_Status);
      if (data.College_Org !== undefined)   sheet.getRange(row, 15).setValue(data.College_Org);
      if (data.Address !== undefined)       sheet.getRange(row, 16).setValue(data.Address);
      if (data.Notes !== undefined)         sheet.getRange(row, 17).setValue(data.Notes);
      sheet.getRange(row, 19).setValue(now);
      return { success: true, message: 'Student updated successfully' };
    }
  }
  return { success: false, message: 'Student not found' };
}

function deleteStudent(studentId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Remove from Students sheet
  const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
  if (stuSheet) {
    const stuData = stuSheet.getDataRange().getValues();
    for (let i = stuData.length - 1; i >= 1; i--) {
      if (stuData[i][0] == studentId) {
        stuSheet.deleteRow(i + 1);
        break;
      }
    }
  }

  // Remove all Payments for this student
  const paySheet = ss.getSheetByName(SHEET_PAYMENTS);
  if (paySheet && paySheet.getLastRow() > 1) {
    const payData = paySheet.getDataRange().getValues();
    for (let i = payData.length - 1; i >= 1; i--) {
      if (payData[i][1] == studentId) {
        paySheet.deleteRow(i + 1);
      }
    }
  }

  // Remove all Installments for this student
  const instSheet = ss.getSheetByName(SHEET_INSTALLMENTS);
  if (instSheet && instSheet.getLastRow() > 1) {
    const instData = instSheet.getDataRange().getValues();
    for (let i = instData.length - 1; i >= 1; i--) {
      if (instData[i][1] == studentId) {
        instSheet.deleteRow(i + 1);
      }
    }
  }

  return { success: true, message: 'Student and all related records deleted successfully' };
}

function deletePayment(paymentId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PAYMENTS);
  if (!sheet) return { success: false, message: 'Payments sheet not found' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == paymentId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Payment deleted successfully' };
    }
  }
  return { success: false, message: 'Payment not found' };
}

function updatePayment(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const paySheet = ss.getSheetByName(SHEET_PAYMENTS);
  const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!paySheet || !stuSheet) return { success: false, message: 'Required sheets not found' };

  const paymentId = data.Payment_ID;
  const payData = paySheet.getDataRange().getValues();
  let payRow = -1;
  let studentId = data.Student_ID;

  for (let i = 1; i < payData.length; i++) {
    if (payData[i][0] == paymentId) {
      payRow = i + 1;
      if (!studentId) studentId = payData[i][1];
      break;
    }
  }

  if (payRow < 0) return { success: false, message: 'Payment record not found' };

  // Get student row
  const stuData = stuSheet.getDataRange().getValues();
  let stuRow = -1;
  for (let i = 1; i < stuData.length; i++) {
    if (stuData[i][0] == studentId) {
      stuRow = i + 1;
      break;
    }
  }

  const now = new Date().toISOString();
  const amountPaid = parseFloat(data.Amount_Paid) || parseFloat(payData[payRow - 1][5]) || 0;
  const paymentDate = data.Payment_Date || payData[payRow - 1][4];
  const paymentMode = data.Payment_Mode || payData[payRow - 1][6];
  const txnId = data.Transaction_ID !== undefined ? data.Transaction_ID : payData[payRow - 1][7];
  const instNo = data.Installment_Number !== undefined ? parseInt(data.Installment_Number) : payData[payRow - 1][8];
  const remarks = data.Remarks !== undefined ? data.Remarks : payData[payRow - 1][10];

  // Update payment row in Payments sheet
  paySheet.getRange(payRow, 5).setValue(paymentDate);
  paySheet.getRange(payRow, 6).setValue(amountPaid);
  paySheet.getRange(payRow, 7).setValue(paymentMode);
  paySheet.getRange(payRow, 8).setValue(txnId);
  paySheet.getRange(payRow, 9).setValue(instNo);
  paySheet.getRange(payRow, 11).setValue(remarks);

  // Recalculate student financials if student exists
  let newTotalPaid = 0;
  let newRemaining = 0;
  let paymentStatus = 'Pending';
  if (stuRow > 0) {
    const totalFee = parseFloat(stuData[stuRow - 1][6]) || 0;
    // Re-sum all payments for this student
    const updatedPayData = paySheet.getDataRange().getValues();
    for (let i = 1; i < updatedPayData.length; i++) {
      if (updatedPayData[i][1] == studentId) {
        newTotalPaid += parseFloat(updatedPayData[i][5]) || 0;
      }
    }
    newRemaining = Math.max(0, totalFee - newTotalPaid);
    if (newRemaining <= 0 && totalFee > 0) {
      paymentStatus = 'Completed';
    } else if (newTotalPaid > 0) {
      paymentStatus = 'Partially Paid';
    } else {
      paymentStatus = 'Pending';
    }

    // Update student row
    stuSheet.getRange(stuRow, 10).setValue(newTotalPaid);
    stuSheet.getRange(stuRow, 11).setValue(newRemaining);
    stuSheet.getRange(stuRow, 14).setValue(paymentStatus);
    stuSheet.getRange(stuRow, 19).setValue(now);

    // Update Remaining_After_Payment on this payment row
    paySheet.getRange(payRow, 10).setValue(newRemaining);

    // Update installment row if exists
    updateInstallmentStatus(studentId, instNo, amountPaid, newRemaining, paymentDate);
  }

  return {
    success: true,
    message: 'Payment updated successfully',
    data: {
      paymentId: paymentId,
      newTotalPaid: newTotalPaid,
      newRemaining: newRemaining,
      paymentStatus: paymentStatus
    }
  };
}

function purgeAllPayments() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Clear Payments sheet (keep header)
  const paySheet = ss.getSheetByName(SHEET_PAYMENTS);
  if (paySheet && paySheet.getLastRow() > 1) {
    paySheet.deleteRows(2, paySheet.getLastRow() - 1);
  }

  // Clear Installments sheet (keep header)
  const instSheet = ss.getSheetByName(SHEET_INSTALLMENTS);
  if (instSheet && instSheet.getLastRow() > 1) {
    instSheet.deleteRows(2, instSheet.getLastRow() - 1);
  }

  // Reset Total_Paid, Remaining_Fee, Payment_Status on all students
  const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
  if (stuSheet && stuSheet.getLastRow() > 1) {
    const stuData = stuSheet.getDataRange().getValues();
    const now = new Date().toISOString();
    for (let i = 1; i < stuData.length; i++) {
      if (!stuData[i][0]) continue;
      const totalFee = parseFloat(stuData[i][6]) || 0;
      stuSheet.getRange(i + 1, 10).setValue(0);           // Total_Paid
      stuSheet.getRange(i + 1, 11).setValue(totalFee);    // Remaining_Fee
      stuSheet.getRange(i + 1, 12).setValue(0);           // Next_Installment_Amount
      stuSheet.getRange(i + 1, 13).setValue('');          // Next_Due_Date
      stuSheet.getRange(i + 1, 14).setValue('Pending');   // Payment_Status
      stuSheet.getRange(i + 1, 19).setValue(now);         // Updated_At
    }
  }

  return { success: true, message: 'All payments and installments purged. Student payment statuses reset.' };
}

// ============================================================
// PAYMENT FUNCTIONS
// ============================================================
function generatePaymentId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'PAY001';

  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const id = data[i][0] ? data[i][0].toString() : '';
    if (id.startsWith('PAY')) {
      const num = parseInt(id.replace('PAY', ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return 'PAY' + String(maxNum + 1).padStart(3, '0');
}

function getPayments(studentId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PAYMENTS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const payments = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (studentId && row[1] != studentId) continue;
    const payment = {};
    headers.forEach((h, idx) => { payment[h] = row[idx]; });
    payments.push(payment);
  }

  payments.reverse(); // latest first
  return { success: true, data: payments };
}

function addPayment(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const paySheet = ss.getSheetByName(SHEET_PAYMENTS);
  const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!paySheet || !stuSheet) return { success: false, message: 'Required sheets not found' };

  // Get student
  const stuData = stuSheet.getDataRange().getValues();
  let stuRow = -1;
  for (let i = 1; i < stuData.length; i++) {
    if (stuData[i][0] == data.Student_ID) { stuRow = i + 1; break; }
  }
  if (stuRow < 0) return { success: false, message: 'Student not found' };

  const totalFee = parseFloat(stuData[stuRow - 1][6]) || 0;
  const currentPaid = parseFloat(stuData[stuRow - 1][9]) || 0;
  const amountPaid = parseFloat(data.Amount_Paid) || 0;

  if (amountPaid <= 0) return { success: false, message: 'Payment amount must be greater than 0' };

  const remaining = totalFee - currentPaid;
  if (amountPaid > remaining) return { success: false, message: 'Payment amount exceeds remaining fee' };

  const newTotalPaid = currentPaid + amountPaid;
  const newRemaining = totalFee - newTotalPaid;

  let paymentStatus = 'Partially Paid';
  if (newRemaining <= 0) paymentStatus = 'Completed';
  else if (newTotalPaid === 0) paymentStatus = 'Pending';

  const numInstallments = parseInt(stuData[stuRow - 1][8]) || 1;
  const installmentNumber = parseInt(data.Installment_Number) || getNextInstallmentNumber(data.Student_ID, paySheet);
  const paidInstallments = installmentNumber;
  const remainingInstallments = numInstallments - paidInstallments;
  const nextInstallmentAmount = remainingInstallments > 0 ? Math.ceil(newRemaining / remainingInstallments) : 0;
  const nextDueDate = remainingInstallments > 0 ? calculateNextDueDate(data.Payment_Date, stuData[stuRow - 1][7]) : '';

  // Save payment
  const now = new Date().toISOString();
  const paymentId = generatePaymentId(paySheet);
  paySheet.appendRow([
    paymentId,
    data.Student_ID,
    data.Student_Name || stuData[stuRow - 1][1],
    data.Course || stuData[stuRow - 1][4],
    data.Payment_Date || now,
    amountPaid,
    data.Payment_Mode || 'Cash',
    data.Transaction_ID || '',
    installmentNumber,
    newRemaining,
    data.Remarks || '',
    now
  ]);

  // Update student record
  stuSheet.getRange(stuRow, 10).setValue(newTotalPaid);
  stuSheet.getRange(stuRow, 11).setValue(newRemaining);
  stuSheet.getRange(stuRow, 12).setValue(nextInstallmentAmount);
  stuSheet.getRange(stuRow, 13).setValue(nextDueDate);
  stuSheet.getRange(stuRow, 14).setValue(paymentStatus);
  stuSheet.getRange(stuRow, 19).setValue(now);

  // Update installment status
  updateInstallmentStatus(data.Student_ID, installmentNumber, amountPaid, newRemaining, data.Payment_Date || now);

  // Generate receipt number
  const receiptNumber = 'SKZ-' + new Date().getFullYear() + '-' + paymentId.replace('PAY', '').padStart(4, '0');

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

function getNextInstallmentNumber(studentId, paySheet) {
  const data = paySheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == studentId) {
      const num = parseInt(data[i][8]) || 0;
      if (num > max) max = num;
    }
  }
  return max + 1;
}

function calculateNextDueDate(paymentDate, installmentPlan) {
  const date = new Date(paymentDate);
  let days = 30;
  if (installmentPlan === 'Weekly') days = 7;
  else if (installmentPlan === 'Quarterly') days = 90;
  else if (installmentPlan === 'Yearly') days = 365;
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// ============================================================
// INSTALLMENT FUNCTIONS
// ============================================================
function createInstallments(studentId, studentName, course, totalFee, firstPayment, numInstallments, firstDueDate, plan) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_INSTALLMENTS);
  if (!sheet) return;

  const remaining = totalFee - firstPayment;
  const installmentAmount = numInstallments > 1 ? Math.ceil(remaining / (numInstallments - 1)) : remaining;
  const now = new Date();

  // First installment (already paid)
  sheet.appendRow([
    'INS-' + studentId + '-001', studentId, studentName, course,
    1, firstPayment, new Date().toISOString().split('T')[0],
    firstPayment, 0, 'Paid', new Date().toISOString().split('T')[0]
  ]);

  // Remaining installments
  let dueDate = firstDueDate ? new Date(firstDueDate) : new Date();
  for (let i = 2; i <= numInstallments; i++) {
    const amount = (i === numInstallments) ? (remaining - installmentAmount * (numInstallments - 2)) : installmentAmount;
    const dueDateStr = dueDate.toISOString().split('T')[0];
    const installId = 'INS-' + studentId + '-' + String(i).padStart(3, '0');
    sheet.appendRow([
      installId, studentId, studentName, course,
      i, Math.max(0, amount), dueDateStr,
      0, Math.max(0, amount), 'Upcoming', ''
    ]);
    // Next due date
    let days = 30;
    if (plan === 'Weekly') days = 7;
    else if (plan === 'Quarterly') days = 90;
    dueDate.setDate(dueDate.getDate() + days);
  }
}

function getInstallments(studentId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_INSTALLMENTS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const installments = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (studentId && row[1] != studentId) continue;

    const inst = {};
    headers.forEach((h, idx) => { inst[h] = row[idx]; });

    // Auto-calculate status
    if (inst.Status !== 'Paid' && inst.Status !== 'Completed') {
      const dueDate = new Date(inst.Due_Date);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

      if (parseFloat(inst.Remaining_Amount) <= 0) {
        inst.Status = 'Completed';
      } else if (diffDays < 0) {
        inst.Status = 'Overdue';
        inst.Days_Overdue = Math.abs(diffDays);
      } else if (diffDays === 0) {
        inst.Status = 'Due Today';
      } else if (diffDays <= 7) {
        inst.Status = 'Due Soon';
      } else {
        inst.Status = 'Upcoming';
      }
    }
    installments.push(inst);
  }

  return { success: true, data: installments };
}

function updateInstallmentStatus(studentId, installmentNumber, paidAmount, remainingAmount, paidDate) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_INSTALLMENTS);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == studentId && data[i][4] == installmentNumber) {
      const row = i + 1;
      sheet.getRange(row, 8).setValue(paidAmount);
      sheet.getRange(row, 9).setValue(Math.max(0, parseFloat(data[i][6]) - paidAmount));
      sheet.getRange(row, 10).setValue(remainingAmount <= 0 ? 'Completed' : 'Paid');
      sheet.getRange(row, 11).setValue(paidDate);
      break;
    }
  }
}

// ============================================================
// DASHBOARD
// ============================================================
function getDashboard() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const stuSheet = ss.getSheetByName(SHEET_STUDENTS);
  const paySheet = ss.getSheetByName(SHEET_PAYMENTS);
  const instSheet = ss.getSheetByName(SHEET_INSTALLMENTS);

  let totalStudents = 0, totalFees = 0, totalCollected = 0, totalPending = 0;
  let paidCount = 0, partialCount = 0, pendingCount = 0, overdueCount = 0;

  if (stuSheet && stuSheet.getLastRow() > 1) {
    const stuData = stuSheet.getDataRange().getValues();
    for (let i = 1; i < stuData.length; i++) {
      if (!stuData[i][0]) continue;
      totalStudents++;
      totalFees += parseFloat(stuData[i][6]) || 0;
      totalCollected += parseFloat(stuData[i][9]) || 0;
      totalPending += parseFloat(stuData[i][10]) || 0;
      const status = stuData[i][13];
      if (status === 'Completed') paidCount++;
      else if (status === 'Partially Paid') partialCount++;
      else if (status === 'Pending') pendingCount++;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let dueTodayCount = 0, upcomingCount = 0;

  if (instSheet && instSheet.getLastRow() > 1) {
    const instData = instSheet.getDataRange().getValues();
    for (let i = 1; i < instData.length; i++) {
      if (!instData[i][0]) continue;
      const status = instData[i][9];
      if (status === 'Paid' || status === 'Completed') continue;
      const dueDate = new Date(instData[i][6]);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) overdueCount++;
      else if (diffDays === 0) dueTodayCount++;
      else if (diffDays <= 7) upcomingCount++;
    }
  }

  // Recent payments (last 5)
  let recentPayments = [];
  if (paySheet && paySheet.getLastRow() > 1) {
    const payData = paySheet.getDataRange().getValues();
    const payHeaders = payData[0];
    for (let i = payData.length - 1; i >= 1 && recentPayments.length < 5; i--) {
      if (!payData[i][0]) continue;
      const p = {};
      payHeaders.forEach((h, idx) => { p[h] = payData[i][idx]; });
      recentPayments.push(p);
    }
  }

  // Overdue installments
  let overdueInstallments = [];
  if (instSheet && instSheet.getLastRow() > 1) {
    const instData = instSheet.getDataRange().getValues();
    const instHeaders = instData[0];
    for (let i = 1; i < instData.length; i++) {
      if (!instData[i][0]) continue;
      const status = instData[i][9];
      if (status === 'Paid' || status === 'Completed') continue;
      const dueDate = new Date(instData[i][6]);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        const inst = {};
        instHeaders.forEach((h, idx) => { inst[h] = instData[i][idx]; });
        inst.Days_Overdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
        overdueInstallments.push(inst);
      }
    }
  }

  return {
    success: true,
    data: {
      totalStudents, totalFees, totalCollected, totalPending,
      paidCount, partialCount, pendingCount, overdueCount,
      dueTodayCount, upcomingCount,
      recentPayments,
      overdueInstallments: overdueInstallments.slice(0, 5)
    }
  };
}

// ============================================================
// REPORTS
// ============================================================
function getReports(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const paySheet = ss.getSheetByName(SHEET_PAYMENTS);
  const stuSheet = ss.getSheetByName(SHEET_STUDENTS);

  const report = {};

  if (paySheet && paySheet.getLastRow() > 1) {
    const payData = paySheet.getDataRange().getValues();

    // Daily collection (last 7 days)
    const dailyMap = {};
    const monthlyMap = {};
    const courseMap = {};

    for (let i = 1; i < payData.length; i++) {
      if (!payData[i][0]) continue;
      const date = payData[i][4] ? new Date(payData[i][4]) : null;
      const amount = parseFloat(payData[i][5]) || 0;
      const course = payData[i][3] || 'Unknown';

      if (date) {
        const dayKey = date.toISOString().split('T')[0];
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + amount;

        const monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + amount;
      }

      courseMap[course] = (courseMap[course] || 0) + amount;
    }

    report.dailyCollection = Object.entries(dailyMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, amount]) => ({ date, amount }));

    report.monthlyCollection = Object.entries(monthlyMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
      .map(([month, amount]) => ({ month, amount }));

    report.courseCollection = Object.entries(courseMap)
      .sort((a, b) => b[1] - a[1])
      .map(([course, amount]) => ({ course, amount }));
  }

  // Pending fees by student
  if (stuSheet && stuSheet.getLastRow() > 1) {
    const stuData = stuSheet.getDataRange().getValues();
    const pending = [];
    for (let i = 1; i < stuData.length; i++) {
      if (!stuData[i][0]) continue;
      const remaining = parseFloat(stuData[i][10]) || 0;
      if (remaining > 0) {
        pending.push({
          Student_ID: stuData[i][0],
          Student_Name: stuData[i][1],
          Course: stuData[i][4],
          Remaining_Fee: remaining,
          Payment_Status: stuData[i][13]
        });
      }
    }
    report.pendingFees = pending.sort((a, b) => b.Remaining_Fee - a.Remaining_Fee);
  }

  return { success: true, data: report };
}

// ============================================================
// SETTINGS
// ============================================================
function getSettings() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: {} };

  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) settings[data[i][0]] = data[i][1];
  }
  return { success: true, data: settings };
}

function updateSettings(settingsData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return { success: false, message: 'Settings sheet not found' };

  const data = sheet.getDataRange().getValues();
  for (const [key, value] of Object.entries(settingsData)) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, value]);
    }
  }
  return { success: true, message: 'Settings updated successfully' };
}
