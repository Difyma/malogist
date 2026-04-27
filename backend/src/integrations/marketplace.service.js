import { createMarketplaceAdapter } from './marketplace.factory.js'
import { persistSyncEntity } from './persist-integration-sync.js'

function resolveDateRange(payload = {}) {
  const dateTo = payload.dateTo ? new Date(payload.dateTo) : new Date()
  const dateFrom = payload.dateFrom
    ? new Date(payload.dateFrom)
    : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  return { dateFrom, dateTo }
}

export async function testMarketplaceConnection(account, credentials) {
  const adapter = createMarketplaceAdapter(account.marketplace, credentials)
  return adapter.testConnection(String(account.id))
}

export async function syncMarketplaceEntities(account, credentials, entities = [], options = {}) {
  const adapter = createMarketplaceAdapter(account.marketplace, credentials)
  const normalizedEntities = entities.length
    ? entities
    : ['products', 'warehouses', 'stocks', 'orders', 'sales', 'tariffs']

  const { dateFrom, dateTo } = resolveDateRange(options)
  const result = {}

  for (const entity of normalizedEntities) {
    if (entity === 'products') {
      const rows = await adapter.syncProducts(String(account.id))
      const list = Array.isArray(rows) ? rows : []
      result.products = { count: list.length }
      await persistSyncEntity({
        sellerAccountId: options.sellerAccountId,
        marketplace: account.marketplace,
        entity: 'products',
        rows: list,
      })
      continue
    }

    if (entity === 'warehouses') {
      const rows = await adapter.syncWarehouses(String(account.id), options.externalCampaignId)
      const list = Array.isArray(rows) ? rows : []
      result.warehouses = { count: list.length }
      await persistSyncEntity({
        sellerAccountId: options.sellerAccountId,
        marketplace: account.marketplace,
        entity: 'warehouses',
        rows: list,
      })
      continue
    }

    if (entity === 'stocks') {
      const rows = await adapter.syncStocks(String(account.id))
      const list = Array.isArray(rows) ? rows : []
      result.stocks = { count: list.length }
      await persistSyncEntity({
        sellerAccountId: options.sellerAccountId,
        marketplace: account.marketplace,
        entity: 'stocks',
        rows: list,
      })
      continue
    }

    if (entity === 'orders') {
      const rows = await adapter.syncOrders(String(account.id), dateFrom, dateTo)
      const list = Array.isArray(rows) ? rows : []
      result.orders = { count: list.length }
      await persistSyncEntity({
        sellerAccountId: options.sellerAccountId,
        marketplace: account.marketplace,
        entity: 'orders',
        rows: list,
      })
      continue
    }

    if (entity === 'sales') {
      const rows = await adapter.syncSales(String(account.id), dateFrom, dateTo)
      const list = Array.isArray(rows) ? rows : []
      result.sales = { count: list.length }
      await persistSyncEntity({
        sellerAccountId: options.sellerAccountId,
        marketplace: account.marketplace,
        entity: 'sales',
        rows: list,
      })
      continue
    }

    if (entity === 'tariffs') {
      const payload = await adapter.syncTariffs(String(account.id))
      result.tariffs = { count: Array.isArray(payload) ? payload.length : 1 }
      continue
    }

    result[entity] = { skipped: true, reason: 'Unsupported entity' }
  }

  return result
}
