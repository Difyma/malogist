import { MarketplaceAdapter } from '../marketplace-adapter.interface.js'
import { YandexMarketClient } from './yandex.client.js'
import { mapYandexOrder, mapYandexProduct, mapYandexStock } from './yandex.mapper.js'

function rows(payload) {
  if (Array.isArray(payload?.result?.warehouses)) return payload.result.warehouses
  if (Array.isArray(payload?.campaigns)) return payload.campaigns
  if (Array.isArray(payload?.result?.orders)) return payload.result.orders
  if (Array.isArray(payload?.result?.items)) return payload.result.items
  if (Array.isArray(payload?.result)) return payload.result
  if (Array.isArray(payload)) return payload
  return []
}

export class YandexAdapter extends MarketplaceAdapter {
  constructor(credentials = {}) {
    super()
    if (!credentials.apiKey) {
      throw new Error('Yandex credentials: apiKey is required')
    }

    this.client = new YandexMarketClient(credentials.apiKey)
  }

  async testConnection() {
    await this.client.getCampaigns()
    return true
  }

  async syncProducts() {
    // В MVP используем кампании как базовую сущность, детали по товарам расширим отдельно.
    const campaigns = rows(await this.client.getCampaigns())
    return campaigns.map(this.normalizeProduct)
  }

  async syncWarehouses(campaignId) {
    const payload = await this.client.getWarehouses(campaignId)
    return rows(payload).map((raw) => ({
      externalWarehouseId: String(raw.id ?? 'unknown'),
      name: raw.name ?? 'Yandex warehouse',
      region: raw.address?.city ?? null,
      city: raw.address?.city ?? null,
      raw,
    }))
  }

  async syncStocks() {
    return []
  }

  async syncOrders() {
    return []
  }

  async syncSales() {
    return []
  }

  async syncTariffs() {
    return { message: 'Yandex tariffs adapter is planned for next iteration' }
  }

  normalizeProduct(raw) {
    return mapYandexProduct(raw)
  }

  normalizeStock(raw) {
    return mapYandexStock(raw)
  }

  normalizeOrder(raw) {
    return mapYandexOrder(raw)
  }
}
