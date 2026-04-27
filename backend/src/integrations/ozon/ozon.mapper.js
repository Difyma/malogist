function asNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function mapOzonProduct(raw) {
  const productId = raw.product_id ?? raw.id ?? raw.sku
  const offerId = raw.offer_id ?? raw.offerId ?? raw.sku

  return {
    marketplace: 'ozon',
    externalProductId: String(productId ?? offerId ?? 'unknown'),
    externalSku: raw.sku ? String(raw.sku) : undefined,
    offerId: offerId ? String(offerId) : undefined,
    barcode: raw.barcode ? String(raw.barcode) : undefined,
    name: String(raw.name || raw.offer_id || `Ozon ${productId ?? 'товар'}`),
    brand: raw.brand ? String(raw.brand) : undefined,
    category: raw.category_name ? String(raw.category_name) : undefined,
    raw,
  }
}

export function mapOzonStock(raw) {
  const quantity = asNumber(raw.stock ?? raw.present)
  const reserved = asNumber(raw.reserved)

  return {
    marketplace: 'ozon',
    productExternalId: String(raw.product_id ?? raw.sku ?? raw.offer_id ?? 'unknown'),
    warehouseExternalId: String(raw.warehouse_id ?? raw.cluster_id ?? 'unknown'),
    warehouseName: raw.warehouse_name ? String(raw.warehouse_name) : undefined,
    region: raw.region ? String(raw.region) : undefined,
    quantity,
    reservedQuantity: reserved,
    availableQuantity: Math.max(0, quantity - reserved),
    syncedAt: new Date(),
    raw,
  }
}

export function mapOzonOrder(raw) {
  const products = Array.isArray(raw.products) ? raw.products : []
  const firstProduct = products[0] || {}

  return {
    marketplace: 'ozon',
    externalOrderId: String(raw.posting_number ?? raw.order_id ?? raw.id ?? 'unknown'),
    productExternalId: String(firstProduct.offer_id ?? firstProduct.product_id ?? 'unknown'),
    warehouseExternalId: raw.warehouse_id ? String(raw.warehouse_id) : undefined,
    region: raw.analytics_data?.region || undefined,
    city: raw.analytics_data?.city || undefined,
    quantity: asNumber(firstProduct.quantity, 1),
    price: asNumber(firstProduct.price),
    status: String(raw.status ?? 'unknown'),
    orderedAt: new Date(raw.in_process_at ?? raw.created_at ?? Date.now()),
    raw,
  }
}
