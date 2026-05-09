Deploy một Google Apps Script project: push code local → tạo version mới → update deployment cũ (giữ nguyên ID & URL).

Cú pháp: `/deploy-gas [tên-project]`

Ví dụ:
- `/deploy-gas tiktok-shop`
- `/deploy-gas facebook-ads`
- `/deploy-gas` ← nếu không có argument, hỏi user chọn project

## Bước 0 — Xác định project

Nếu user truyền argument → dùng luôn.

Nếu không có argument → liệt kê tất cả thư mục trong `reports/` có chứa `.clasp.json`, hỏi user chọn cái nào.

Lấy `rootDir` từ `.clasp.json` của project đó (thường là `./src`).

## Bước 1 — Đọc thông tin hiện tại

Chạy trong thư mục project (`reports/<tên-project>`):
```
clasp deployments
clasp versions
```

Từ output:
- Lấy **deployment ID** của deployment đang active (không phải @HEAD)
- Lấy **version number mới nhất**
- Lấy **description hiện tại** để parse tên + số version

## Bước 2 — Tính tên version mới

Parse description hiện tại, tìm số cuối:
- Dạng `vX.Y` → tăng Y lên 1 (v2.4 → v2.5)
- Dạng `vX` → tăng X lên 1 (v5 → v6)
- Không có số → append ` v1`

Tên mới = base name + version mới.

## Bước 3 — Push code

```bash
cd reports/<tên-project> && clasp push --force
```

Nếu có lỗi → dừng ngay, báo lỗi cho user, không deploy.

## Bước 4 — Tạo version mới

```bash
clasp version "<tên mới>"
```

Ghi lại version number từ output.

## Bước 5 — Update deployment (giữ nguyên ID)

```bash
clasp deploy --deploymentId <ID> --versionNumber <ver> --description "<tên mới>"
```

## Bước 6 — Xác nhận

Chạy `clasp deployments` lần nữa, verify:
- Deployment ID không đổi ✓
- Description đã cập nhật ✓

Báo kết quả: tên version mới, deployment ID, URL web app.

## Danh sách GAS projects

Cập nhật khi thêm project mới:

| Project | Thư mục | Ghi chú |
|---------|---------|---------|
| tiktok-shop | `reports/tiktok-shop` | Trioderma TikTok Shop Dashboard |
| facebook-ads | `reports/facebook-ads` | Chưa build |
| google-ads | `reports/google-ads` | Chưa build |
| tiktok-ads | `reports/tiktok-ads` | Chưa build |
