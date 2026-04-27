import {
  applyLogisticsCoefficient,
  averageDailySales,
  buildReason,
  daysUntilStockout,
  forecastSales,
  recommendationPriority,
  recommendedQuantity,
  safetyStock,
} from './calculations.js'

export function getAccountForecastSettings(db, accountId) {
  return (
    db.forecastSettings.find((item) => item.accountId === accountId) || {
      forecastDays: 28,
      safetyStockDays: 5,
      minStockUnits: 0,
      targetTurnoverDays: 28,
      strategy: 'balanced',
    }
  )
}

export function getProductSalesForDays(db, productId, days) {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  return db.salesDaily.filter((row) => row.productId === productId && row.date >= cutoffDate)
}

export function getRegionShare(db, accountId) {
  const accountProductIds = new Set(
    db.products.filter((product) => product.accountId === accountId).map((product) => product.id),
  )

  const totals = new Map()
  let grandTotal = 0

  db.salesDaily.forEach((row) => {
    if (!accountProductIds.has(row.productId)) return
    const value = totals.get(row.region) || 0
    totals.set(row.region, value + row.quantitySold)
    grandTotal += row.quantitySold
  })

  return Array.from(totals.entries())
    .map(([region, quantity]) => ({
      region,
      quantity,
      share: grandTotal ? quantity / grandTotal : 0,
    }))
    .sort((a, b) => b.quantity - a.quantity)
}

export function generateAccountRecommendations(db, { accountId, forecastDays }) {
  const settings = getAccountForecastSettings(db, accountId)
  const effectiveForecastDays = Number(forecastDays) || settings.forecastDays
  const products = db.products.filter((item) => item.accountId === accountId && item.isActive)

  const result = []

  products.forEach((product) => {
    const productSalesRows = getProductSalesForDays(db, product.id, effectiveForecastDays)
    const totalSales = productSalesRows.reduce((sum, row) => sum + row.quantitySold, 0)
    const avgDaily = averageDailySales(totalSales, effectiveForecastDays)

    const stocks = db.productStocks.filter((stock) => stock.productId === product.id)
    const rule = db.productRules.find((item) => item.productId === product.id)

    stocks.forEach((stock) => {
      const warehouse = db.warehouses.find((item) => item.id === stock.warehouseId)
      if (!warehouse) return

      if (rule?.excludedWarehouseIds?.includes(warehouse.id)) return

      const days = daysUntilStockout(stock.availableQuantity, avgDaily)
      const baseForecast = forecastSales(avgDaily, effectiveForecastDays)
      const safety = safetyStock(avgDaily, settings.safetyStockDays)
      const baseRecommended = recommendedQuantity({
        forecastSalesValue: baseForecast,
        safetyStockValue: safety,
        currentStock: stock.availableQuantity,
        minStockUnits: rule?.minStockUnits ?? settings.minStockUnits,
      })

      const finalRecommended = applyLogisticsCoefficient(
        baseRecommended,
        warehouse.logisticsCoefficient,
      )

      result.push({
        accountId,
        productId: product.id,
        warehouseId: warehouse.id,
        sku: product.sku,
        name: product.name,
        warehouse: warehouse.name,
        currentStock: stock.availableQuantity,
        avgDailySales: Number(avgDaily.toFixed(2)),
        forecastSales: Number(baseForecast.toFixed(2)),
        daysUntilStockout: Number.isFinite(days) ? Number(days.toFixed(2)) : null,
        recommendedQuantity: finalRecommended,
        priority: recommendationPriority(days),
        reason: buildReason({
          days,
          forecastDays: effectiveForecastDays,
          safetyStockDays: settings.safetyStockDays,
        }),
        createdAt: new Date().toISOString(),
      })
    })
  })

  return result.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[a.priority] - order[b.priority]
  })
}
