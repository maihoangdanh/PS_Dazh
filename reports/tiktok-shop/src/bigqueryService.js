// ============================================================
// BIGQUERY SERVICE — Query dữ liệu từ BigQuery
// ============================================================

function getBigQueryData() {
  const query = `
    SELECT *
    FROM \`${CONFIG.BQ_PROJECT_ID}.${CONFIG.BQ_DATASET}.${CONFIG.BQ_TABLE}\`
    LIMIT 1000
  `;

  const request = {
    query: query,
    useLegacySql: false,
  };

  const queryResults = BigQuery.Jobs.query(CONFIG.BQ_PROJECT_ID, request);
  return queryResults.rows || [];
}
