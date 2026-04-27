import { HttpError } from '../common/http.js'
import { MarketplaceAdapter } from '../marketplace-adapter.interface.js'
import { OzonClient } from './ozon.client.js'
import { mapOzonOrder, mapOzonProduct, mapOzonStock } from './ozon.mapper.js'

function rows(payload) {
  if (Array.isArray(payload?.result?.postings)) return payload.result.postings
  if (Array.isArray(payload?.result?.items)) return payload.result.items
  if (Array.isArray(payload?.result)) return payload.result
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload)) return payload
  return []
}

function toIsoDate(value) {
  if (value instanceof Date) return value.toISOString()
  return new Date(value || Date.now()).toISOString()
}

export class OzonAdapter extends MarketplaceAdapter {
  constructor(credentials = {}) {
    super()
    if (!credentials.clientId || !credentials.apiKey) {
      throw new Error('Ozon credentials: clientId and apiKey are required')
    }

    this.client = new OzonClient(credentials.clientId, credentials.apiKey)
  }

  async testConnection() {
    await this.client.getWarehouses()
    return true
  }

  async syncProducts() {
    const payload = await this.client.getProducts()
    return rows(payload).map(this.normalizeProduct)
  }

  async syncWarehouses() {
    const payload = await this.client.getWarehouses()
    return rows(payload).map((raw) => ({
      externalWarehouseId: String(raw.warehouse_id ?? raw.id ?? raw.name ?? 'unknown'),
      name: raw.name ?? 'Ozon warehouse',
      region: raw.region ?? null,
      city: raw.city ?? null,
      raw,
    }))
  }

  async syncStocks() {
    // Для MVP без offerIds используем пустой фильтр, Ozon вернет пустой список.
    const payload = await this.client.getStocks([])
    return rows(payload).map(this.normalizeStock)
  }

  async syncOrders(dateFrom, dateTo) {
    const since = toIsoDate(dateFrom)
    const to = toIsoDate(dateTo)

    const settled = await Promise.allSettled([
      this.client.getFbsPostings(since, to),
      this.client.getFboPostings(since, to),
    ])

    const merged = []
    const labels = ['FBS', 'FBO']

    for (let i = 0; i < settled.length; i += 1) {
      const r = settled[i]
      if (r.status === 'fulfilled') {
        merged.push(...rows(r.value))
        continue
      }
      const err = r.reason
      if (err instanceof HttpError && err.status === 400) {
        console.warn(`[ozon] Список отправлений ${labels[i]} пропущен (400 от Ozon): ${err.message}`)
        continue
      }
      throw err
    }

    if (!merged.length && settled.every((r) => r.status === 'rejected')) {
      throw settled[0].reason
    }

    return merged.map(this.normalizeOrder)
  }

  async syncSales(dateFrom, dateTo) {
    return this.syncOrders(dateFrom, dateTo)
  }

  async syncTariffs() {
    return { message: 'Ozon tariffs adapter is planned for next iteration' }
  }

  normalizeProduct(raw) {
    return mapOzonProduct(raw)
  }

  normalizeStock(raw) {
    return mapOzonStock(raw)
  }

  normalizeOrder(raw) {
    return mapOzonOrder(raw)
  }
}
