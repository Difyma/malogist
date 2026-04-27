import { requestJson } from '../common/http.js'

/** RFC3339 без миллисекунд — часть методов Ozon чувствительна к формату. */
function toOzonDateTime(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date for Ozon API')
  }
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

const FBS_LIST_WITH = {
  analytics_data: false,
  barcodes: false,
  financial_data: false,
}

export class OzonClient {
  constructor(clientId, apiKey) {
    this.clientId = clientId
    this.apiKey = apiKey
  }

  headers() {
    return {
      'Client-Id': this.clientId,
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  async getProducts(lastId = '', limit = 1000) {
    return requestJson('https://api-seller.ozon.ru/v3/product/list', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        filter: { visibility: 'ALL' },
        last_id: lastId,
        limit,
      }),
    })
  }

  async getProductInfo(productIds = []) {
    return requestJson('https://api-seller.ozon.ru/v3/product/info/list', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        product_id: productIds,
      }),
    })
  }

  async getStocks(offerIds = []) {
    return requestJson('https://api-seller.ozon.ru/v4/product/info/stocks', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        filter: {
          offer_id: offerIds,
          visibility: 'ALL',
        },
        limit: 1000,
      }),
    })
  }

  async getWarehouses() {
    return requestJson('https://api-seller.ozon.ru/v2/warehouse/list', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({}),
    })
  }

  async getFbsPostings(since, to, limit = 100) {
    const sinceZ = toOzonDateTime(since)
    const toZ = toOzonDateTime(to)
    return requestJson('https://api-seller.ozon.ru/v3/posting/fbs/list', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        // Ozon принимает только нижний регистр (см. SortDirection в ozon-seller SDK)
        dir: 'desc',
        filter: {
          since: sinceZ,
          to: toZ,
        },
        limit,
        offset: 0,
        with: FBS_LIST_WITH,
      }),
    })
  }

  async getFboPostings(since, to, limit = 100) {
    const sinceZ = toOzonDateTime(since)
    const toZ = toOzonDateTime(to)
    return requestJson('https://api-seller.ozon.ru/v2/posting/fbo/list', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        dir: 'desc',
        filter: {
          since: sinceZ,
          to: toZ,
          status: '',
        },
        limit,
        offset: 0,
        with: {
          analytics_data: true,
          financial_data: true,
        },
      }),
    })
  }
}
