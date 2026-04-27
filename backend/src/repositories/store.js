import { isPgEnabled, query, withTransaction } from '../db/client.js'
import { db as mockDb } from '../db/mock-store.js'

function toNumber(value) {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

function toIso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toDateString(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function mapUser(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    email: row.email,
    passwordHash: row.password_hash ?? row.passwordHash,
    name: row.name,
    createdAt: toIso(row.created_at ?? row.createdAt),
  }
}

function mapAccount(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    userId: toNumber(row.user_id ?? row.userId),
    name: row.name,
    marketplaceType: row.marketplace_type ?? row.marketplaceType,
    apiKeyEncrypted: row.api_key_encrypted ?? row.apiKeyEncrypted,
    clientIdEncrypted: row.client_id_encrypted ?? row.clientIdEncrypted,
    isActive: row.is_active ?? row.isActive,
    createdAt: toIso(row.created_at ?? row.createdAt),
  }
}

function mapProduct(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    accountId: toNumber(row.account_id ?? row.accountId),
    marketplaceProductId: row.marketplace_product_id ?? row.marketplaceProductId,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    brand: row.brand,
    imageUrl: row.image_url ?? row.imageUrl,
    isActive: row.is_active ?? row.isActive,
    createdAt: toIso(row.created_at ?? row.createdAt),
  }
}

function mapWarehouse(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    marketplaceType: row.marketplace_type ?? row.marketplaceType,
    marketplaceWarehouseId: row.marketplace_warehouse_id ?? row.marketplaceWarehouseId,
    name: row.name,
    region: row.region,
    city: row.city,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    logisticsCoefficient: toNumber(row.logistics_coefficient ?? row.logisticsCoefficient),
    storageCoefficient: toNumber(row.storage_coefficient ?? row.storageCoefficient),
    isActive: row.is_active ?? row.isActive,
  }
}

function mapProductStock(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    productId: toNumber(row.product_id ?? row.productId),
    warehouseId: toNumber(row.warehouse_id ?? row.warehouseId),
    quantity: toNumber(row.quantity),
    reservedQuantity: toNumber(row.reserved_quantity ?? row.reservedQuantity),
    availableQuantity: toNumber(row.available_quantity ?? row.availableQuantity),
    updatedAt: toIso(row.updated_at ?? row.updatedAt),
  }
}

function mapSalesDaily(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    productId: toNumber(row.product_id ?? row.productId),
    warehouseId: toNumber(row.warehouse_id ?? row.warehouseId),
    region: row.region,
    date: toDateString(row.date),
    quantitySold: toNumber(row.quantity_sold ?? row.quantitySold),
    revenue: toNumber(row.revenue),
  }
}

function mapForecastSettings(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    accountId: toNumber(row.account_id ?? row.accountId),
    forecastDays: toNumber(row.forecast_days ?? row.forecastDays),
    safetyStockDays: toNumber(row.safety_stock_days ?? row.safetyStockDays),
    minStockUnits: toNumber(row.min_stock_units ?? row.minStockUnits),
    targetTurnoverDays: toNumber(row.target_turnover_days ?? row.targetTurnoverDays),
    strategy: row.strategy,
  }
}

function mapProductRule(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    productId: toNumber(row.product_id ?? row.productId),
    alwaysKeepStock: row.always_keep_stock ?? row.alwaysKeepStock,
    minStockUnits: toNumber(row.min_stock_units ?? row.minStockUnits),
    maxStockUnits: toNumber(row.max_stock_units ?? row.maxStockUnits),
    preferredWarehouseId: toNumber(row.preferred_warehouse_id ?? row.preferredWarehouseId),
    excludedWarehouseIds: (row.excluded_warehouse_ids ?? row.excludedWarehouseIds ?? []).map((item) => Number(item)),
  }
}

function mapRecommendation(row) {
  if (!row) return null
  return {
    id: toNumber(row.id),
    accountId: toNumber(row.account_id ?? row.accountId),
    productId: toNumber(row.product_id ?? row.productId),
    warehouseId: toNumber(row.warehouse_id ?? row.warehouseId),
    sku: row.sku,
    name: row.name,
    warehouse: row.warehouse,
    currentStock: toNumber(row.current_stock ?? row.currentStock),
    avgDailySales: toNumber(row.avg_daily_sales ?? row.avgDailySales),
    forecastSales: toNumber(row.forecast_sales ?? row.forecastSales),
    daysUntilStockout: toNumber(row.days_until_stockout ?? row.daysUntilStockout),
    recommendedQuantity: toNumber(row.recommended_quantity ?? row.recommendedQuantity),
    priority: row.priority,
    reason: row.reason,
    createdAt: toIso(row.created_at ?? row.createdAt),
  }
}

function mapNotificationSettings(row, userId = null) {
  if (!row) {
    return {
      userId,
      telegramEnabled: false,
      emailEnabled: false,
      stockoutAlertDays: 5,
    }
  }

  return {
    userId: toNumber(row.user_id ?? row.userId),
    telegramEnabled: row.telegram_enabled ?? row.telegramEnabled,
    emailEnabled: row.email_enabled ?? row.emailEnabled,
    stockoutAlertDays: toNumber(row.stockout_alert_days ?? row.stockoutAlertDays),
  }
}

function clampMarketplaceType(value) {
  if (value === 'wb' || value === 'ozon' || value === 'yandex') return value
  return 'wb'
}

const fallbackState = {
  latestForecastRunByAccount: mockDb.latestForecastRunByAccount,
  latestRecommendationsByAccount: mockDb.latestRecommendationsByAccount,
}

export function getStorageMode() {
  return isPgEnabled ? 'postgres' : 'mock'
}

export async function getDefaultAccountIdForUser(userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT id FROM accounts WHERE user_id = $1 ORDER BY id ASC LIMIT 1`,
      [userId],
    )
    return result.rows[0] ? Number(result.rows[0].id) : null
  }

  const item = mockDb.accounts
    .filter((account) => account.userId === userId)
    .sort((a, b) => a.id - b.id)[0]
  return item?.id ?? null
}

// Auth
export async function findUserByEmail(email) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT id, email, password_hash, name, created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email],
    )
    return mapUser(result.rows[0])
  }

  return mapUser(mockDb.users.find((user) => user.email === email))
}

export async function findUserById(id) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT id, email, password_hash, name, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    )
    return mapUser(result.rows[0])
  }

  return mapUser(mockDb.users.find((user) => user.id === id))
}

export async function createUser({ email, passwordHash, name }) {
  if (isPgEnabled) {
    const result = await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash, name, created_at`,
      [email, passwordHash, name],
    )
    return mapUser(result.rows[0])
  }

  const id = mockDb.nextId('users')
  const user = {
    id,
    email,
    passwordHash,
    name,
    createdAt: new Date().toISOString(),
  }
  mockDb.users.push(user)
  return mapUser(user)
}

// Accounts
export async function listAccountsByUser(userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT id, user_id, name, marketplace_type, api_key_encrypted, client_id_encrypted, is_active, created_at
       FROM accounts
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId],
    )
    return result.rows.map(mapAccount)
  }

  return mockDb.accounts.filter((account) => account.userId === userId).map(mapAccount)
}

export async function findAccountByIdForUser(accountId, userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT id, user_id, name, marketplace_type, api_key_encrypted, client_id_encrypted, is_active, created_at
       FROM accounts
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [accountId, userId],
    )
    return mapAccount(result.rows[0])
  }

  return mapAccount(
    mockDb.accounts.find((account) => account.id === accountId && account.userId === userId),
  )
}

export async function createAccountForUser(userId, { name, marketplaceType, apiKey, clientId }) {
  if (isPgEnabled) {
    const result = await query(
      `INSERT INTO accounts (user_id, name, marketplace_type, api_key_encrypted, client_id_encrypted, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, user_id, name, marketplace_type, api_key_encrypted, client_id_encrypted, is_active, created_at`,
      [userId, name, clampMarketplaceType(marketplaceType), `enc_${apiKey}`, clientId ? `enc_${clientId}` : null],
    )
    return mapAccount(result.rows[0])
  }

  const id = mockDb.nextId('accounts')
  const account = {
    id,
    userId,
    name,
    marketplaceType: clampMarketplaceType(marketplaceType),
    apiKeyEncrypted: `enc_${apiKey}`,
    clientIdEncrypted: clientId ? `enc_${clientId}` : null,
    isActive: true,
    createdAt: new Date().toISOString(),
  }

  mockDb.accounts.push(account)
  return mapAccount(account)
}

export async function updateAccountForUser(accountId, userId, patch) {
  const existing = await findAccountByIdForUser(accountId, userId)
  if (!existing) return null

  const next = {
    name: patch.name ?? existing.name,
    isActive: patch.isActive !== undefined ? Boolean(patch.isActive) : existing.isActive,
    apiKeyEncrypted: patch.apiKey ? `enc_${patch.apiKey}` : existing.apiKeyEncrypted,
    clientIdEncrypted: patch.clientId ? `enc_${patch.clientId}` : existing.clientIdEncrypted,
  }

  if (isPgEnabled) {
    const result = await query(
      `UPDATE accounts
       SET name = $1,
           is_active = $2,
           api_key_encrypted = $3,
           client_id_encrypted = $4
       WHERE id = $5 AND user_id = $6
       RETURNING id, user_id, name, marketplace_type, api_key_encrypted, client_id_encrypted, is_active, created_at`,
      [next.name, next.isActive, next.apiKeyEncrypted, next.clientIdEncrypted, accountId, userId],
    )

    return mapAccount(result.rows[0])
  }

  const item = mockDb.accounts.find((account) => account.id === accountId && account.userId === userId)
  item.name = next.name
  item.isActive = next.isActive
  item.apiKeyEncrypted = next.apiKeyEncrypted
  item.clientIdEncrypted = next.clientIdEncrypted

  return mapAccount(item)
}

export async function deleteAccountForUser(accountId, userId) {
  if (isPgEnabled) {
    const result = await query(
      `DELETE FROM accounts
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [accountId, userId],
    )
    return Boolean(result.rows.length)
  }

  const index = mockDb.accounts.findIndex((account) => account.id === accountId && account.userId === userId)
  if (index === -1) return false
  mockDb.accounts.splice(index, 1)
  return true
}

// Products
async function userAccountIds(userId) {
  const accounts = await listAccountsByUser(userId)
  return accounts.map((account) => account.id)
}

export async function listProductsByUser(userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT p.id, p.account_id, p.marketplace_product_id, p.sku, p.barcode, p.name, p.category, p.brand, p.image_url, p.is_active, p.created_at
       FROM products p
       INNER JOIN accounts a ON a.id = p.account_id
       WHERE a.user_id = $1
       ORDER BY p.id ASC`,
      [userId],
    )
    return result.rows.map(mapProduct)
  }

  const accountIds = new Set(mockDb.accounts.filter((item) => item.userId === userId).map((item) => item.id))
  return mockDb.products.filter((item) => accountIds.has(item.accountId)).map(mapProduct)
}

export async function findProductByIdForUser(productId, userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT p.id, p.account_id, p.marketplace_product_id, p.sku, p.barcode, p.name, p.category, p.brand, p.image_url, p.is_active, p.created_at
       FROM products p
       INNER JOIN accounts a ON a.id = p.account_id
       WHERE p.id = $1 AND a.user_id = $2
       LIMIT 1`,
      [productId, userId],
    )

    return mapProduct(result.rows[0])
  }

  const accountIds = new Set(mockDb.accounts.filter((item) => item.userId === userId).map((item) => item.id))
  return mapProduct(mockDb.products.find((item) => item.id === productId && accountIds.has(item.accountId)))
}

export async function listProductRulesByProductIds(productIds) {
  if (!productIds.length) return []

  if (isPgEnabled) {
    const result = await query(
      `SELECT id, product_id, always_keep_stock, min_stock_units, max_stock_units, preferred_warehouse_id, excluded_warehouse_ids
       FROM product_rules
       WHERE product_id = ANY($1::bigint[])`,
      [productIds],
    )

    return result.rows.map(mapProductRule)
  }

  const ids = new Set(productIds)
  return mockDb.productRules.filter((item) => ids.has(item.productId)).map(mapProductRule)
}

export async function upsertProductRuleForUser(productId, userId, payload) {
  const product = await findProductByIdForUser(productId, userId)
  if (!product) return null

  const existing = (await listProductRulesByProductIds([productId]))[0] || {
    productId,
    alwaysKeepStock: false,
    minStockUnits: 0,
    maxStockUnits: null,
    preferredWarehouseId: null,
    excludedWarehouseIds: [],
  }

  const merged = {
    productId,
    alwaysKeepStock: payload.alwaysKeepStock !== undefined
      ? Boolean(payload.alwaysKeepStock)
      : existing.alwaysKeepStock,
    minStockUnits: payload.minStockUnits !== undefined
      ? Number(payload.minStockUnits)
      : existing.minStockUnits,
    maxStockUnits: payload.maxStockUnits !== undefined
      ? (payload.maxStockUnits === null ? null : Number(payload.maxStockUnits))
      : existing.maxStockUnits,
    preferredWarehouseId: payload.preferredWarehouseId !== undefined
      ? (payload.preferredWarehouseId === null ? null : Number(payload.preferredWarehouseId))
      : existing.preferredWarehouseId,
    excludedWarehouseIds: payload.excludedWarehouseIds !== undefined
      ? (Array.isArray(payload.excludedWarehouseIds) ? payload.excludedWarehouseIds.map((item) => Number(item)).filter((item) => !Number.isNaN(item)) : [])
      : existing.excludedWarehouseIds,
  }

  if (isPgEnabled) {
    const result = await query(
      `INSERT INTO product_rules (
         product_id,
         always_keep_stock,
         min_stock_units,
         max_stock_units,
         preferred_warehouse_id,
         excluded_warehouse_ids
       ) VALUES ($1, $2, $3, $4, $5, $6::bigint[])
       ON CONFLICT (product_id)
       DO UPDATE SET
         always_keep_stock = EXCLUDED.always_keep_stock,
         min_stock_units = EXCLUDED.min_stock_units,
         max_stock_units = EXCLUDED.max_stock_units,
         preferred_warehouse_id = EXCLUDED.preferred_warehouse_id,
         excluded_warehouse_ids = EXCLUDED.excluded_warehouse_ids
       RETURNING id, product_id, always_keep_stock, min_stock_units, max_stock_units, preferred_warehouse_id, excluded_warehouse_ids`,
      [
        merged.productId,
        merged.alwaysKeepStock,
        merged.minStockUnits,
        merged.maxStockUnits,
        merged.preferredWarehouseId,
        merged.excludedWarehouseIds,
      ],
    )

    return mapProductRule(result.rows[0])
  }

  let rule = mockDb.productRules.find((item) => item.productId === productId)
  if (!rule) {
    rule = {
      id: mockDb.nextId('productRules'),
      productId,
      alwaysKeepStock: false,
      minStockUnits: 0,
      maxStockUnits: null,
      preferredWarehouseId: null,
      excludedWarehouseIds: [],
    }
    mockDb.productRules.push(rule)
  }

  Object.assign(rule, merged)
  return mapProductRule(rule)
}

// Stocks + Sales helpers
export async function listWarehousesByIds(ids) {
  if (!ids.length) return []

  if (isPgEnabled) {
    const result = await query(
      `SELECT id, marketplace_type, marketplace_warehouse_id, name, region, city, latitude, longitude, logistics_coefficient, storage_coefficient, is_active
       FROM warehouses
       WHERE id = ANY($1::bigint[])`,
      [ids],
    )

    return result.rows.map(mapWarehouse)
  }

  const set = new Set(ids)
  return mockDb.warehouses.filter((item) => set.has(item.id)).map(mapWarehouse)
}

export async function listStocksByProductIds(productIds) {
  if (!productIds.length) return []

  if (isPgEnabled) {
    const result = await query(
      `SELECT id, product_id, warehouse_id, quantity, reserved_quantity, available_quantity, updated_at
       FROM product_stocks
       WHERE product_id = ANY($1::bigint[])
       ORDER BY id ASC`,
      [productIds],
    )

    return result.rows.map(mapProductStock)
  }

  const set = new Set(productIds)
  return mockDb.productStocks.filter((item) => set.has(item.productId)).map(mapProductStock)
}

export async function listStocksByUser(userId) {
  const products = await listProductsByUser(userId)
  const productIds = products.map((product) => product.id)
  return listStocksByProductIds(productIds)
}

export async function listSalesDailyByProductIds(productIds, { days = null } = {}) {
  if (!productIds.length) return []

  if (isPgEnabled) {
    const params = [productIds]
    const where = ['product_id = ANY($1::bigint[])']

    if (days) {
      params.push(Number(days))
      where.push(`date >= CURRENT_DATE - (($${params.length}::int) - 1) * INTERVAL '1 day'`)
    }

    const result = await query(
      `SELECT id, product_id, warehouse_id, region, date, quantity_sold, revenue
       FROM sales_daily
       WHERE ${where.join(' AND ')}
       ORDER BY date DESC, id DESC`,
      params,
    )

    return result.rows.map(mapSalesDaily)
  }

  const cutoffDate = days
    ? (() => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - Number(days))
        return d.toISOString().slice(0, 10)
      })()
    : null

  const set = new Set(productIds)
  return mockDb.salesDaily
    .filter((item) => set.has(item.productId) && (!cutoffDate || item.date >= cutoffDate))
    .map(mapSalesDaily)
}

export async function listSalesDailyByUser(userId) {
  const products = await listProductsByUser(userId)
  return listSalesDailyByProductIds(products.map((product) => product.id))
}

export async function listSalesByProductForUser(userId, productId) {
  const product = await findProductByIdForUser(productId, userId)
  if (!product) return null
  return listSalesDailyByProductIds([productId])
}

export async function listSalesByRegionForUser(userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT sd.region AS region,
              SUM(sd.quantity_sold)::bigint AS quantity_sold,
              SUM(sd.revenue)::numeric AS revenue
       FROM sales_daily sd
       INNER JOIN products p ON p.id = sd.product_id
       INNER JOIN accounts a ON a.id = p.account_id
       WHERE a.user_id = $1
       GROUP BY sd.region
       ORDER BY SUM(sd.quantity_sold) DESC`,
      [userId],
    )

    return result.rows.map((row) => ({
      region: row.region || 'unknown',
      quantitySold: toNumber(row.quantity_sold) || 0,
      revenue: toNumber(row.revenue) || 0,
    }))
  }

  const productIds = new Set(
    mockDb.products
      .filter((product) => mockDb.accounts.some((account) => account.id === product.accountId && account.userId === userId))
      .map((product) => product.id),
  )

  const totals = new Map()
  mockDb.salesDaily.forEach((item) => {
    if (!productIds.has(item.productId)) return
    const key = item.region || 'unknown'
    const current = totals.get(key) || { region: key, quantitySold: 0, revenue: 0 }
    current.quantitySold += item.quantitySold
    current.revenue += item.revenue
    totals.set(key, current)
  })

  return Array.from(totals.values()).sort((a, b) => b.quantitySold - a.quantitySold)
}

export async function listSalesByWarehouseForUser(userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT COALESCE(w.name, 'unknown') AS warehouse,
              SUM(sd.quantity_sold)::bigint AS quantity_sold,
              SUM(sd.revenue)::numeric AS revenue
       FROM sales_daily sd
       INNER JOIN products p ON p.id = sd.product_id
       INNER JOIN accounts a ON a.id = p.account_id
       LEFT JOIN warehouses w ON w.id = sd.warehouse_id
       WHERE a.user_id = $1
       GROUP BY COALESCE(w.name, 'unknown')
       ORDER BY SUM(sd.quantity_sold) DESC`,
      [userId],
    )

    return result.rows.map((row) => ({
      warehouse: row.warehouse,
      quantitySold: toNumber(row.quantity_sold) || 0,
      revenue: toNumber(row.revenue) || 0,
    }))
  }

  const productIds = new Set(
    mockDb.products
      .filter((product) => mockDb.accounts.some((account) => account.id === product.accountId && account.userId === userId))
      .map((product) => product.id),
  )

  const totals = new Map()
  mockDb.salesDaily.forEach((item) => {
    if (!productIds.has(item.productId)) return
    const wh = mockDb.warehouses.find((warehouse) => warehouse.id === item.warehouseId)
    const key = wh?.name || 'unknown'
    const current = totals.get(key) || { warehouse: key, quantitySold: 0, revenue: 0 }
    current.quantitySold += item.quantitySold
    current.revenue += item.revenue
    totals.set(key, current)
  })

  return Array.from(totals.values()).sort((a, b) => b.quantitySold - a.quantitySold)
}

// Forecast settings + recommendation snapshots
export async function getForecastSettingsByAccount(accountId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT id, account_id, forecast_days, safety_stock_days, min_stock_units, target_turnover_days, strategy
       FROM forecast_settings
       WHERE account_id = $1
       LIMIT 1`,
      [accountId],
    )

    return mapForecastSettings(result.rows[0])
  }

  return mapForecastSettings(mockDb.forecastSettings.find((item) => item.accountId === accountId))
}

export async function upsertForecastSettingsByAccountForUser(accountId, userId, patch = {}) {
  const account = await findAccountByIdForUser(accountId, userId)
  if (!account) return null

  const current = (await getForecastSettingsByAccount(accountId)) || {
    accountId,
    forecastDays: 28,
    safetyStockDays: 5,
    minStockUnits: 0,
    targetTurnoverDays: 28,
    strategy: 'balanced',
  }

  const normalizedStrategy = ['speed', 'margin', 'balanced'].includes(patch.strategy)
    ? patch.strategy
    : current.strategy

  const next = {
    accountId,
    forecastDays: patch.forecastDays !== undefined ? Number(patch.forecastDays) : current.forecastDays,
    safetyStockDays: patch.safetyStockDays !== undefined
      ? Number(patch.safetyStockDays)
      : current.safetyStockDays,
    minStockUnits: patch.minStockUnits !== undefined ? Number(patch.minStockUnits) : current.minStockUnits,
    targetTurnoverDays: patch.targetTurnoverDays !== undefined
      ? Number(patch.targetTurnoverDays)
      : current.targetTurnoverDays,
    strategy: normalizedStrategy,
  }

  if (isPgEnabled) {
    const result = await query(
      `INSERT INTO forecast_settings (
         account_id,
         forecast_days,
         safety_stock_days,
         min_stock_units,
         target_turnover_days,
         strategy
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (account_id)
       DO UPDATE SET
         forecast_days = EXCLUDED.forecast_days,
         safety_stock_days = EXCLUDED.safety_stock_days,
         min_stock_units = EXCLUDED.min_stock_units,
         target_turnover_days = EXCLUDED.target_turnover_days,
         strategy = EXCLUDED.strategy
       RETURNING id, account_id, forecast_days, safety_stock_days, min_stock_units, target_turnover_days, strategy`,
      [
        next.accountId,
        next.forecastDays,
        next.safetyStockDays,
        next.minStockUnits,
        next.targetTurnoverDays,
        next.strategy,
      ],
    )

    return mapForecastSettings(result.rows[0])
  }

  let item = mockDb.forecastSettings.find((settings) => settings.accountId === accountId)
  if (!item) {
    item = {
      id: mockDb.nextId('forecastSettings'),
      accountId,
      forecastDays: 28,
      safetyStockDays: 5,
      minStockUnits: 0,
      targetTurnoverDays: 28,
      strategy: 'balanced',
    }
    mockDb.forecastSettings.push(item)
  }

  item.forecastDays = next.forecastDays
  item.safetyStockDays = next.safetyStockDays
  item.minStockUnits = next.minStockUnits
  item.targetTurnoverDays = next.targetTurnoverDays
  item.strategy = next.strategy

  return mapForecastSettings(item)
}

export async function getAccountDatasetForRecommendations(accountId, userId) {
  const account = await findAccountByIdForUser(accountId, userId)
  if (!account) return null

  if (isPgEnabled) {
    const productsResult = await query(
      `SELECT id, account_id, marketplace_product_id, sku, barcode, name, category, brand, image_url, is_active, created_at
       FROM products
       WHERE account_id = $1`,
      [accountId],
    )
    const products = productsResult.rows.map(mapProduct)
    const productIds = products.map((item) => item.id)

    const stocks = await listStocksByProductIds(productIds)
    const salesDaily = await listSalesDailyByProductIds(productIds)
    const productRules = await listProductRulesByProductIds(productIds)

    const warehouseIds = [...new Set(stocks.map((stock) => stock.warehouseId).filter(Boolean))]
    const warehouses = await listWarehousesByIds(warehouseIds)
    const forecastSetting = await getForecastSettingsByAccount(accountId)

    return {
      users: [],
      accounts: [account],
      products,
      warehouses,
      productStocks: stocks,
      orders: [],
      salesDaily,
      logisticsCosts: [],
      forecastSettings: forecastSetting ? [forecastSetting] : [],
      productRules,
      notificationSettings: [],
      latestForecastRunByAccount: fallbackState.latestForecastRunByAccount,
      latestRecommendationsByAccount: fallbackState.latestRecommendationsByAccount,
    }
  }

  const products = mockDb.products.filter((item) => item.accountId === accountId).map(mapProduct)
  const productIds = new Set(products.map((item) => item.id))

  const stocks = mockDb.productStocks.filter((item) => productIds.has(item.productId)).map(mapProductStock)
  const salesDaily = mockDb.salesDaily.filter((item) => productIds.has(item.productId)).map(mapSalesDaily)
  const productRules = mockDb.productRules.filter((item) => productIds.has(item.productId)).map(mapProductRule)
  const warehouseIds = new Set(stocks.map((stock) => stock.warehouseId))
  const warehouses = mockDb.warehouses.filter((item) => warehouseIds.has(item.id)).map(mapWarehouse)
  const forecastSetting = mockDb.forecastSettings.find((item) => item.accountId === accountId)

  return {
    users: [],
    accounts: [account],
    products,
    warehouses,
    productStocks: stocks,
    orders: [],
    salesDaily,
    logisticsCosts: [],
    forecastSettings: forecastSetting ? [mapForecastSettings(forecastSetting)] : [],
    productRules,
    notificationSettings: [],
    latestForecastRunByAccount: fallbackState.latestForecastRunByAccount,
    latestRecommendationsByAccount: fallbackState.latestRecommendationsByAccount,
  }
}

export async function saveRecommendationsSnapshot(accountId, recommendations, generatedAt) {
  const createdAt = generatedAt || new Date().toISOString()

  fallbackState.latestRecommendationsByAccount.set(accountId, recommendations)
  fallbackState.latestForecastRunByAccount.set(accountId, {
    accountId,
    generatedAt: createdAt,
    recommendationsCount: recommendations.length,
  })

  if (isPgEnabled) {
    await withTransaction(async (client) => {
      for (const item of recommendations) {
        await client.query(
          `INSERT INTO supply_recommendations (
             account_id,
             product_id,
             warehouse_id,
             current_stock,
             avg_daily_sales,
             forecast_sales,
             days_until_stockout,
             recommended_quantity,
             priority,
             reason,
             created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            accountId,
            item.productId,
            item.warehouseId,
            item.currentStock,
            item.avgDailySales,
            item.forecastSales,
            item.daysUntilStockout,
            item.recommendedQuantity,
            item.priority,
            item.reason,
            createdAt,
          ],
        )
      }
    })
  }

  return createdAt
}

export async function getLatestRecommendationsByAccount(accountId) {
  if (isPgEnabled) {
    const result = await query(
      `WITH latest_run AS (
         SELECT MAX(created_at) AS ts
         FROM supply_recommendations
         WHERE account_id = $1
       )
       SELECT sr.id,
              sr.account_id,
              sr.product_id,
              sr.warehouse_id,
              sr.current_stock,
              sr.avg_daily_sales,
              sr.forecast_sales,
              sr.days_until_stockout,
              sr.recommended_quantity,
              sr.priority,
              sr.reason,
              sr.created_at,
              p.sku,
              p.name,
              COALESCE(w.name, 'unknown') AS warehouse
       FROM supply_recommendations sr
       INNER JOIN products p ON p.id = sr.product_id
       LEFT JOIN warehouses w ON w.id = sr.warehouse_id
       WHERE sr.account_id = $1
         AND sr.created_at = (SELECT ts FROM latest_run)
       ORDER BY
         CASE sr.priority
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           ELSE 3
         END,
         sr.id ASC`,
      [accountId],
    )

    return result.rows.map(mapRecommendation)
  }

  return fallbackState.latestRecommendationsByAccount.get(accountId) || []
}

export async function getLatestForecastRunByAccount(accountId) {
  if (isPgEnabled) {
    const result = await query(
      `WITH latest_run AS (
         SELECT MAX(created_at) AS ts
         FROM supply_recommendations
         WHERE account_id = $1
       )
       SELECT (SELECT ts FROM latest_run) AS generated_at,
              COUNT(*)::bigint AS recommendations_count
       FROM supply_recommendations
       WHERE account_id = $1
         AND created_at = (SELECT ts FROM latest_run)`,
      [accountId],
    )

    const row = result.rows[0]
    if (!row?.generated_at) return null

    const settings = await getForecastSettingsByAccount(accountId)

    return {
      accountId,
      forecastDays: settings?.forecastDays || 28,
      generatedAt: toIso(row.generated_at),
      recommendationsCount: toNumber(row.recommendations_count) || 0,
    }
  }

  const snapshot = fallbackState.latestForecastRunByAccount.get(accountId)
  if (!snapshot) return null

  return {
    accountId,
    forecastDays: snapshot.forecastDays || 28,
    generatedAt: snapshot.generatedAt,
    recommendationsCount: snapshot.recommendationsCount || 0,
  }
}

// Notifications
export async function getNotificationSettingsByUser(userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT user_id, telegram_enabled, email_enabled, stockout_alert_days
       FROM notification_settings
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    )

    return mapNotificationSettings(result.rows[0], userId)
  }

  const item = mockDb.notificationSettings.find((settings) => settings.userId === userId)
  return mapNotificationSettings(item, userId)
}

export async function upsertNotificationSettingsByUser(userId, patch) {
  const existing = await getNotificationSettingsByUser(userId)

  const next = {
    userId,
    telegramEnabled: patch.telegramEnabled !== undefined
      ? Boolean(patch.telegramEnabled)
      : existing.telegramEnabled,
    emailEnabled: patch.emailEnabled !== undefined ? Boolean(patch.emailEnabled) : existing.emailEnabled,
    stockoutAlertDays: patch.stockoutAlertDays !== undefined
      ? Number(patch.stockoutAlertDays)
      : existing.stockoutAlertDays,
  }

  if (isPgEnabled) {
    const result = await query(
      `INSERT INTO notification_settings (user_id, telegram_enabled, email_enabled, stockout_alert_days)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         telegram_enabled = EXCLUDED.telegram_enabled,
         email_enabled = EXCLUDED.email_enabled,
         stockout_alert_days = EXCLUDED.stockout_alert_days,
         updated_at = NOW()
       RETURNING user_id, telegram_enabled, email_enabled, stockout_alert_days`,
      [userId, next.telegramEnabled, next.emailEnabled, next.stockoutAlertDays],
    )

    return mapNotificationSettings(result.rows[0], userId)
  }

  let settings = mockDb.notificationSettings.find((item) => item.userId === userId)
  if (!settings) {
    settings = {
      userId,
      telegramEnabled: false,
      emailEnabled: false,
      stockoutAlertDays: 5,
    }
    mockDb.notificationSettings.push(settings)
  }

  settings.telegramEnabled = next.telegramEnabled
  settings.emailEnabled = next.emailEnabled
  settings.stockoutAlertDays = next.stockoutAlertDays

  return mapNotificationSettings(settings, userId)
}

export async function persistLatestForecastRunSnapshot(accountId, snapshot) {
  fallbackState.latestForecastRunByAccount.set(accountId, snapshot)
}
