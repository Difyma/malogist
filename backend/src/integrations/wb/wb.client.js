import { isoDateDaysAgo, requestJson } from '../common/http.js'

export class WbClient {
  constructor(apiKey) {
    this.apiKey = apiKey
  }

  headers() {
    return {
      Authorization: this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  async getWarehouseStocks(nmIds = [], offset = 0, limit = 1000) {
    return requestJson(
      'https://seller-analytics-api.wildberries.ru/api/analytics/v1/stocks-report/wb-warehouses',
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          nmIds,
          limit,
          offset,
        }),
      },
    )
  }

  async getOrders(dateFrom = isoDateDaysAgo(14), flag = 0) {
    const url = new URL('https://statistics-api.wildberries.ru/api/v1/supplier/orders')
    url.searchParams.set('dateFrom', dateFrom)
    url.searchParams.set('flag', String(flag))

    return requestJson(url, {
      method: 'GET',
      headers: this.headers(),
    })
  }

  async getSales(dateFrom = isoDateDaysAgo(14), flag = 0) {
    const url = new URL('https://statistics-api.wildberries.ru/api/v1/supplier/sales')
    url.searchParams.set('dateFrom', dateFrom)
    url.searchParams.set('flag', String(flag))

    return requestJson(url, {
      method: 'GET',
      headers: this.headers(),
    })
  }

  async getBoxTariffs() {
    return requestJson('https://common-api.wildberries.ru/api/v1/tariffs/box', {
      method: 'GET',
      headers: this.headers(),
    })
  }

  async getPalletTariffs() {
    return requestJson('https://common-api.wildberries.ru/api/v1/tariffs/pallet', {
      method: 'GET',
      headers: this.headers(),
    })
  }

  async getAcceptanceCoefficients() {
    return requestJson('https://common-api.wildberries.ru/api/tariffs/v1/acceptance/coefficients', {
      method: 'GET',
      headers: this.headers(),
    })
  }

  async getReturnTariffs() {
    return requestJson('https://common-api.wildberries.ru/api/v1/tariffs/return', {
      method: 'GET',
      headers: this.headers(),
    })
  }
}
