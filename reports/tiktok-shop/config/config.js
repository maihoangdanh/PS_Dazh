// ============================================================
// CONFIG — Trioderma TikTok Shop Report
// Tài khoản Google Sheet : danhmai.maihangroup@gmail.com
// Tài khoản BigQuery     : maihoangdanh92@gmail.com
// ============================================================

const CONFIG = {

  // ── Google Sheet ──────────────────────────────────────────
  SPREADSHEET_ID: '1F7Fn6EC2yimTKV_aWAzzJZmF7Kfv9sfSca7hgCKZuEk',

  SHEETS: {
    ORDERS:          'Orders',
    GMV_ADS:         'GMV Ads',
    BOOKING_VIDEO:   'Booking_Video',
    BOOKING_CREATOR: 'Booking_Creator',
    CAMPAIGN:        'Campain',
    SETTING:         'Setting',
  },

  // ── BigQuery ──────────────────────────────────────────────
  BQ_PROJECT_ID: 'trioderma-analytics',
  BQ_DATASET:    'tiktok_shop_data',
  BQ_TABLE:      'orders_raw',

  // ── Schema: Orders (45 cols, ~9590 rows) ─────────────────
  ORDERS_COLS: {
    ORDER_ID:       'Order ID (id)',
    STATUS:         'Trạng thái đơn (status)',
    CANCEL_REASON:  'Lý do hủy (cancel_reason)',
    CREATE_TIME:    'Ngày tạo (create_time)',
    UPDATE_TIME:    'Ngày cập nhật (update_time)',
    TOTAL_AMOUNT:   'Tổng thanh toán (total_amount)',
    SUB_TOTAL:      'Tạm tính (sub_total)',
    PLATFORM_DISC:  'CK Platform đơn (platform_discount)',
    SELLER_DISC:    'CK Seller đơn (seller_discount)',
    SHIPPING_FEE:   'Phí ship thực (shipping_fee)',
    PAYMENT_METHOD: 'PTTT (payment_method_name)',
    PRODUCT_NAME:   'Tên sản phẩm (product_name)',
    SKU_NAME:       'Tên SKU (sku_name)',
    SELLER_SKU:     'Seller SKU (seller_sku)',
    SALE_PRICE:     'Giá bán item (sale_price)',
    ORIGINAL_PRICE: 'Giá gốc item (original_price)',
    IS_GIFT:        'Là quà tặng (is_gift)',
    PROVINCE:       'Địa chỉ đầy đủ (recipient_full_address)',
    SHIP_PROVIDER:  'Nhà vận chuyển (shipping_provider)',
  },

  // ── Schema: GMV Ads (23 cols, ~2989 rows) ─────────────────
  GMV_ADS_COLS: {
    CAMPAIGN_ID:    'campaign_id',
    DATE:           'stat_time_day',
    CAMPAIGN_NAME:  'campaign_name',
    COST:           'cost',
    ORDERS:         'orders',
    ROI:            'roi',
    GROSS_REVENUE:  'gross_revenue',
    COST_PER_ORDER: 'cost_per_order',
    NET_COST:       'net_cost',
    ROAS_BID:       'roas_bid',
    STATUS:         'operation_status',
    SCHEDULE_TYPE:  'schedule_type',
  },

  // ── Schema: Booking_Video (12 cols, ~27 rows) ─────────────
  BOOKING_VIDEO_COLS: {
    CREATOR:     'Creator',
    TYPE:        'Type',
    CAMPAIGN:    'Campain',
    PRODUCT:     'Product',
    BOOKING_FEE: ' Booking_Fee',
    AIR_TIME:    'Air Time',
    VIDEO_ID:    'ID Video',
    LINK_AIR:    'Link Air',
    CODE_ADS:    'Code Ads',
  },

  // ── Report settings ───────────────────────────────────────
  TIMEZONE:     'Asia/Ho_Chi_Minh',
  REPORT_EMAIL: 'danhmai.maihangroup@gmail.com',
};
