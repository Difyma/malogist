function asNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function mapYandexProduct(raw) {
  const id = raw.id ?? raw.offerId ?? raw.shopSku
  const sku = raw.shopSku ?? raw.sku

  return {
    marketplace: 'yandex',
    externalProductId: String(id ?? sku ?? 'unknown'),
    externalSku: sku ? String(sku) : undefined,
    offerId: raw.offerId ? String(raw.offerId) : undefined,
    barcode: raw.barcode ? String(raw.barcode) : undefined,
    name: String(raw.name || raw.title || `Yandex ${id ?? 'товар'}`),
    brand: raw.vendor ? String(raw.vendor) : undefined,
    category: raw.categoryName ? String(raw.categoryName) : undefined,
    raw,
  }
}

export function mapYandexStock(raw) {
  const quantity = asNumber(raw.quantity ?? raw.count)
  const reserved = asNumber(raw.reserved)

  return {
    marketplace: 'yandex',
    productExternalId: String(raw.offerId ?? raw.sku ?? raw.id ?? 'unknown'),
    warehouseExternalId: String(raw.warehouseId ?? raw.warehouse?.id ?? 'unknown'),
    warehouseName: raw.warehouseName ?? raw.warehouse?.name,
    region: raw.region ?? raw.warehouse?.address?.city,
    quantity,
    reservedQuantity: reserved,
    availableQuantity: Math.max(0, quantity - reserved),
    syncedAt: new Date(),
    raw,
  }
}

export function mapYandexOrder(raw) {
  const firstItem = Array.isArray(raw.items) ? raw.items[0] || {} : {}

  return {
    marketplace: 'yandex',
    externalOrderId: String(raw.id ?? raw.orderId ?? 'unknown'),
    productExternalId: String(firstItem.offerId ?? firstItem.shopSku ?? 'unknown'),
    warehouseExternalId: raw.warehouse?.id ? String(raw.warehouse.id) : undefined,
    region: raw.deliveryRegion?.name || undefined,
    city: raw.delivery?.address?.city || undefined,
    quantity: asNumber(firstItem.count, 1),
    price: asNumber(firstItem.price),
    status: String(raw.status ?? 'unknown'),
    orderedAt: new Date(raw.creationDate ?? raw.createdAt ?? Date.now()),
    raw,
  }
}
