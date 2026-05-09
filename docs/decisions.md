# Architecture Decision Records (ADR)

Ghi lại lý do chọn tool/approach để sau không phải hỏi lại.

---

## ADR-001 — Google Apps Script làm runtime chính

**Quyết định:** Dùng GAS thay vì Python backend hay Node.js server.

**Lý do:**
- Free, không cần deploy server
- Tích hợp native với Google Sheets và BigQuery (không cần auth phức tạp)
- Chạy được trigger định kỳ (cron) và web app mà không cần infra
- Team không cần setup môi trường — chỉ cần mở Google Sheets

**Đánh đổi:** Giới hạn runtime 6 phút/execution, không dùng được npm packages.

---

## ADR-002 — BigQuery streaming insert thay vì batch load

**Quyết định:** Dùng `BigQuery.Tabledata.insertAll()` (streaming) thay vì load file CSV.

**Lý do:**
- Data vào BQ ngay lập tức sau khi pull từ TikTok
- Không cần GCS bucket làm trung gian
- Chunk 500 rows để tránh giới hạn payload

**Đánh đổi:** Streaming insert có cost (~$0.01/200MB), không free như batch load. Chấp nhận được ở scale hiện tại.

---

## ADR-003 — 1 line_item = 1 hàng trong Sheets

**Quyết định:** Mỗi đơn hàng expand thành N hàng tương ứng N line items, các trường order-level lặp lại.

**Lý do:**
- Dễ filter, pivot, COUNTIF trong Sheets hơn JSON nested
- Khớp với cấu trúc BigQuery (relational, không phải nested)
- Team non-technical dễ đọc hơn

**Đánh đổi:** File Sheets nặng hơn (~9590 rows thay vì ~5000 orders).

---

## ADR-004 — BQ dedup bằng ROW_NUMBER()

**Quyết định:** Không xóa duplicate khi insert, dedup khi query bằng `ROW_NUMBER() OVER(PARTITION BY order_id, sku_id ORDER BY update_time DESC)`.

**Lý do:**
- Streaming insert không hỗ trợ UPSERT
- Giữ lại lịch sử thay đổi status đơn hàng
- Query dedup chạy nhanh với partition đúng

---

## ADR-005 — Lazy init cho BQ_CONFIG

**Quyết định:** Đọc BQ config từ `ScriptProperties` mỗi lần gọi (`getBQConfig()`), không khai báo global const.

**Lý do:** GAS chạy global scope khi script load — nếu `ScriptProperties` chưa có giá trị (máy mới, chưa setup), global const sẽ lỗi ngay cả khi không gọi hàm đó. Lazy init tránh được lỗi này.

**Fix commit:** `0b3c568`
