import bcrypt from 'bcryptjs'

function isoDaysAgo(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(10, 0, 0, 0)
  return d
}

const users = [
  {
    id: 1,
    email: 'demo@malogist.ru',
    passwordHash: bcrypt.hashSync('demo12345', 10),
    name: 'Demo Seller',
    createdAt: new Date().toISOString(),
  },
]

const accounts = [
  {
    id: 1,
    userId: 1,
    name: 'Мой магазин WB',
    marketplaceType: 'wb',
    apiKeyEncrypted: 'enc_wb_token',
    clientIdEncrypted: null,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    userId: 1,
    name: 'Ozon Store',
    marketplaceType: 'ozon',
    apiKeyEncrypted: 'enc_ozon_token',
    clientIdEncrypted: 'enc_client_id',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
]

const warehouses = [
  {
    id: 1,
    marketplaceType: 'wb',
    marketplaceWarehouseId: 'wb-01',
    name: 'Коледино',
    region: 'Московская область',
    city: 'Москва',
    latitude: 55.74,
    longitude: 37.62,
    logisticsCoefficient: 1.05,
    storageCoefficient: 1.1,
    isActive: true,
  },
  {
    id: 2,
    marketplaceType: 'wb',
    marketplaceWarehouseId: 'wb-02',
    name: 'Казань',
    region: 'Татарстан',
    city: 'Казань',
    latitude: 55.8,
    longitude: 49.1,
    logisticsCoefficient: 0.95,
    storageCoefficient: 0.9,
    isActive: true,
  },
  {
    id: 3,
    marketplaceType: 'ozon',
    marketplaceWarehouseId: 'oz-01',
    name: 'СПб',
    region: 'Ленинградская область',
    city: 'Санкт-Петербург',
    latitude: 59.93,
    longitude: 30.31,
    logisticsCoefficient: 1,
    storageCoefficient: 1,
    isActive: true,
  },
]

const products = [
  {
    id: 1,
    accountId: 1,
    marketplaceProductId: 'wb-prod-123',
    sku: 'SKU-123',
    barcode: '4601001001234',
    name: 'Кофе зерновой 1кг',
    category: 'Напитки',
    brand: 'Roastly',
    imageUrl: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    accountId: 1,
    marketplaceProductId: 'wb-prod-456',
    sku: 'SKU-456',
    barcode: '4601001004561',
    name: 'Чай травяной',
    category: 'Напитки',
    brand: 'Herbo',
    imageUrl: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    accountId: 2,
    marketplaceProductId: 'oz-prod-778',
    sku: 'SKU-778',
    barcode: '4601001007784',
    name: 'Термокружка',
    category: 'Посуда',
    brand: 'Hot&Go',
    imageUrl: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
]

const productStocks = [
  { id: 1, productId: 1, warehouseId: 1, quantity: 40, reservedQuantity: 6, availableQuantity: 34, updatedAt: new Date().toISOString() },
  { id: 2, productId: 1, warehouseId: 2, quantity: 200, reservedQuantity: 10, availableQuantity: 190, updatedAt: new Date().toISOString() },
  { id: 3, productId: 2, warehouseId: 1, quantity: 130, reservedQuantity: 12, availableQuantity: 118, updatedAt: new Date().toISOString() },
  { id: 4, productId: 2, warehouseId: 2, quantity: 70, reservedQuantity: 2, availableQuantity: 68, updatedAt: new Date().toISOString() },
  { id: 5, productId: 3, warehouseId: 3, quantity: 55, reservedQuantity: 3, availableQuantity: 52, updatedAt: new Date().toISOString() },
]

const forecastSettings = [
  {
    id: 1,
    accountId: 1,
    forecastDays: 28,
    safetyStockDays: 5,
    minStockUnits: 20,
    targetTurnoverDays: 28,
    strategy: 'balanced',
  },
  {
    id: 2,
    accountId: 2,
    forecastDays: 14,
    safetyStockDays: 3,
    minStockUnits: 10,
    targetTurnoverDays: 14,
    strategy: 'speed',
  },
]

const productRules = [
  {
    id: 1,
    productId: 1,
    alwaysKeepStock: true,
    minStockUnits: 35,
    maxStockUnits: 500,
    preferredWarehouseId: 1,
    excludedWarehouseIds: [],
  },
]

const logisticsCosts = [
  { id: 1, accountId: 1, productId: 1, warehouseId: 1, date: '2026-04-20', deliveryCost: 4200, storageCost: 1200, returnCost: 180, totalCost: 5580 },
  { id: 2, accountId: 1, productId: 1, warehouseId: 2, date: '2026-04-20', deliveryCost: 2600, storageCost: 700, returnCost: 140, totalCost: 3440 },
]

const orders = []
const salesDaily = []

let orderId = 1
let salesId = 1

for (let i = 0; i < 30; i += 1) {
  const orderedAt = isoDaysAgo(i)
  const date = orderedAt.toISOString().slice(0, 10)

  const rows = [
    { accountId: 1, productId: 1, warehouseId: 1, region: 'Москва', city: 'Москва', quantity: 10, price: 1290 },
    { accountId: 1, productId: 1, warehouseId: 2, region: 'Татарстан', city: 'Казань', quantity: 3, price: 1290 },
    { accountId: 1, productId: 2, warehouseId: 1, region: 'Москва', city: 'Москва', quantity: 5, price: 640 },
    { accountId: 1, productId: 2, warehouseId: 2, region: 'СПб', city: 'Санкт-Петербург', quantity: 2, price: 640 },
    { accountId: 2, productId: 3, warehouseId: 3, region: 'СПб', city: 'Санкт-Петербург', quantity: 4, price: 2200 },
  ]

  rows.forEach((row) => {
    orders.push({
      id: orderId,
      accountId: row.accountId,
      productId: row.productId,
      marketplaceOrderId: `ord-${row.accountId}-${orderId}`,
      warehouseId: row.warehouseId,
      region: row.region,
      city: row.city,
      quantity: row.quantity,
      price: row.price,
      orderedAt: orderedAt.toISOString(),
      status: 'delivered',
    })

    salesDaily.push({
      id: salesId,
      productId: row.productId,
      warehouseId: row.warehouseId,
      region: row.region,
      date,
      quantitySold: row.quantity,
      revenue: row.quantity * row.price,
    })

    orderId += 1
    salesId += 1
  })
}

const notificationSettings = [
  {
    userId: 1,
    telegramEnabled: true,
    emailEnabled: false,
    stockoutAlertDays: 5,
  },
]

const latestForecastRunByAccount = new Map()
const latestRecommendationsByAccount = new Map()

const counters = {
  users: users.length,
  accounts: accounts.length,
  products: products.length,
  productRules: productRules.length,
  forecastSettings: forecastSettings.length,
  marketplaceAccounts: 1,
}

function nextId(name) {
  counters[name] = (counters[name] || 0) + 1
  return counters[name]
}

export const db = {
  users,
  accounts,
  products,
  warehouses,
  productStocks,
  orders,
  salesDaily,
  logisticsCosts,
  forecastSettings,
  productRules,
  notificationSettings,
  latestForecastRunByAccount,
  latestRecommendationsByAccount,
  nextId,
}
