import { MarketplaceAdapter } from '../marketplace-adapter.interface.js'
import { WbClient } from './wb.client.js'
import { mapWbOrder, mapWbProduct, mapWbStock } from './wb.mapper.js'

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.stocks)) return payload.stocks
  if (Array.isArray(payload?.orders)) return payload.orders
  if (Array.isArray(payload?.sales)) return payload.sales
  if (Array.isArray(payload?.result)) return payload.result
  return []
}

export class WbAdapter extends MarketplaceAdapter {
  constructor(credentials = {}) {
    super()
    if (!credentials.apiKey) {
      throw new Error('WB credentials: apiKey is required')
    }

    this.client = new WbClient(credentials.apiKey)
  }

  async testConnection() {
    await this.client.getOrders()
    return true
  }

  async syncProducts() {
    const sales = normalizeRows(await this.client.getSales())
    return sales.map(this.normalizeProduct)
  }

  async syncWarehouses() {
    const stocks = normalizeRows(await this.client.getWarehouseStocks([]))
    const unique = new Map()

    for (const row of stocks) {
      const id = String(row.warehouseId ?? row.wh ?? row.warehouseName ?? 'unknown')
      if (!unique.has(id)) {
        unique.set(id, {
          externalWarehouseId: id,
          name: row.warehouseName ?? 'WB warehouse',
          region: row.regionName ?? null,
          city: row.regionName ?? null,
          raw: row,
        })
      }
    }

    return Array.from(unique.values())
  }

  async syncStocks() {
    const stocks = normalizeRows(await this.client.getWarehouseStocks([]))
    return stocks.map(this.normalizeStock)
  }

  async syncOrders(dateFrom) {
    const orders = normalizeRows(await this.client.getOrders(dateFrom))
    return orders.map(this.normalizeOrder)
  }

  async syncSales(dateFrom) {
    const sales = normalizeRows(await this.client.getSales(dateFrom))
    return sales.map(this.normalizeOrder)
  }

  async syncTariffs() {
    const [box, pallet, acceptance, returns] = await Promise.all([
      this.client.getBoxTariffs(),
      this.client.getPalletTariffs(),
      this.client.getAcceptanceCoefficients(),
      this.client.getReturnTariffs(),
    ])

    return { box, pallet, acceptance, returns }
  }

  normalizeProduct(raw) {
    return mapWbProduct(raw)
  }

  normalizeStock(raw) {
    return mapWbStock(raw)
  }

  normalizeOrder(raw) {
    return mapWbOrder(raw)
  }
}
