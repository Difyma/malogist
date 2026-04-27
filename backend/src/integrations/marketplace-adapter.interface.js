/**
 * @typedef {Object} ProductDTO
 * @property {'wb'|'ozon'|'yandex'} marketplace
 * @property {string} externalProductId
 * @property {string=} externalSku
 * @property {string=} offerId
 * @property {string=} barcode
 * @property {string} name
 * @property {string=} brand
 * @property {string=} category
 * @property {any} raw
 */

/**
 * @typedef {Object} StockDTO
 * @property {'wb'|'ozon'|'yandex'} marketplace
 * @property {string} productExternalId
 * @property {string} warehouseExternalId
 * @property {string=} warehouseName
 * @property {string=} region
 * @property {number} quantity
 * @property {number=} reservedQuantity
 * @property {number=} inWayToClient
 * @property {number=} inWayFromClient
 * @property {number=} availableQuantity
 * @property {Date} syncedAt
 * @property {any} raw
 */

/**
 * @typedef {Object} OrderDTO
 * @property {'wb'|'ozon'|'yandex'} marketplace
 * @property {string} externalOrderId
 * @property {string} productExternalId
 * @property {string=} warehouseExternalId
 * @property {string=} region
 * @property {string=} city
 * @property {number} quantity
 * @property {number} price
 * @property {string} status
 * @property {Date} orderedAt
 * @property {any} raw
 */

export class MarketplaceAdapter {
  async testConnection() {
    throw new Error('testConnection() is not implemented')
  }

  async syncProducts() {
    throw new Error('syncProducts() is not implemented')
  }

  async syncWarehouses() {
    throw new Error('syncWarehouses() is not implemented')
  }

  async syncStocks() {
    throw new Error('syncStocks() is not implemented')
  }

  async syncOrders() {
    throw new Error('syncOrders() is not implemented')
  }

  async syncSales() {
    throw new Error('syncSales() is not implemented')
  }

  async syncTariffs() {
    throw new Error('syncTariffs() is not implemented')
  }

  normalizeProduct() {
    throw new Error('normalizeProduct() is not implemented')
  }

  normalizeStock() {
    throw new Error('normalizeStock() is not implemented')
  }

  normalizeOrder() {
    throw new Error('normalizeOrder() is not implemented')
  }
}
