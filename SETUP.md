# SKILLEZE TECHNOLOGIES — Fee Payment Management System
## Setup Guide

---

## Prerequisites
- A Google Account
- A modern web browser (Chrome, Firefox, Edge)
- Basic familiarity with Google Sheets and Google Apps Script

---

## Step 1: Create the Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **+ Blank** to create a new spreadsheet
3. Name it: `Skilleze_Fee_Management`
4. Note the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```

---

## Step 2: Create Required Sheets

In the spreadsheet, create **4 sheets** by clicking the **+** button at the bottom:

| Sheet Name    | Purpose                          |
|---------------|----------------------------------|
| `Students`    | Student records and fee info     |
| `Payments`    | Payment transaction records      |
| `Installments`| Installment schedule tracking    |
| `Settings`    | System configuration             |

> **Tip:** You can also use the `initSheets` action from Apps Script to auto-create headers.

---

## Step 3: Open Apps Script Editor

1. In the spreadsheet, click **Extensions** → **Apps Script**
2. This opens the Google Apps Script editor
3. Delete any existing code in `Code.gs`

---

## Step 4: Add the Apps Script Code

1. Copy the entire contents of `google-apps-script/Code.gs`
2. Paste it into the Apps Script editor
3. **Important:** Replace the placeholder with your actual Spreadsheet ID:
   ```javascript
   const SPREADSHEET_ID = 'YOUR_ACTUAL_SPREADSHEET_ID_HERE';
   ```
4. Click **Save** (💾 icon or Ctrl+S)

---

## Step 5: Initialize the Sheets (Optional but Recommended)

1. In the Apps Script editor, select function `initializeSheets` from the dropdown
2. Click **Run** ▶️
3. Grant permissions when prompted
4. This will automatically create all column headers with styling

---

## Step 6: Deploy as Web App

1. Click **Deploy** → **New Deployment**
2. Click the gear icon ⚙️ next to "Type" → Select **Web App**
3. Configure:
   - **Description:** `Skilleze Fee Management API v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` *(or "Anyone with Google account" for more security)*
4. Click **Deploy**
5. **Copy the Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

> ⚠️ **Important:** Keep this URL private! Anyone with this URL can access your data.

---

## Step 7: Configure the Application

1. Open `js/api.js` in a text editor
2. Find this line near the top:
   ```javascript
   const API_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';
   ```
3. Replace with your actual Web App URL:
   ```javascript
   const API_URL = 'https://script.google.com/macros/s/YOUR_ACTUAL_ID/exec';
   ```
4. Save the file

---

## Step 8: Open the Application

### Option A: Open Locally
1. Simply open `index.html` in your browser
2. The app will load with sample data
3. After connecting Google Sheets, it will use live data

### Option B: Host on a Web Server
You can host these static files on:
- **GitHub Pages** — Free, ideal for small teams
- **Netlify** — Free tier available, easy drag & drop deploy
- **Google Drive** — Basic hosting via sharing
- **Any web server** — Apache, Nginx, IIS etc.

---

## Step 9: Test Google Sheets Connection

1. Open the app in your browser
2. Go to **Settings** → Click **Test Connection**
3. A green message confirms: `✅ Connected to Google Sheets successfully!`

If it fails, verify:
- The Web App URL is correct in `api.js`
- The deployment has "Anyone" access
- Your SPREADSHEET_ID is correct in `Code.gs`

---

## Step 10: Production Ready & Data Management

The application is configured in **clean production mode** with zero sample data. All institutional credentials (address, phone numbers, email, website, and branding) are pre-filled.

- When running locally, records are persisted in the browser's local store.
- When Google Sheets is connected via Apps Script, real data from your Google Sheet is seamlessly synchronized.
- You can clear data or reset settings at any time from the **Settings** page.

---

## Column Structure Reference

### Students Sheet
```
Student_ID | Student_Name | Mobile | Email | Course | Enrollment_Date |
Total_Fee | Installment_Plan | Num_Installments | Total_Paid | Remaining_Fee |
Next_Installment_Amount | Next_Due_Date | Payment_Status | College_Org |
Address | Notes | Created_At | Updated_At
```

### Payments Sheet
```
Payment_ID | Student_ID | Student_Name | Course | Payment_Date |
Amount_Paid | Payment_Mode | Transaction_ID | Installment_Number |
Remaining_After_Payment | Remarks | Created_At
```

### Installments Sheet
```
Installment_ID | Student_ID | Student_Name | Course | Installment_Number |
Installment_Amount | Due_Date | Paid_Amount | Remaining_Amount | Status | Paid_Date
```

### Settings Sheet
```
Setting | Value
```

---

## Troubleshooting

### "Google Sheets connection failed"
- Verify the API_URL in `js/api.js`
- Check Apps Script deployment settings (set to "Anyone")
- Re-deploy the Apps Script and use the new URL

### "CORS Error" in browser console
- This is normal for local file:// URLs with Google Apps Script
- Host the app on a web server, or use the local data mode

### Data not saving
- Verify SPREADSHEET_ID in Code.gs is correct
- Check that the Apps Script has edit permissions to the spreadsheet

### Receipt not printing correctly
- Use Chrome or Edge browser for best print results
- Check Print Settings: set margins to "None" or "Minimum"
- Enable "Background graphics" in print settings

---

## Architecture Overview

```
Browser (HTML + CSS + Vanilla JS)
           │
           │  fetch() requests
           ▼
Google Apps Script Web App (Code.gs)
           │
           │  SpreadsheetApp API
           ▼
Google Sheets (Skilleze_Fee_Management)
  ├── Students
  ├── Payments  
  ├── Installments
  └── Settings
```

---

## Security Notes

1. **Do not share your Apps Script URL publicly** — treat it like a password
2. For production, consider setting access to "Anyone with Google account"
3. Regularly review the Google Sheets for unauthorized changes
4. Consider adding authentication via Google OAuth for enterprise use

---

## Support

For technical support or customization:
- Email: info@skilleze.com
- Website: skilleze.com

---

*Skilleze Technologies Fee Management System v1.0.0 — Built with HTML5, CSS3, Vanilla JavaScript, Google Apps Script & Google Sheets*
