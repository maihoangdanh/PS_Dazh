// ============================================================
// MAIN — Entry point chính của Apps Script
// ============================================================

function main() {
  const sheetData = getSheetData();
  const bqData = getBigQueryData();
  buildReport(sheetData, bqData);
}
