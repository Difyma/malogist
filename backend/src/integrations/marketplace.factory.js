import { OzonAdapter } from './ozon/ozon.adapter.js'
import { WbAdapter } from './wb/wb.adapter.js'
import { YandexAdapter } from './yandex/yandex.adapter.js'

export function createMarketplaceAdapter(marketplace, credentials) {
  if (marketplace === 'wb') return new WbAdapter(credentials)
  if (marketplace === 'ozon') return new OzonAdapter(credentials)
  if (marketplace === 'yandex') return new YandexAdapter(credentials)

  throw new Error(`Unsupported marketplace: ${marketplace}`)
}
