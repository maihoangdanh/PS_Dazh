// ============================================================
// SHEET SERVICE — Đọc & ghi dữ liệu Google Sheet
// ============================================================

function getSheetData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  return data;
}
