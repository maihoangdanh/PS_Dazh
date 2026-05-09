# Architecture

## Tài khoản & ID

| | |
|-|-|
| Google Sheets | danhmai.maihangroup@gmail.com |
| BigQuery | maihoangdanh92@gmail.com |
| Spreadsheet ID | `1F7Fn6EC2yimTKV_aWAzzJZmF7Kfv9sfSca7hgCKZuEk` |
| BQ Project | `trioderma-analytics` |
| BQ Dataset | `tiktok_shop_data` |
| BQ Table | `orders_raw` |
| TikTok API | `https://open-api.tiktokglobalshop.com` · version `202309` |

---

## Luồng dữ liệu

```
TikTok Shop API
      │
      │  HMAC-SHA256 signed requests
      │  Auto token refresh khi hết hạn
      ▼
Google Apps Script (TikTokShop.js)
      │
      ├──► Google Sheets ──────────────────────────────────────►  Dashboard.html
      │    └─ Orders sheet                                          (đọc từ Sheets)
      │       45 cols, 1 line_item = 1 hàng
      │
      └──► BigQuery (streaming insert) ──────────────────────────► Dashboard.html
           └─ orders_raw table                                      (đọc từ BQ)
              dedup bằng ROW_NUMBER()
```

---

## Stack

| Layer | Tool | Lý do |
|-------|------|-------|
| Runtime | Google Apps Script (V8) | Tích hợp native với Sheets + BQ, free |
| Primary storage | Google Sheets | PM & team xem trực tiếp được |
| Analytics | BigQuery | Query lớn, historical data |
| Source | TikTok Shop Open API | Dữ liệu đơn hàng gốc |
| Deploy | clasp | Sync code local ↔ GAS |
| Test | Python (google-auth) | Test credentials độc lập với GAS |

---

## File structure

```
PS_Dazh/
├── BRAIN.md                              ← tóm tắt nhanh
├── docs/                                 ← wiki này
├── reports/
│   ├── tiktok-shop/
│   │   ├── src/
│   │   │   ├── TikTokShop.js            ← CORE: API + BQ + Dashboard (~800 lines)
│   │   │   ├── main.gs                  ← entry point
│   │   │   ├── config.js                ← CONFIG object + schema mapping
│   │   │   ├── bigqueryService.gs       ← BQ query wrapper
│   │   │   ├── sheetService.gs          ← sheet reader
│   │   │   ├── reportBuilder.gs         ← TODO
│   │   │   ├── Dashboard.html           ← web app UI
│   │   │   ├── Sidebar.html             ← sidebar UI
│   │   │   └── appsscript.json          ← GAS manifest
│   │   ├── config/config.js
│   │   ├── credentials/
│   │   │   ├── README.md
│   │   │   └── service-account.json     ← GITIGNORED
│   │   └── scripts/test_connection.py
│   ├── facebook-ads/
│   ├── google-ads/
│   └── tiktok-ads/
```

---

## GAS Script Properties

Lưu trong Apps Script Editor (không commit vào code):

| Key | Mô tả |
|-----|-------|
| `APP_KEY` | TikTok App Key |
| `APP_SECRET` | TikTok App Secret |
| `SHOP_CIPHER` | Shop Cipher |
| `ACCESS_TOKEN` | Access Token (tự refresh) |
| `REFRESH_TOKEN` | Refresh Token |
| `BQ_PROJECT_ID` | `trioderma-analytics` |
| `BQ_DATASET_ID` | `tiktok_shop_data` |
| `BQ_TABLE_ID` | `orders_raw` |
| `SYNC_DAYS` | Số ngày kéo mỗi lần auto-sync |
| `SYNC_HOUR` | Giờ chạy auto-sync (0–23) |

Setup nhanh: chạy `setup_BQ_Config()` trong GAS Editor để điền BQ props tự động.
