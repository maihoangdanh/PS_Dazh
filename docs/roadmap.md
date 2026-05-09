# Roadmap

## ✅ Phase 1 — TikTok Shop Core (DONE)

- [x] Project structure + git init
- [x] CLAUDE.md — vai trò AI assistant
- [x] TikTok Shop API connector (HMAC-SHA256, auto token refresh)
- [x] Pull Orders (pagination, filter by date)
- [x] Pull Products (pagination)
- [x] Write to Google Sheets (45 cols, line-item expanded)
- [x] BigQuery streaming insert (chunk 500 rows)
- [x] BigQuery init table + auto-create dataset
- [x] Auto-sync daily trigger (bật/tắt qua menu)
- [x] Dashboard web app (doGet → Dashboard.html)
- [x] Sidebar UI
- [x] Load GMV Ads data từ Sheets
- [x] Load Video performance từ TikTok API
- [x] Load Live performance từ TikTok API
- [x] Config schema đầy đủ (Orders, GMV Ads, Booking_Video)
- [x] test_connection.py — test Sheets API + BQ

---

## ⚠️ Phase 1.5 — Bug fixes & Cleanup (TODO)

- [ ] Fix `sheetService.gs:8` — đổi `CONFIG.SHEET_NAME` → `CONFIG.SHEETS.ORDERS`
- [ ] Kết nối `bigqueryService.gs` vào main report flow
- [ ] Build logic thực cho `reportBuilder.gs`

---

## ⬜ Phase 2 — Multi-channel Reports

- [ ] Facebook Ads report (`reports/facebook-ads/`)
- [ ] Google Ads report (`reports/google-ads/`)
- [ ] TikTok Ads report (`reports/tiktok-ads/`)

---

## ⬜ Phase 3 — Analytics nâng cao

- [ ] Dashboard tổng hợp cross-channel (TikTok Shop + Ads + Booking)
- [ ] Alert tự động khi ROAS xuống dưới ngưỡng
- [ ] Weekly report email tự động

---

## Bug tracker

| # | File | Vấn đề | Severity | Status |
|---|------|---------|----------|--------|
| 1 | `sheetService.gs:8` | `CONFIG.SHEET_NAME` không tồn tại, phải là `CONFIG.SHEETS.ORDERS` | Medium | Open |
