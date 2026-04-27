import { requestJson } from '../common/http.js'

export class YandexMarketClient {
  constructor(apiKey) {
    this.apiKey = apiKey
  }

  headers() {
    return {
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  async getCampaigns() {
    return requestJson('https://api.partner.market.yandex.ru/v2/campaigns?limit=100', {
      method: 'GET',
      headers: this.headers(),
    })
  }

  async getWarehouses(campaignId) {
    const url = new URL('https://api.partner.market.yandex.ru/v1/warehouses')
    if (campaignId) url.searchParams.set('campaignId', String(campaignId))

    return requestJson(url, {
      method: 'GET',
      headers: this.headers(),
    })
  }

  async getTokenInfo() {
    return requestJson('https://api.partner.market.yandex.ru/v2/auth/token', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({}),
    })
  }
}
