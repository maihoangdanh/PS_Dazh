# BRAIN.md — Bộ não project PS_Dazh / Trioderma

> File này track toàn bộ context, trạng thái và quyết định kỹ thuật của project.
> Cập nhật mỗi khi hoàn thành hoặc thay đổi một phần quan trọng.

---

## 🏢 Project là gì?

Hệ thống báo cáo & analytics tự động cho **Trioderma** (brand skincare/beauty).

**Luồng dữ liệu:**
```
TikTok Shop API → Google Apps Script → Google Sheets → BigQuery → Dashboard
```

---

## 🔑 Tài khoản & ID quan trọng

| Thứ | Giá trị |
|-----|---------|
| Google Sheets account | danhmai.maihangroup@gmail.com |
| BigQuery account | maihoangdanh92@gmail.com |
| Spreadsheet ID | `1F7Fn6EC2yimTKV_aWAzzJZmF7Kfv9sfSca7hgCKZuEk` |
| BQ Project | `trioderma-analytics` |
| BQ Dataset | `tiktok_shop_data` |
| BQ Table | `orders_raw` |
| TikTok API base | `https://open-api.tiktokglobalshop.com` |
| TikTok API version | `202309` |

**GAS Script Properties** (lưu trong Apps Script Editor, không commit):
- `APP_KEY`, `APP_SECRET`, `SHOP_CIPHER`, `ACCESS_TOKEN`, `REFRESH_TOKEN`
- `BQ_PROJECT_ID`, `BQ_DATASET_ID`, `BQ_TABLE_ID`
- `SYNC_DAYS`, `SYNC_HOUR`

---

## 📁 File structure

```
PS_Dazh/
├── BRAIN.md                          ← file này
├── CLAUDE.md                         ← hướng dẫn vai trò cho AI
├── reports/
│   ├── tiktok-shop/
│   │   ├── src/
│   │   │   ├── TikTokShop.js         ← MAIN (~800 lines): API, BQ, Dashboard
│   │   │   ├── main.gs               ← Entry point
│   │   │   ├── config.js             ← Schema + CONFIG object
│   │   │   ├── bigqueryService.gs    ← BQ query wrapper
│   │   │   ├── sheetService.gs       ← Sheet reader (có bug, xem bên dưới)
│   │   │   ├── reportBuilder.gs      ← TODO: chưa có logic
│   │   │   ├── Dashboard.html        ← Web app UI
│   │   │   ├── Sidebar.html          ← Sidebar UI
│   │   │   └── appsscript.json       ← GAS manifest
│   │   ├── config/config.js          ← Copy schema
│   │   ├── credentials/
│   │   │   ├── README.md
│   │   │   └── service-account.json  ← GITIGNORED, tạo thủ công
│   │   └── scripts/test_connection.py
│   ├── facebook-ads/                 ← placeholder, chưa làm
│   ├── google-ads/                   ← placeholder, chưa làm
│   └── tiktok-ads/                   ← placeholder, chưa làm
```

---

## ✅ Đã hoàn thành

### TikTokShop.js
- [x] Auth: nhập token qua UI menu (APP_KEY, APP_SECRET, SHOP_CIPHER, ACCESS_TOKEN, REFRESH_TOKEN)
- [x] Auto refresh token khi hết hạn (code 36004000)
- [x] HMAC-SHA256 signature cho TikTok API v2
- [x] Pull Orders — pagination 50/page, tối đa 5000 đơn, filter by date range
- [x] Pull Products — pagination 50/page
- [x] Write to Sheets — 45 cols, line-item expanded (1 line_item = 1 hàng)
- [x] BigQuery streaming — insertAll, chunk 500 rows
- [x] BigQuery init table + auto-create dataset nếu chưa có
- [x] BigQuery query cho dashboard — dedup bằng ROW_NUMBER()
- [x] Auto-sync daily trigger (bật/tắt qua menu)
- [x] Dashboard web app (doGet)
- [x] Sidebar UI
- [x] Load GMV Ads data từ sheet
- [x] Load Video performance từ TikTok API
- [x] Load Live performance từ TikTok API

### Infrastructure
- [x] Project structure
- [x] CLAUDE.md
- [x] appsscript.json (BigQuery advanced service, webapp mode)
- [x] .clasp.json (deploy qua clasp)
- [x] test_connection.py (test Sheets API + BQ)
- [x] config.js — schema đầy đủ cho Orders, GMV Ads, Booking_Video

---

## ❌ Chưa làm / TODO

- [ ] `reportBuilder.gs` — chỉ có TODO comment, chưa có logic thực
- [ ] `bigqueryService.gs` — chưa kết nối với main report flow
- [ ] Facebook Ads report
- [ ] Google Ads report
- [ ] TikTok Ads report

---

## 🐛 Bug đã biết

| File | Vấn đề | Fix |
|------|---------|-----|
| `sheetService.gs:8` | Dùng `CONFIG.SHEET_NAME` không tồn tại | Đổi thành `CONFIG.SHEETS.ORDERS` |

---

## 🏗️ Kiến trúc kỹ thuật

**Sheets trong Spreadsheet:**
| Sheet | Mô tả | Rows |
|-------|-------|------|
| Orders | Đơn hàng raw, 45 cols, line-item expanded | ~9590 |
| GMV Ads | TikTok Ads GMV Max, 23 cols | ~2989 |
| Booking_Video | Booking creator video, 12 cols | ~27 |
| Booking_Creator | Booking KOC/KOL | — |
| Campaign (Campain) | Campaign tracking | — |
| Setting | Cấu hình | — |

**BigQuery dedup query:**
```sql
SELECT *, ROW_NUMBER() OVER(
  PARTITION BY order_id, sku_id
  ORDER BY update_time DESC, sync_time DESC
) as row_num
FROM `trioderma-analytics.tiktok_shop_data.orders_raw`
WHERE row_num = 1
```

---

## 📅 Lịch sử thay đổi

| Commit | Nội dung |
|--------|----------|
| `79de28e` | Setup Google Sheets API + BigQuery credentials, config schema, test script |
| `b27f8f5` | Chuyển report-app vào reports/tiktok-shop, thêm placeholder |
| `0b3c568` | Fix BQ_CONFIG lazy init — tránh lỗi global scope |
| `d0259d6` | Cập nhật mô tả vai trò trong CLAUDE.md |
| `f55b28d` | Initial commit |
