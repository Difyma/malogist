export function averageDailySales(totalSales, days) {
  if (!days) return 0
  return totalSales / days
}

export function daysUntilStockout(currentStock, avgDailySales) {
  if (!avgDailySales) return Number.POSITIVE_INFINITY
  return currentStock / avgDailySales
}

export function forecastSales(avgDailySales, forecastDays) {
  return avgDailySales * forecastDays
}

export function safetyStock(avgDailySales, safetyStockDays) {
  return avgDailySales * safetyStockDays
}

export function recommendedQuantity({
  forecastSalesValue,
  safetyStockValue,
  currentStock,
  minStockUnits = 0,
}) {
  const raw = forecastSalesValue + safetyStockValue - currentStock
  return Math.max(Math.ceil(raw), minStockUnits - currentStock, 0)
}

export function recommendationPriority(days) {
  if (days <= 3) return 'critical'
  if (days <= 7) return 'high'
  if (days <= 14) return 'medium'
  return 'low'
}

export function applyLogisticsCoefficient(baseQuantity, logisticsCoefficient = 1) {
  if (!logisticsCoefficient || logisticsCoefficient <= 0) return baseQuantity
  return Math.max(0, Math.round(baseQuantity / logisticsCoefficient))
}

export function buildReason({ days, forecastDays, safetyStockDays }) {
  const daysRounded = Number.isFinite(days) ? Math.max(0, Math.round(days)) : '∞'
  return `Товар закончится через ${daysRounded} дн. Рекомендуется пополнить запас на ${forecastDays} дней + ${safetyStockDays} дн safety stock.`
}
