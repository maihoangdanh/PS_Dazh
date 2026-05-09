# PS_Dazh — Project Wiki

**Brand:** Trioderma | **Owner:** maihoangdanh | **Stack:** Google Apps Script + BigQuery

---

## Mục lục

| File | Nội dung |
|------|----------|
| [architecture.md](architecture.md) | Kiến trúc hệ thống, luồng dữ liệu, tài khoản |
| [data-schema.md](data-schema.md) | Schema chi tiết từng Sheet và BigQuery table |
| [roadmap.md](roadmap.md) | Đã làm, đang làm, kế hoạch tiếp theo |
| [decisions.md](decisions.md) | Lý do chọn tool/approach |

---

## Trạng thái hiện tại

| Module | Trạng thái |
|--------|------------|
| TikTok Shop connector | ✅ Done |
| BigQuery streaming | ✅ Done |
| Dashboard web app | ✅ Done |
| Auto-sync daily | ✅ Done |
| Report builder | ⚠️ TODO |
| Facebook Ads | ⬜ Chưa bắt đầu |
| Google Ads | ⬜ Chưa bắt đầu |
| TikTok Ads | ⬜ Chưa bắt đầu |

---

## Quick start (máy mới)

```bash
# 1. Clone repo
git clone <repo-url>
cd PS_Dazh

# 2. Cài clasp để deploy GAS
npm install -g @google/clasp
clasp login

# 3. Test kết nối (cần service-account.json)
# Xem hướng dẫn: reports/tiktok-shop/credentials/README.md
python reports/tiktok-shop/scripts/test_connection.py

# 4. Deploy lên Apps Script
cd reports/tiktok-shop
clasp push
```

**Sau khi deploy**, vào Google Sheets → menu **Trioderma Manager** → Nhập Token & Config.
