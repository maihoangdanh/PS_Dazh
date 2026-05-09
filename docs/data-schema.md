# Data Schema

## Google Sheets

### Orders (~9590 rows, 45 cols)

Mỗi `line_item` = 1 hàng. Các trường order-level lặp lại theo số lượng items.

| Column | Key | Type |
|--------|-----|------|
| Order ID (id) | `id` | STRING |
| Trạng thái đơn (status) | `status` | STRING (mapped VN) |
| Lý do hủy (cancel_reason) | `cancel_reason` | STRING |
| Ngày tạo (create_time) | `create_time` | DATETIME |
| Ngày cập nhật (update_time) | `update_time` | DATETIME |
| Loại đơn (order_type) | `order_type` | STRING |
| Fulfillment type | `fulfillment_type` | STRING |
| PTTT (payment_method_name) | `payment_method_name` | STRING |
| Nhà vận chuyển (shipping_provider) | `shipping_provider` | STRING |
| Mã vận đơn đơn (tracking_number) | `tracking_number_order` | STRING |
| Tên người nhận | `recipient_name` | STRING |
| SĐT người nhận | `recipient_phone` | STRING |
| Địa chỉ đầy đủ | `recipient_full_address` | STRING |
| Giá gốc SP đơn | `original_total_product_price` | NUMBER |
| CK Platform đơn | `platform_discount` | NUMBER |
| CK Seller đơn | `seller_discount` | NUMBER |
| Tạm tính (sub_total) | `sub_total` | NUMBER |
| Phí ship gốc | `original_shipping_fee` | NUMBER |
| Phí ship thực (shipping_fee) | `shipping_fee` | NUMBER |
| Tổng thanh toán (total_amount) | `total_amount` | NUMBER |
| Line Item ID | `line_item_id` | STRING |
| Product ID | `product_id` | STRING |
| Tên sản phẩm (product_name) | `product_name` | STRING |
| SKU ID | `sku_id` | STRING |
| Tên SKU (sku_name) | `sku_name` | STRING |
| Seller SKU (seller_sku) | `seller_sku` | STRING |
| Là quà tặng (is_gift) | `is_gift` | STRING (Có/Không) |
| Giá gốc item (original_price) | `original_price` | NUMBER |
| Giá bán item (sale_price) | `sale_price` | NUMBER |
| Trạng thái item | `item_display_status` | STRING |
| Mã vận đơn item | `item_tracking_number` | STRING |
| Nhà VC item | `shipping_provider_name` | STRING |

**Status mapping:**

| API value | Hiển thị |
|-----------|---------|
| UNPAID | Chưa TT |
| AWAITING_SHIPMENT | Chờ giao |
| IN_TRANSIT | Đang vận chuyển |
| DELIVERED | Đã giao |
| COMPLETED | Hoàn thành |
| CANCELLED | Đã hủy |
| RETURNED | Hoàn hàng |

---

### GMV Ads (~2989 rows, 23 cols)

| Column | Key | Type |
|--------|-----|------|
| campaign_id | `campaign_id` | STRING |
| stat_time_day | `stat_time_day` | DATE |
| campaign_name | `campaign_name` | STRING |
| cost | `cost` | NUMBER |
| orders | `orders` | INTEGER |
| roi | `roi` | NUMBER |
| gross_revenue | `gross_revenue` | NUMBER |
| cost_per_order | `cost_per_order` | NUMBER |
| net_cost | `net_cost` | NUMBER |
| roas_bid | `roas_bid` | NUMBER |
| operation_status | `operation_status` | STRING |
| schedule_type | `schedule_type` | STRING |

---

### Booking_Video (~27 rows, 12 cols)

| Column | Key |
|--------|-----|
| Creator | `Creator` |
| Type | `Type` |
| Campain | `Campain` |
| Product | `Product` |
| Booking_Fee | `Booking_Fee` |
| Air Time | `Air Time` |
| ID Video | `ID Video` |
| Link Air | `Link Air` |
| Code Ads | `Code Ads` |

---

## BigQuery — `orders_raw`

| Field | Type | Ghi chú |
|-------|------|---------|
| order_id | STRING | |
| status | STRING | Giá trị API gốc (COMPLETED, CANCELLED, ...) |
| cancel_reason | STRING | |
| create_time | TIMESTAMP | |
| update_time | TIMESTAMP | |
| order_type | STRING | |
| fulfillment_type | STRING | |
| shipping_provider | STRING | |
| tracking_number | STRING | |
| payment_method | STRING | |
| user_id | STRING | |
| recipient_name | STRING | |
| recipient_city | STRING | Parse từ full_address |
| recipient_address | STRING | |
| total_amount | FLOAT | |
| sub_total | FLOAT | |
| shipping_fee | FLOAT | |
| platform_discount | FLOAT | |
| seller_discount | FLOAT | |
| sku_id | STRING | |
| sku_name | STRING | |
| product_name | STRING | |
| quantity | INTEGER | |
| sale_price | FLOAT | |
| item_discount | FLOAT | |
| sync_time | TIMESTAMP | Thời điểm streaming vào BQ |

**Dedup query:**
```sql
SELECT * EXCEPT(row_num)
FROM (
  SELECT *,
    ROW_NUMBER() OVER(
      PARTITION BY order_id, sku_id
      ORDER BY update_time DESC, sync_time DESC
    ) as row_num
  FROM `trioderma-analytics.tiktok_shop_data.orders_raw`
)
WHERE row_num = 1
```
