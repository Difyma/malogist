function asNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function mapWbProduct(raw) {
  const externalId = raw.nmId ?? raw.nmid ?? raw.subjectId ?? raw.id
  const vendorCode = raw.vendorCode ?? raw.supplierArticle

  return {
    marketplace: 'wb',
    externalProductId: String(externalId ?? vendorCode ?? 'unknown'),
    externalSku: vendorCode ? String(vendorCode) : undefined,
    offerId: vendorCode ? String(vendorCode) : undefined,
    barcode: raw.barcode ? String(raw.barcode) : undefined,
    name: String(raw.brand || raw.subject || vendorCode || `WB ${externalId ?? 'товар'}`),
    brand: raw.brand ? String(raw.brand) : undefined,
    category: raw.subject ? String(raw.subject) : undefined,
    raw,
  }
}

export function mapWbStock(raw) {
  const quantity = asNumber(raw.quantity)
  const inWayToClient = asNumber(raw.inWayToClient)
  const inWayFromClient = asNumber(raw.inWayFromClient)
  const reservedQuantity = asNumber(raw.reservedQuantity)

  return {
    marketplace: 'wb',
    productExternalId: String(raw.nmId ?? raw.nmid ?? raw.chrtId ?? 'unknown'),
    warehouseExternalId: String(raw.warehouseId ?? raw.wh ?? 'unknown'),
    warehouseName: raw.warehouseName ? String(raw.warehouseName) : undefined,
    region: raw.regionName ? String(raw.regionName) : undefined,
    quantity,
    reservedQuantity,
    inWayToClient,
    inWayFromClient,
    availableQuantity: quantity - reservedQuantity,
    syncedAt: new Date(),
    raw,
  }
}

export function mapWbOrder(raw) {
  return {
    marketplace: 'wb',
    externalOrderId: String(raw.srid ?? raw.gNumber ?? raw.odid ?? raw.rid ?? 'unknown'),
    productExternalId: String(raw.nmId ?? raw.nmid ?? raw.chrtId ?? raw.subjectId ?? 'unknown'),
    warehouseExternalId: raw.warehouseId ? String(raw.warehouseId) : undefined,
    region: raw.regionName ? String(raw.regionName) : undefined,
    city: raw.oblastOkrugName ? String(raw.oblastOkrugName) : undefined,
    quantity: Math.max(1, Number(raw.quantity) || 1),
    price: Number(raw.totalPrice) || Number(raw.priceWithDisc) || Number(raw.finishedPrice) || 0,
    status: String(raw.status ?? raw.saleID ?? 'unknown'),
    orderedAt: new Date(raw.date ?? raw.lastChangeDate ?? Date.now()),
    raw,
  }
}
