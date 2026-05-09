// ============================================================
// TRIODERMA BOOKING MANAGER - TikTok Shop Connector
// ============================================================

const TS_CONFIG = {
  API_BASE: 'https://open-api.tiktokglobalshop.com',
  VERSION: '202309'
};

// ============================================================
// MENU + OPEN SIDEBAR
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Trioderma Manager')
    .addItem('📊 Mở bảng điều khiển', 'openSidebar')
    .addSeparator()
    .addItem('🔑 Nhập Token & Config', 'ui_nhapToken')
    .addItem('🧪 Test kết nối', 'ui_test')
    .addItem('📋 Xem cấu hình', 'ui_viewConfig')
    .addItem('📦 Kéo sản phẩm', 'ui_pullProducts')
    .addItem('⏰ Bật auto-sync hàng ngày', 'enableDailySync')
    .addItem('⏰ Tắt auto-sync', 'disableDailySync')
    .addToUi();
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Trioderma Manager')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

// ============================================================
// NHẬP TOKEN
// ============================================================
function ui_nhapToken() {
  const ui = SpreadsheetApp.getUi();
  const p = PropertiesService.getScriptProperties();

  const fields = [
    ['APP_KEY', 'App Key'],
    ['APP_SECRET', 'App Secret'],
    ['SHOP_CIPHER', 'Shop Cipher'],
    ['ACCESS_TOKEN', 'Access Token'],
    ['REFRESH_TOKEN', 'Refresh Token']
  ];

  for (const [key, label] of fields) {
    const cur = p.getProperty(key) || '';
    const hint = cur ? ' (hiện: ' + cur.substring(0, 15) + '...)' : '';
    const result = ui.prompt('Nhập ' + label + hint, ui.ButtonSet.OK_CANCEL);
    if (result.getSelectedButton() !== ui.Button.OK) return;
    const val = result.getResponseText().trim();
    if (val) p.setProperty(key, val);
  }
  ui.alert('✅ Đã lưu!');
}

function ui_viewConfig() {
  const p = PropertiesService.getScriptProperties();
  const keys = ['APP_KEY', 'APP_SECRET', 'SHOP_CIPHER', 'ACCESS_TOKEN', 'REFRESH_TOKEN'];
  let msg = '';
  keys.forEach(k => {
    const v = p.getProperty(k) || '(chưa có)';
    msg += k + ': ' + (v.length > 20 ? v.substring(0, 20) + '...' : v) + '\n';
  });
  SpreadsheetApp.getUi().alert('📋 Cấu hình', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================
// TEST KẾT NỐI — gọi từ sidebar
// ============================================================
function ui_test() {
  return testKetNoi();
}

function testKetNoi() {
  let report = '';
  try {
    const data = tsRequest('/authorization/' + TS_CONFIG.VERSION + '/shops', 'GET', {}, null);
    const shops = (data.data && data.data.shops) ? data.data.shops : [];
    report += '✅ Kết nối OK! Tìm thấy ' + shops.length + ' shop\n';
    shops.forEach(s => {
      report += '🏪 ' + (s.shop_name || 'N/A')
        + '\n   Cipher: ' + (s.cipher || 'N/A')
        + '\n   Region: ' + (s.region || 'N/A') + '\n';
    });
  } catch (e) { report += '❌ Get Shops: ' + e.message + '\n'; }

  report += '\n---\n';
  try {
    const cipher = getProp('SHOP_CIPHER');
    const data = tsRequest(
      '/order/' + TS_CONFIG.VERSION + '/orders/search', 'POST',
      { shop_cipher: cipher, page_size: '1' }, {}
    );
    const orders = (data.data && data.data.orders) ? data.data.orders : [];
    report += '✅ Search Orders OK!\n';
    report += 'Tổng đơn tìm thấy: ' + (data.data.total_count || orders.length) + '\n';
  } catch (e) { report += '❌ Search Orders: ' + e.message + '\n'; }

  return report;
}

// ============================================================
// LẤY DANH SÁCH SHEETS — gọi từ sidebar
// ============================================================
function getSheetNames() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName());
}

// ============================================================
// KÉO ĐƠN HÀNG — gọi từ sidebar
// ============================================================
function runPullOrders(options) {
  try {
    const cipher = getProp('SHOP_CIPHER');
    if (!cipher) throw new Error('Chưa có Shop Cipher. Vào menu → Nhập Token & Config.');

    const fromTs = Math.floor(new Date(options.dateFrom + 'T00:00:00').getTime() / 1000);
    const toTs = Math.floor(new Date(options.dateTo + 'T23:59:59').getTime() / 1000);

    const allOrders = [];
    let cursor = '';
    let page = 0;

    do {
      Utilities.sleep(600);
      const qp = { shop_cipher: cipher, page_size: '50', sort_order: 'DESC', sort_field: 'create_time' };
      if (cursor) qp.page_token = cursor;

      const res = tsRequest(
        '/order/' + TS_CONFIG.VERSION + '/orders/search', 'POST',
        qp, { create_time_ge: fromTs, create_time_lt: toTs }
      );

      const list = (res.data && res.data.orders) ? res.data.orders : [];
      list.forEach(o => allOrders.push(o));
      cursor = (res.data && res.data.next_page_token) || '';
      page++;
      Logger.log('Page ' + page + ': ' + list.length + ' đơn (tổng: ' + allOrders.length + ')');

    } while (cursor && page < 100);

    if (allOrders.length === 0) {
      return { success: false, message: 'Không tìm thấy đơn hàng nào trong khoảng thời gian này.' };
    }

    const rowsWritten = writeOrdersToSheet(allOrders, options);

    // Tự động đẩy lên BigQuery (Hệ thống mới)
    try {
      streamToBigQuery(allOrders);
    } catch (bqErr) {
      Logger.log('Lỗi Auto-Sync BigQuery: ' + bqErr.message);
    }

    return { success: true, message: '✅ Đã ghi ' + rowsWritten + ' dòng (line items) từ ' + allOrders.length + ' đơn hàng.' };

  } catch (e) {
    Logger.log('runPullOrders error: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ============================================================
// GHI VÀO SHEET — 1 line_item = 1 hàng
// Mỗi đơn có N line_items → N hàng, các trường order-level lặp lại
// ============================================================
function writeOrdersToSheet(orders, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = options.sheetName || 'Orders';
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else if (options.overwrite) {
    sheet.clear();
  }

  // ── Định nghĩa toàn bộ cột, src: 'order' | 'item' ──────────
  const ALL_FIELDS = [
    { key: 'id', label: 'Order ID (id)', get: (o, i) => o.id || '' },
    { key: 'status', label: 'Trạng thái đơn (status)', get: (o, i) => mapStatus(o.status) },
    { key: 'cancel_reason', label: 'Lý do hủy (cancel_reason)', get: (o, i) => mapStatus(o.cancel_reason) },
    { key: 'create_time', label: 'Ngày tạo (create_time)', get: (o, i) => formatTs(o.create_time) },
    { key: 'update_time', label: 'Ngày cập nhật (update_time)', get: (o, i) => formatTs(o.update_time) },
    { key: 'order_type', label: 'Loại đơn (order_type)', get: (o, i) => o.order_type || '' },
    { key: 'fulfillment_type', label: 'Fulfillment type (fulfillment_type)', get: (o, i) => o.fulfillment_type || '' },
    { key: 'delivery_option_name', label: 'Phương thức giao (delivery_option_name)', get: (o, i) => o.delivery_option_name || '' },
    { key: 'delivery_type', label: 'Loại giao hàng (delivery_type)', get: (o, i) => o.delivery_type || '' },
    { key: 'shipping_provider', label: 'Nhà vận chuyển (shipping_provider)', get: (o, i) => o.shipping_provider || '' },
    { key: 'tracking_number_order', label: 'Mã vận đơn đơn (tracking_number)', get: (o, i) => o.tracking_number || '' },
    { key: 'payment_method_name', label: 'PTTT (payment_method_name)', get: (o, i) => o.payment_method_name || '' },
    { key: 'user_id', label: 'User ID (user_id)', get: (o, i) => o.user_id || '' },
    { key: 'recipient_name', label: 'Tên người nhận (recipient_name)', get: (o, i) => (o.recipient_address || {}).name || '' },
    { key: 'recipient_phone', label: 'SĐT người nhận (recipient_phone)', get: (o, i) => (o.recipient_address || {}).phone_number || '' },
    { key: 'recipient_full_address', label: 'Địa chỉ đầy đủ (recipient_full_address)', get: (o, i) => (o.recipient_address || {}).full_address || '' },
    { key: 'original_total_product_price', label: 'Giá gốc SP đơn (original_total_product_price)', get: (o, i) => parseFloat((o.payment || {}).original_total_product_price || 0) },
    { key: 'platform_discount', label: 'CK Platform đơn (platform_discount)', get: (o, i) => parseFloat((o.payment || {}).platform_discount || 0) },
    { key: 'seller_discount', label: 'CK Seller đơn (seller_discount)', get: (o, i) => parseFloat((o.payment || {}).seller_discount || 0) },
    { key: 'sub_total', label: 'Tạm tính (sub_total)', get: (o, i) => parseFloat((o.payment || {}).sub_total || 0) },
    { key: 'original_shipping_fee', label: 'Phí ship gốc (original_shipping_fee)', get: (o, i) => parseFloat((o.payment || {}).original_shipping_fee || 0) },
    { key: 'shipping_fee', label: 'Phí ship thực (shipping_fee)', get: (o, i) => parseFloat((o.payment || {}).shipping_fee || 0) },
    { key: 'shipping_fee_platform_discount', label: 'CK ship platform (shipping_fee_platform_discount)', get: (o, i) => parseFloat((o.payment || {}).shipping_fee_platform_discount || 0) },
    { key: 'shipping_fee_seller_discount', label: 'CK ship seller (shipping_fee_seller_discount)', get: (o, i) => parseFloat((o.payment || {}).shipping_fee_seller_discount || 0) },
    { key: 'shipping_fee_cofunded_discount', label: 'CK ship cofund (shipping_fee_cofunded_discount)', get: (o, i) => parseFloat((o.payment || {}).shipping_fee_cofunded_discount || 0) },
    { key: 'tax', label: 'Thuế (tax)', get: (o, i) => parseFloat((o.payment || {}).tax || 0) },
    { key: 'total_amount', label: 'Tổng thanh toán (total_amount)', get: (o, i) => parseFloat((o.payment || {}).total_amount || 0) },
    { key: 'line_item_id', label: 'Line Item ID (line_item_id)', get: (o, i) => i.id || '' },
    { key: 'product_id', label: 'Product ID (product_id)', get: (o, i) => i.product_id || '' },
    { key: 'product_name', label: 'Tên sản phẩm (product_name)', get: (o, i) => i.product_name || '' },
    { key: 'sku_id', label: 'SKU ID (sku_id)', get: (o, i) => i.sku_id || '' },
    { key: 'sku_name', label: 'Tên SKU (sku_name)', get: (o, i) => i.sku_name || '' },
    { key: 'seller_sku', label: 'Seller SKU (seller_sku)', get: (o, i) => i.seller_sku || '' },
    { key: 'sku_type', label: 'SKU Type (sku_type)', get: (o, i) => i.sku_type || '' },
    { key: 'is_gift', label: 'Là quà tặng (is_gift)', get: (o, i) => i.is_gift ? 'Có' : 'Không' },
    { key: 'gift_retail_price', label: 'Giá trị quà (gift_retail_price)', get: (o, i) => parseFloat(i.gift_retail_price || 0) },
    { key: 'original_price', label: 'Giá gốc item (original_price)', get: (o, i) => parseFloat(i.original_price || 0) },
    { key: 'sale_price', label: 'Giá bán item (sale_price)', get: (o, i) => parseFloat(i.sale_price || 0) },
    { key: 'item_platform_discount', label: 'CK platform item (item_platform_discount)', get: (o, i) => parseFloat(i.platform_discount || 0) },
    { key: 'item_seller_discount', label: 'CK seller item (item_seller_discount)', get: (o, i) => parseFloat(i.seller_discount || 0) },
    { key: 'item_display_status', label: 'Trạng thái item (item_display_status)', get: (o, i) => i.display_status || '' },
    { key: 'item_package_id', label: 'Package ID item (package_id)', get: (o, i) => i.package_id || '' },
    { key: 'package_status', label: 'Trạng thái package (package_status)', get: (o, i) => i.package_status || '' },
    { key: 'item_tracking_number', label: 'Mã vận đơn item (tracking_number)', get: (o, i) => i.tracking_number || '' },
    { key: 'shipping_provider_name', label: 'Nhà VC item (shipping_provider_name)', get: (o, i) => i.shipping_provider_name || '' },
  ];

  const selectedKeys = (options.fields && options.fields.length > 0) ? options.fields : ALL_FIELDS.map(f => f.key);
  const selectedFields = ALL_FIELDS.filter(f => selectedKeys.includes(f.key));
  const headers = selectedFields.map(f => f.label);

  if (options.overwrite || sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setBackground('#1a1a2e')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }

  const rows = [];
  orders.forEach(o => {
    const items = o.line_items || [];
    if (items.length === 0) {
      const emptyItem = {};
      rows.push(selectedFields.map(f => { try { return f.get(o, emptyItem); } catch (e) { return ''; } }));
    } else {
      items.forEach(item => {
        rows.push(selectedFields.map(f => { try { return f.get(o, item); } catch (e) { return ''; } }));
      });
    }
  });

  if (rows.length > 0) {
    const startRow = options.overwrite ? 2 : (sheet.getLastRow() + 1);
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
    const moneyKeys = ['original_total_product_price', 'platform_discount', 'seller_discount', 'sub_total', 'original_shipping_fee', 'shipping_fee', 'shipping_fee_platform_discount', 'shipping_fee_seller_discount', 'shipping_fee_cofunded_discount', 'tax', 'total_amount', 'gift_retail_price', 'original_price', 'sale_price', 'item_platform_discount', 'item_seller_discount'];
    selectedFields.forEach((f, i) => { if (moneyKeys.includes(f.key)) sheet.getRange(startRow, i + 1, rows.length).setNumberFormat('#,##0'); });
    const textKeys = ['id', 'user_id', 'line_item_id', 'product_id', 'sku_id', 'tracking_number_order', 'item_tracking_number', 'item_package_id'];
    selectedFields.forEach((f, i) => { if (textKeys.includes(f.key)) sheet.getRange(startRow, i + 1, rows.length).setNumberFormat('@'); });
  }

  for (let i = 1; i <= headers.length; i++) sheet.autoResizeColumn(i);
  SpreadsheetApp.flush();
  return rows.length;
}

// ============================================================
// SIGNATURE — TikTok Shop API v2
// ============================================================
function makeSign(path, params, body, secret) {
  const sorted = Object.keys(params).filter(k => k !== 'sign' && k !== 'access_token').sort();
  let str = secret + path;
  sorted.forEach(k => { str += k + params[k]; });
  if (body) str += body;
  str += secret;
  const sig = Utilities.computeHmacSha256Signature(str, secret);
  return sig.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

// ============================================================
// CORE REQUEST
// ============================================================
function tsRequest(path, method, extraParams, body) {
  const token = getProp('ACCESS_TOKEN');
  const appKey = getProp('APP_KEY');
  const appSecret = getProp('APP_SECRET');
  if (!token || !appKey || !appSecret) throw new Error('Chưa cấu hình đủ. Vào menu → Nhập Token & Config.');
  const ts = Math.floor(Date.now() / 1000).toString();
  const queryParams = Object.assign({ app_key: appKey, timestamp: ts }, extraParams || {});
  const bodyString = body ? JSON.stringify(sortObject(body)) : '';
  const sign = makeSign(path, queryParams, bodyString, appSecret);
  const urlParts = [];
  Object.keys(queryParams).forEach(k => { urlParts.push(k + '=' + encodeURIComponent(queryParams[k])); });
  urlParts.push('sign=' + sign);
  urlParts.push('access_token=' + encodeURIComponent(token));
  const url = TS_CONFIG.API_BASE + path + '?' + urlParts.join('&');
  const options = { method: method, headers: { 'x-tts-access-token': token }, muteHttpExceptions: true };
  if (method === 'POST') { options.payload = bodyString || '{}'; options.contentType = 'application/json'; }
  const res = UrlFetchApp.fetch(url, options);
  const text = res.getContentText();
  const data = JSON.parse(text);
  if (data.code === 36004000 || (data.message && data.message.toLowerCase().includes('token'))) {
    doRefreshToken();
    return tsRequest(path, method, extraParams, body);
  }
  if (data.code !== 0) throw new Error('[' + data.code + '] ' + data.message);
  return data;
}

function doRefreshToken() {
  const p = PropertiesService.getScriptProperties();
  const url = 'https://auth.tiktok-shops.com/api/v2/token/refresh?app_key=' + encodeURIComponent(getProp('APP_KEY')) + '&app_secret=' + encodeURIComponent(getProp('APP_SECRET')) + '&refresh_token=' + encodeURIComponent(getProp('REFRESH_TOKEN')) + '&grant_type=refresh_token';
  const res = UrlFetchApp.fetch(url, { method: 'GET', muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());
  if (data.code === 0 && data.data) {
    p.setProperty('ACCESS_TOKEN', data.data.access_token);
    p.setProperty('REFRESH_TOKEN', data.data.refresh_token);
  } else {
    throw new Error('Refresh token thất bại: ' + res.getContentText().substring(0, 200));
  }
}

function getProp(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function sortObject(obj) { return Object.keys(obj).sort().reduce((r, k) => { r[k] = obj[k]; return r; }, {}); }
function formatTs(ts) { if (!ts) return ''; return Utilities.formatDate(new Date(ts * 1000), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function mapStatus(s) {
  const m = { 'UNPAID': 'Chưa TT', 'ON_HOLD': 'Chờ xử lý', 'AWAITING_SHIPMENT': 'Chờ giao', 'AWAITING_COLLECTION': 'Chờ lấy', 'PARTIALLY_SHIPPING': 'Đang giao 1 phần', 'IN_TRANSIT': 'Đang vận chuyển', 'DELIVERED': 'Đã giao', 'COMPLETED': 'Hoàn thành', 'CANCELLED': 'Đã hủy', 'IN_CANCEL': 'Đang hủy', 'RETURNED': 'Hoàn hàng' };
  return m[s] || (s ? s.toString() : '');
}

// ============================================================
// KÉO SẢN PHẨM
// ============================================================
function ui_pullProducts() {
  const result = runPullProducts({ sheetName: 'Products', overwrite: true });
  SpreadsheetApp.getUi().alert(result.success ? '✅ Thành công' : '❌ Lỗi', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function runPullProducts(options) {
  try {
    const cipher = getProp('SHOP_CIPHER');
    if (!cipher) throw new Error('Chưa có Shop Cipher.');
    const allProducts = [];
    let cursor = '';
    let page = 0;
    do {
      Utilities.sleep(600);
      const qp = { shop_cipher: cipher, page_size: '50' };
      if (cursor) qp.page_token = cursor;
      const res = tsRequest('/product/' + TS_CONFIG.VERSION + '/products/search', 'POST', qp, {});
      const list = (res.data && res.data.products) ? res.data.products : [];
      list.forEach(p => allProducts.push(p));
      cursor = (res.data && (res.data.next_page_token || res.data.next_cursor)) || '';
      page++;
    } while (cursor && page < 50);
    if (allProducts.length === 0) return { success: false, message: 'Không tìm thấy sản phẩm nào.' };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = options.sheetName || 'Products';
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    if (options.overwrite) sheet.clear();
    const headers = ['Product ID', 'Tên sản phẩm', 'Trạng thái', 'Giá gốc', 'Giá bán', 'Tồn kho', 'Đã bán', 'SKU', 'Danh mục', 'Ngày tạo'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1a1a2e').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
    const rows = allProducts.map(p => {
      const skus = p.skus || [];
      const mainSku = skus[0] || {};
      const price = mainSku.price || p.price || {};
      const stock = (mainSku.stock_infos && mainSku.stock_infos[0]) ? mainSku.stock_infos[0].available_stock || 0 : 0;
      return [(p.id || '').toString(), p.title || p.name || '', p.status || '', price.original_price || 0, price.sale_price || price.current_price || 0, stock, p.sales || p.sold_count || 0, mainSku.seller_sku || '', p.category_name || (p.category_chains && p.category_chains[0] ? p.category_chains[0].name : '') || '', p.create_time ? formatTs(p.create_time) : ''];
    });
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      sheet.getRange(2, 1, rows.length).setNumberFormat('@');
      sheet.getRange(2, 4, rows.length, 2).setNumberFormat('#,##0');
    }
    for (let i = 1; i <= headers.length; i++) sheet.autoResizeColumn(i);
    sheet.setFrozenRows(1);
    return { success: true, message: 'Đã kéo ' + rows.length + ' sản phẩm vào sheet "' + sheetName + '"' };
  } catch (e) { return { success: false, message: e.message }; }
}

function sidebarPullProducts(sheetName) { return runPullProducts({ sheetName: sheetName || 'Products', overwrite: true }); }

// ============================================================
// AUTO-SYNC HÀNG NGÀY
// ============================================================
function enableDailySync() {
  const ui = SpreadsheetApp.getUi();
  const hourResult = ui.prompt('⏰ Cài đặt auto-sync', 'Chạy tự động lúc mấy giờ? (0-23)', ui.ButtonSet.OK_CANCEL);
  if (hourResult.getSelectedButton() !== ui.Button.OK) return;
  const hour = parseInt(hourResult.getResponseText()) || 6;
  const daysResult = ui.prompt('📅 Kéo mấy ngày gần nhất?', 'Số ngày mỗi lần sync:', ui.ButtonSet.OK_CANCEL);
  if (daysResult.getSelectedButton() !== ui.Button.OK) return;
  const days = parseInt(daysResult.getResponseText()) || 3;
  const p = PropertiesService.getScriptProperties();
  p.setProperty('SYNC_DAYS', days.toString());
  p.setProperty('SYNC_HOUR', hour.toString());
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'autoSyncOrders') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('autoSyncOrders').timeBased().everyDays(1).atHour(hour).create();
  ui.alert('✅ Auto-sync đã bật!', 'Sẽ chạy lúc ' + hour + ':00 mỗi ngày, kéo ' + days + ' ngày gần nhất.', ui.ButtonSet.OK);
}

function disableDailySync() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'autoSyncOrders') { ScriptApp.deleteTrigger(t); removed++; } });
  SpreadsheetApp.getUi().alert(removed > 0 ? '✅ Đã tắt auto-sync' : 'ℹ️ Không có auto-sync đang chạy', '', SpreadsheetApp.getUi().ButtonSet.OK);
}

function autoSyncOrders() {
  const p = PropertiesService.getScriptProperties();
  const days = parseInt(p.getProperty('SYNC_DAYS')) || 3;
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);
  const dateFrom = Utilities.formatDate(from, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const dateTo = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  try {
    runPullOrders({ dateFrom, dateTo, fields: [], sheetName: 'AutoSync_Orders', overwrite: true });
    runPullProducts({ sheetName: 'AutoSync_Products', overwrite: true });
  } catch (e) {
    Logger.log('❌ Auto-sync failed: ' + e.message);
    try { const email = Session.getActiveUser().getEmail(); if (email) MailApp.sendEmail(email, '🚨 TikTok Shop Auto-sync thất bại', 'Lỗi: ' + e.message); } catch (mailErr) { }
  }
}

// ============================================================
// DASHBOARD WEB APP
// ============================================================
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Trioderma Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function loadAllOrders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Orders');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var colIdx = {};
  headers.forEach(function (h, i) { colIdx[String(h).trim()] = i; });
  function get(row, name) {
    if (colIdx[name] !== undefined) return row[colIdx[name]];
    for (var h in colIdx) { var m = h.match(/\(([^)]+)\)$/); if (m && m[1] === name) return row[colIdx[h]]; }
    for (var h2 in colIdx) { if (h2.toLowerCase().indexOf(name.toLowerCase()) !== -1) return row[colIdx[h2]]; }
    return '';
  }
  function num(v) { return parseFloat(v) || 0; }
  function str(v) { return v ? String(v).trim() : ''; }
  function toUnix(v) {
    if (!v) return 0;
    if (v instanceof Date) return Math.floor(v.getTime() / 1000);
    var d = new Date(v);
    return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
  }
  var orderMap = {};
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var orderId = str(get(row, 'id')) || str(get(row, 'Order ID'));
    if (!orderId) continue;
    if (!orderMap[orderId]) {
      orderMap[orderId] = { id: orderId, order_id: orderId, status: str(get(row, 'status')), create_time: toUnix(get(row, 'create_time') || get(row, 'Ngày tạo')), update_time: toUnix(get(row, 'update_time') || get(row, 'Ngày cập nhật')), order_type: str(get(row, 'order_type')), fulfillment_type: str(get(row, 'fulfillment_type')), payment_method_name: str(get(row, 'payment_method_name')), shipping_provider: str(get(row, 'shipping_provider')), tracking_number: str(get(row, 'tracking_number_order')), cancel_reason: str(get(row, 'cancel_reason')), recipient_address: { name: str(get(row, 'recipient_name')), phone_number: str(get(row, 'recipient_phone')), full_address: str(get(row, 'recipient_full_address')), city: '', province: '', district_info: [] }, payment: { original_total_product_price: str(num(get(row, 'original_total_product_price'))), platform_discount: str(num(get(row, 'platform_discount'))), seller_discount: str(num(get(row, 'seller_discount'))), sub_total: str(num(get(row, 'sub_total'))), original_shipping_fee: str(num(get(row, 'original_shipping_fee'))), shipping_fee: str(num(get(row, 'shipping_fee'))), shipping_fee_platform_discount: str(num(get(row, 'shipping_fee_platform_discount'))), shipping_fee_seller_discount: str(num(get(row, 'shipping_fee_seller_discount'))), tax: str(num(get(row, 'tax'))), total_amount: str(num(get(row, 'total_amount'))) }, line_items: [] };
      var addr = str(get(row, 'recipient_full_address'));
      if (addr) { var p = parseProv(addr); orderMap[orderId].recipient_address.city = p; orderMap[orderId].recipient_address.province = p; orderMap[orderId].recipient_address.district_info = [{ address_level_name: 'province', address_name: p }]; }
    } else {
      if (!orderMap[orderId].cancel_reason) orderMap[orderId].cancel_reason = str(get(row, 'cancel_reason'));
    }
    function parseProv(a) { var parts = a.split(',').map(function (s) { return s.trim(); }); var province = ''; for (var i = 0; i < parts.length; i++) { var p = parts[i]; if (p.toLowerCase() === 'việt nam' || p.toLowerCase() === 'vietnam') continue; if (p.indexOf('Thành phố') !== -1 || p.indexOf('Tỉnh') !== -1) { province = p; break; } } if (!province) { if (parts[0].toLowerCase().indexOf('viet') !== -1) province = parts[1] || ''; else province = parts[parts.length - 1]; } return province || 'Không rõ'; }
    var productName = str(get(row, 'product_name'));
    if (productName) {
      orderMap[orderId].line_items.push({ id: str(get(row, 'line_item_id')), product_id: str(get(row, 'product_id')), product_name: productName, sku_id: str(get(row, 'sku_id')), sku_name: str(get(row, 'sku_name')), seller_sku: str(get(row, 'seller_sku')), quantity: parseInt(get(row, 'quantity')) || 1, original_price: str(num(get(row, 'original_price'))), sale_price: str(num(get(row, 'sale_price'))), platform_discount: str(num(get(row, 'item_platform_discount'))), seller_discount: str(num(get(row, 'item_seller_discount'))), display_status: str(get(row, 'item_display_status')), package_id: str(get(row, 'item_package_id')), package_status: str(get(row, 'package_status')), tracking_number: str(get(row, 'item_tracking_number')), shipping_provider_name: str(get(row, 'shipping_provider_name')) });
    }
  }
  var statusReverse = { 'Chưa TT': 'UNPAID', 'Chờ xử lý': 'ON_HOLD', 'Chờ giao': 'AWAITING_SHIPMENT', 'Chờ lấy': 'AWAITING_COLLECTION', 'Đang giao 1 phần': 'PARTIALLY_SHIPPING', 'Đang vận chuyển': 'IN_TRANSIT', 'Đã giao': 'DELIVERED', 'Hoàn thành': 'COMPLETED', 'Đã hủy': 'CANCELLED', 'Đang hủy': 'IN_CANCEL', 'Hoàn hàng': 'RETURNED' };
  var orders = Object.keys(orderMap).map(function (k) { var o = orderMap[k]; if (statusReverse[o.status]) o.status = statusReverse[o.status]; return o; });
  orders.sort(function (a, b) { return (b.create_time || 0) - (a.create_time || 0); });
  return orders;
}

function loadAllProducts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Products');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var colIdx = {};
  headers.forEach(function (h, i) { colIdx[String(h).trim()] = i; });
  function get(row, name) { if (colIdx[name] !== undefined) return row[colIdx[name]]; for (var h in colIdx) { if (h.toLowerCase().indexOf(name.toLowerCase()) !== -1) return row[colIdx[h]]; } return ''; }
  var products = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var pid = String(get(row, 'Product ID') || '').trim();
    if (!pid) continue;
    products.push({ id: pid, product_id: pid, title: String(get(row, 'Tên sản phẩm') || '').trim(), name: String(get(row, 'Tên sản phẩm') || '').trim(), status: String(get(row, 'Trạng thái') || '').trim(), sales: 0, sold_count: 0, skus: [{ seller_sku: String(get(row, 'SKU') || '').trim(), price: { original_price: String(get(row, 'Giá gốc') || '0'), sale_price: String(get(row, 'Giá bán') || '0') }, inventory: [{ quantity: parseInt(get(row, 'Tồn kho')) || 0 }] }] });
  }
  var orders = loadAllOrders();
  var salesMap = {};
  orders.forEach(function (o) {
    var s = (o.status || '').toUpperCase();
    if (s === 'CANCELLED' || s === 'RETURNED' || s === 'IN_CANCEL') return;
    (o.line_items || []).forEach(function (item) {
      var pid2 = String(item.product_id || '');
      if (!pid2) return;
      var qty = parseInt(item.quantity || 1);
      var price = parseFloat(item.sale_price || 0);
      if (!salesMap[pid2]) salesMap[pid2] = { qty: 0, gmv: 0 };
      salesMap[pid2].qty += qty;
      salesMap[pid2].gmv += price * qty;
    });
  });
  products.forEach(function (p) { var sd = salesMap[p.id] || { qty: 0, gmv: 0 }; p.sales = sd.qty; p.sales_gmv = Math.round(sd.gmv); p.sold_count = sd.qty; });
  products.sort(function (a, b) { return (b.sales_gmv || 0) - (a.sales_gmv || 0); });
  return products;
}

function loadAdsData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('GMV Ads');
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var idx = {};
  headers.forEach(function (h, i) { idx[h] = i; });
  function get(row, col) { var i = idx[col]; return (i !== undefined) ? row[i] : null; }
  function num(v) { if (v === null || v === undefined || v === '') return 0; return parseFloat(String(v).replace(',', '.')) || 0; }
  function parseDate(val) { if (!val) return null; if (val instanceof Date) { try { return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd'); } catch (e) { return null; } } var s = String(val).trim(); var match = s.match(/^(\d{4}-\d{2}-\d{2})/); return match ? match[1] : null; }
  var rows = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var campId = String(get(row, 'campaign_id') || '').trim();
    if (!campId) continue;
    var dateStr = parseDate(get(row, 'stat_time_day'));
    if (!dateStr) continue;
    rows.push({ campaign_id: campId, date: dateStr, campaign_name: String(get(row, 'campaign_name') || '').trim(), cost: num(get(row, 'cost')), orders: parseInt(get(row, 'orders')) || 0, roi: num(get(row, 'roi')), cost_per_order: num(get(row, 'cost_per_order')), gmv: num(get(row, 'gross_revenue')), net_cost: num(get(row, 'net_cost')), roas_bid: num(get(row, 'roas_bid')), status: String(get(row, 'operation_status') || '').trim(), schedule_type: String(get(row, 'schedule_type') || '').trim() });
  }
  return rows;
}

function loadVideoPerformance(options) {
  try {
    var cipher = getProp('SHOP_CIPHER');
    if (!cipher) throw new Error('Chưa có Shop Cipher.');
    var allVideos = [];
    var cursor = '';
    var page = 0;
    do {
      Utilities.sleep(500);
      var qp = { shop_cipher: cipher, start_date_ge: options.dateFrom, end_date_lt: nextDay(options.dateTo), page_size: '50', sort_field: 'gmv', sort_order: 'DESC' };
      if (cursor) qp.page_token = cursor;
      var res = tsRequest('/analytics/202509/shop_videos/performance', 'GET', qp, null);
      var list = (res.data && res.data.videos) ? res.data.videos : [];
      list.forEach(v => allVideos.push(v));
      cursor = (res.data && res.data.next_page_token) || '';
      page++;
    } while (cursor && page < 20);
    return { success: true, videos: allVideos, message: 'Đã tải ' + allVideos.length + ' videos' };
  } catch (e) { return { success: false, videos: [], message: e.message }; }
}

function loadLivePerformance(options) {
  try {
    var cipher = getProp('SHOP_CIPHER');
    if (!cipher) throw new Error('Chưa có Shop Cipher.');
    var allSessions = [];
    var cursor = '';
    var page = 0;
    do {
      Utilities.sleep(1500);
      var qp = { shop_cipher: cipher, start_date_ge: options.dateFrom, end_date_lt: nextDay(options.dateTo), page_size: '20' };
      if (cursor) qp.page_token = cursor;
      var res = tsRequest('/analytics/202509/shop_lives/performance', 'GET', qp, null);
      var list = (res.data && res.data.live_stream_sessions) ? res.data.live_stream_sessions : [];
      list.forEach(function (s) { allSessions.push(s); });
      cursor = (res.data && res.data.next_page_token) || '';
      page++;
    } while (cursor && page < 20);
    return { success: true, sessions: allSessions, message: 'Đã tải ' + allSessions.length + ' phiên live' };
  } catch (e) { return { success: false, sessions: [], message: e.message }; }
}

function nextDay(dateStr) { var d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + 1); return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// ============================================================
// BIGQUERY STORAGE SYSTEM (V2.0)
// ============================================================

// Lazy init — đọc từ ScriptProperties mỗi lần gọi, tránh lỗi khi khởi tạo global scope
function getBQConfig() {
  return {
    PROJECT_ID: getProp('BQ_PROJECT_ID'),
    DATASET_ID: getProp('BQ_DATASET_ID') || 'tiktok_shop_data',
    TABLE_ID: getProp('BQ_TABLE_ID') || 'orders_raw'
  };
}

/**
 * CREATE DATASET - Run this first if you haven't created the dataset in BQ
 */
function bqCreateDataset() {
  const BQ_CONFIG = getBQConfig();
  const pId = BQ_CONFIG.PROJECT_ID;
  if (!pId) return "❌ Project ID is empty!";
  
  const dataset = {
    datasetReference: {
      projectId: pId,
      datasetId: BQ_CONFIG.DATASET_ID
    }
  };
  
  try {
    BigQuery.Datasets.insert(dataset, pId);
    Logger.log('✅ Dataset created successfully.');
    return "✅ Dataset created successfully.";
  } catch (e) {
    if (e.message.indexOf('Already Exists') !== -1) {
      Logger.log('ℹ️ Dataset already exists.');
      return "ℹ️ Dataset already exists.";
    }
    Logger.log('❌ BQ Dataset Error: ' + e.message);
    return "❌ Error: " + e.message;
  }
}

function bqInitTable() {
  const BQ_CONFIG = getBQConfig();
  const pId = BQ_CONFIG.PROJECT_ID;
  if (!pId) {
    Logger.log('❌ Missing Project ID. Run setup_BQ_Config() first.');
    return;
  }

  const table = {
    tableReference: { projectId: pId, datasetId: BQ_CONFIG.DATASET_ID, tableId: BQ_CONFIG.TABLE_ID },
    schema: {
      fields: [
        { name: 'order_id', type: 'STRING' }, { name: 'status', type: 'STRING' }, { name: 'cancel_reason', type: 'STRING' }, { name: 'create_time', type: 'TIMESTAMP' }, { name: 'update_time', type: 'TIMESTAMP' }, { name: 'order_type', type: 'STRING' }, { name: 'fulfillment_type', type: 'STRING' }, { name: 'shipping_provider', type: 'STRING' }, { name: 'tracking_number', type: 'STRING' }, { name: 'payment_method', type: 'STRING' }, { name: 'user_id', type: 'STRING' }, { name: 'recipient_name', type: 'STRING' }, { name: 'recipient_city', type: 'STRING' }, { name: 'recipient_address', type: 'STRING' }, { name: 'total_amount', type: 'FLOAT' }, { name: 'sub_total', type: 'FLOAT' }, { name: 'shipping_fee', type: 'FLOAT' }, { name: 'platform_discount', type: 'FLOAT' }, { name: 'seller_discount', type: 'FLOAT' }, { name: 'sku_id', type: 'STRING' }, { name: 'sku_name', type: 'STRING' }, { name: 'product_name', type: 'STRING' }, { name: 'quantity', type: 'INTEGER' }, { name: 'sale_price', type: 'FLOAT' }, { name: 'item_discount', type: 'FLOAT' }, { name: 'sync_time', type: 'TIMESTAMP' }
      ]
    }
  };
  try {
    BigQuery.Tables.insert(table, pId, BQ_CONFIG.DATASET_ID);
    Logger.log('✅ BQ Table Created Successfully.');
  } catch (e) { 
    if (e.message.indexOf('Not found: Dataset') !== -1) {
      Logger.log('🚨 Dataset NOT FOUND! Running bqCreateDataset() automatically...');
      bqCreateDataset();
      // Retry once
      try {
        BigQuery.Tables.insert(table, pId, BQ_CONFIG.DATASET_ID);
        Logger.log('✅ BQ Table Created Successfully after creating dataset.');
      } catch(e2) { Logger.log('❌ Final Init Error: ' + e2.message); }
    } else {
      Logger.log('ℹ️ BQ Table Init Info: ' + e.message); 
    }
  }
}

function streamToBigQuery(orders) {
  if (!orders || orders.length === 0) return;
  const BQ_CONFIG = getBQConfig();
  const pId = BQ_CONFIG.PROJECT_ID;
  const dId = BQ_CONFIG.DATASET_ID;
  const tId = BQ_CONFIG.TABLE_ID;
  if (!pId) return;
  const rows = [];
  const now = new Date().toISOString();
  orders.forEach(o => {
    const items = o.line_items || [{}];
    items.forEach(i => {
      rows.push({
        json: {
          order_id: String(o.id || o.order_id || ''), status: String(o.status || ''), cancel_reason: String(o.cancel_reason || ''), create_time: o.create_time ? new Date(o.create_time * 1000).toISOString() : null, update_time: o.update_time ? new Date(o.update_time * 1000).toISOString() : null, order_type: String(o.order_type || ''), fulfillment_type: String(o.fulfillment_type || ''), shipping_provider: String(o.shipping_provider || ''), tracking_number: String(o.tracking_number || o.tracking_number_order || ''), payment_method: String(o.payment_method_name || o.payment_method || ''), user_id: String(o.user_id || ''), recipient_name: String((o.recipient_address || {}).name || ''), recipient_city: String((o.recipient_address || {}).city || ''), recipient_address: String((o.recipient_address || {}).full_address || ''), total_amount: parseFloat((o.payment || {}).total_amount || 0), sub_total: parseFloat((o.payment || {}).sub_total || 0), shipping_fee: parseFloat((o.payment || {}).shipping_fee || 0), platform_discount: parseFloat((o.payment || {}).platform_discount || 0), seller_discount: parseFloat((o.payment || {}).seller_discount || 0), sku_id: String(i.sku_id || ''), sku_name: String(i.sku_name || ''), product_name: String(i.product_name || ''), quantity: parseInt(i.quantity || i.sku_quantity || 0), sale_price: parseFloat(i.sale_price || i.sku_sale_price || 0), item_discount: parseFloat(i.item_platform_discount || i.item_discount || 0), sync_time: now
        }
      });
    });
  });
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    try { BigQuery.Tabledata.insertAll({ rows: chunk }, pId, dId, tId); Logger.log('🚀 Streamed ' + chunk.length + ' rows to BQ'); } catch (e) { Logger.log('❌ BQ Stream Error: ' + e.message); }
  }
}

function bqMigrateAll() {
  const orders = loadAllOrders();
  if (orders.length > 0) {
    bqInitTable();
    streamToBigQuery(orders);
    return '✅ Ghi thành công ' + orders.length + ' đơn vào BigQuery.';
  }
  return 'ℹ️ Không có đơn để migrate.';
}

function parseBqProvince(addr) {
  if (!addr) return '';
  const parts = addr.split(',').map(s => s.trim()).filter(s => s);
  // Bỏ qua "Việt Nam" / "Vietnam" ở đầu
  const filtered = parts.filter(p => !/^vi[eệ]t\s*nam$/i.test(p));
  if (!filtered.length) return '';
  // Ưu tiên phần có "Thành phố" hoặc "Tỉnh"
  const explicit = filtered.find(p => p.indexOf('Thành phố') !== -1 || p.indexOf('Tỉnh') !== -1 || p.indexOf('Tp.') !== -1 || p.indexOf('TP.') !== -1);
  if (explicit) return explicit;
  // Format "Việt Nam, [Tỉnh/TP], ..." → lấy phần tử đầu tiên còn lại
  const raw = filtered[0];
  // Normalize một số tên phổ biến không có prefix
  const normalize = { 'Hồ Chí Minh': 'Thành phố Hồ Chí Minh', 'Hà Nội': 'Thành phố Hà Nội', 'Đà Nẵng': 'Thành phố Đà Nẵng', 'Cần Thơ': 'Thành phố Cần Thơ', 'Hải Phòng': 'Thành phố Hải Phòng' };
  return normalize[raw] || raw;
}

function bqGetOrdersForDashboard() {
  const BQ_CONFIG = getBQConfig();
  const pId = BQ_CONFIG.PROJECT_ID;
  if (!pId) return [];
  const query = `
    SELECT
      order_id, status, cancel_reason,
      UNIX_SECONDS(create_time) as create_ts,
      UNIX_SECONDS(update_time) as update_ts,
      order_type, fulfillment_type, shipping_provider, tracking_number,
      payment_method, user_id, recipient_name, recipient_city, recipient_address,
      total_amount, sub_total, shipping_fee, platform_discount, seller_discount,
      sku_id, sku_name, product_name, quantity, sale_price, item_discount
    FROM (
      SELECT *, ROW_NUMBER() OVER(PARTITION BY order_id, sku_id ORDER BY update_time DESC, sync_time DESC) as row_num
      FROM \`${pId}.${BQ_CONFIG.DATASET_ID}.${BQ_CONFIG.TABLE_ID}\`
    )
    WHERE row_num = 1
    ORDER BY create_ts DESC
    LIMIT 50000
  `;
  try {
    const token = ScriptApp.getOAuthToken();
    const baseUrl = 'https://bigquery.googleapis.com/bigquery/v2/projects/' + pId;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

    // Submit job
    const jobRes = UrlFetchApp.fetch(baseUrl + '/jobs', {
      method: 'post', headers: headers,
      payload: JSON.stringify({ configuration: { query: { query: query, useLegacySql: false } } }),
      muteHttpExceptions: true
    });
    const job = JSON.parse(jobRes.getContentText());
    if (!job.jobReference) { Logger.log('❌ BQ submit error: ' + jobRes.getContentText()); return []; }
    const jobId = job.jobReference.jobId;

    // Poll cho đến khi done
    let done = false;
    for (let i = 0; i < 24; i++) {
      Utilities.sleep(5000);
      const statusRes = UrlFetchApp.fetch(baseUrl + '/jobs/' + jobId, { headers: headers, muteHttpExceptions: true });
      const statusObj = JSON.parse(statusRes.getContentText());
      if (statusObj.status && statusObj.status.state === 'DONE') { done = true; break; }
    }
    if (!done) { Logger.log('❌ BQ job timeout'); return []; }

    // Paginate kết quả
    const allRows = [];
    let pageToken = null;
    let schema = null;
    do {
      let url = baseUrl + '/queries/' + jobId + '?maxResults=5000&timeoutMs=10000';
      if (pageToken) url += '&pageToken=' + pageToken;
      const pageRes = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
      const page = JSON.parse(pageRes.getContentText());
      if (!schema && page.schema) schema = page.schema;
      if (page.rows) allRows.push(...page.rows);
      pageToken = page.pageToken || null;
    } while (pageToken);

    if (!allRows.length || !schema) return [];

    const orderMap = {};
    const fields = schema.fields;
    const colIndex = {};
    fields.forEach((f, i) => colIndex[f.name] = i);

    allRows.forEach(row => {
      const f = row.f;
      const oId = f[colIndex['order_id']].v;
      if (!oId) return;
      const cTs = f[colIndex['create_ts']].v || 0;
      const uTs = f[colIndex['update_ts']].v || cTs;
      if (!orderMap[oId]) {
        orderMap[oId] = {
          order_id: oId,
          status: f[colIndex['status']].v,
          cancel_reason: f[colIndex['cancel_reason']].v,
          create_time: parseInt(cTs),
          update_time: parseInt(uTs),
          order_type: f[colIndex['order_type']].v,
          fulfillment_type: f[colIndex['fulfillment_type']].v,
          shipping_provider: f[colIndex['shipping_provider']].v,
          tracking_number: f[colIndex['tracking_number']].v,
          payment_method: f[colIndex['payment_method']].v,
          user_id: f[colIndex['user_id']].v,
          recipient_address: (function() {
            const fullAddr = f[colIndex['recipient_address']].v || '';
            const city = f[colIndex['recipient_city']].v || '';
            const province = parseBqProvince(fullAddr) || city;
            return {
              name: f[colIndex['recipient_name']].v,
              city: province,
              full_address: fullAddr,
              district_info: province ? [{ address_level_name: 'province', address_name: province }] : []
            };
          })(),
          payment: {
            total_amount: f[colIndex['total_amount']].v,
            sub_total: f[colIndex['sub_total']].v,
            shipping_fee: f[colIndex['shipping_fee']].v,
            platform_discount: f[colIndex['platform_discount']].v,
            seller_discount: f[colIndex['seller_discount']].v
          },
          line_items: []
        };
      }
      orderMap[oId].line_items.push({
        sku_id: f[colIndex['sku_id']].v,
        sku_name: f[colIndex['sku_name']].v,
        product_name: f[colIndex['product_name']].v,
        quantity: f[colIndex['quantity']].v,
        sale_price: f[colIndex['sale_price']].v,
        item_discount: f[colIndex['item_discount']].v
      });
    });
    Logger.log('✅ BQ loaded: ' + allRows.length + ' rows → ' + Object.keys(orderMap).length + ' orders');
    return Object.values(orderMap);
  } catch (e) {
    Logger.log('❌ BQ Query Error: ' + e.message);
    return [];
  }
}

// Wrapper: thử BQ trước, nếu rỗng hoặc lỗi thì fallback về Sheet
function loadOrdersForDashboard() {
  try {
    const bqData = bqGetOrdersForDashboard();
    if (bqData && bqData.length > 0) {
      Logger.log('✅ Dashboard data from BQ: ' + bqData.length + ' orders');
      return bqData;
    }
  } catch (e) {
    Logger.log('⚠️ BQ failed, falling back to Sheet: ' + e.message);
  }
  Logger.log('📊 Dashboard data from Sheet (fallback)');
  return loadAllOrders();
}

function bqTestQuery() {
  const data = bqGetOrdersForDashboard();
  Logger.log('🧪 Test result: ' + data.length + ' orders found.');
  if (data.length > 0) Logger.log('📋 First order sample: ' + JSON.stringify(data[0]));
}

function bqDebug() {
  const cfg = getBQConfig();
  Logger.log('📋 BQ Config: ' + JSON.stringify(cfg));
  if (!cfg.PROJECT_ID) { Logger.log('❌ PROJECT_ID trống'); return; }
  const pId = cfg.PROJECT_ID;
  const tbl = '`' + pId + '.' + cfg.DATASET_ID + '.' + cfg.TABLE_ID + '`';
  try {
    const res = BigQuery.Jobs.query({
      query: `SELECT order_id, status, create_time, UNIX_SECONDS(create_time) as create_ts, total_amount FROM (SELECT *, ROW_NUMBER() OVER(PARTITION BY order_id, sku_id ORDER BY update_time DESC) as rn FROM ${tbl}) WHERE rn = 1 LIMIT 5`,
      useLegacySql: false,
      timeoutMs: 30000
    }, pId);
    Logger.log('✅ jobComplete: ' + res.jobComplete);
    Logger.log('📊 Row count: ' + (res.rows ? res.rows.length : 'null'));
    if (res.rows && res.rows.length > 0) Logger.log('📋 Sample: ' + JSON.stringify(res.rows[0]));
    if (!res.rows) Logger.log('⚠️ res.rows is null/undefined — schema: ' + JSON.stringify(res.schema));
  } catch(e) {
    Logger.log('❌ BQ Error: ' + e.message);
  }
}

function setup_BQ_Config() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('BQ_PROJECT_ID', 'trioderma-analytics');
  p.setProperty('BQ_DATASET_ID', 'tiktok_shop_data');
  p.setProperty('BQ_TABLE_ID', 'orders_raw');
  const msg = "✅ Config Success! Project: trioderma-analytics. Now you có thể chạy bqInitTable() hoặc bqMigrateAll().";
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch(e) {}
}