import { isPgEnabled, query, withTransaction } from '../db/client.js'
import { db as mockDb } from '../db/mock-store.js'

function clampMarketplace(mp) {
  if (mp === 'wb' || mp === 'ozon' || mp === 'yandex') return mp
  return 'wb'
}

async function ensureWarehousePg(marketplaceType, extId, row = {}) {
  const ext = String(extId ?? 'unknown')
  const found = await query(
    `SELECT id FROM warehouses WHERE marketplace_type = $1 AND marketplace_warehouse_id = $2 LIMIT 1`,
    [marketplaceType, ext],
  )
  if (found.rows[0]) return Number(found.rows[0].id)

  const ins = await query(
    `INSERT INTO warehouses (marketplace_type, marketplace_warehouse_id, name, region, city, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING id`,
    [
      marketplaceType,
      ext,
      row.name || row.warehouseName || ext,
      row.region || null,
      row.city || null,
    ],
  )
  return Number(ins.rows[0].id)
}

function buildProductKeyMap(rows) {
  const m = new Map()
  for (const r of rows) {
    m.set(String(r.marketplace_product_id), Number(r.id))
    m.set(String(r.sku), Number(r.id))
  }
  return m
}

async function loadProductMap(accountId) {
  const pr = await query(
    `SELECT id, marketplace_product_id, sku FROM products WHERE account_id = $1`,
    [accountId],
  )
  return buildProductKeyMap(pr.rows)
}

function resolveProductId(productByKey, o) {
  let pid = productByKey.get(String(o.productExternalId))
  if (pid) return pid
  const fp = o.raw?.products?.[0]
  if (fp) {
    pid = productByKey.get(String(fp.offer_id ?? fp.product_id ?? ''))
  }
  return pid || null
}

async function replaceProductsPg(accountId, products) {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM supply_recommendations WHERE account_id = $1`, [accountId])
    await client.query(`DELETE FROM orders WHERE account_id = $1`, [accountId])
    await client.query(
      `DELETE FROM sales_daily WHERE product_id IN (SELECT id FROM products WHERE account_id = $1)`,
      [accountId],
    )
    await client.query(
      `DELETE FROM product_stocks WHERE product_id IN (SELECT id FROM products WHERE account_id = $1)`,
      [accountId],
    )
    await client.query(`DELETE FROM product_rules WHERE product_id IN (SELECT id FROM products WHERE account_id = $1)`, [
      accountId,
    ])
    await client.query(`DELETE FROM products WHERE account_id = $1`, [accountId])

    for (const p of products) {
      const sku = String(p.offerId || p.externalSku || p.externalProductId || 'unknown').slice(0, 512)
      await client.query(
        `INSERT INTO products (account_id, marketplace_product_id, sku, barcode, name, category, brand, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
        [
          accountId,
          String(p.externalProductId),
          sku,
          p.barcode || null,
          String(p.name || sku).slice(0, 512),
          p.category || null,
          p.brand || null,
        ],
      )
    }
  })
}

async function syncWarehousesPg(marketplaceType, rows) {
  for (const w of rows) {
    const ext = String(w.externalWarehouseId ?? w.id ?? 'unknown')
    await ensureWarehousePg(marketplaceType, ext, {
      name: w.name,
      region: w.region,
      city: w.city,
    })
  }
}

async function replaceStocksPg(accountId, marketplaceType, stocks) {
  const productByKey = await loadProductMap(accountId)
  await query(
    `DELETE FROM product_stocks WHERE product_id IN (SELECT id FROM products WHERE account_id = $1)`,
    [accountId],
  )

  for (const s of stocks) {
    const pid =
      productByKey.get(String(s.productExternalId)) ||
      (s.raw ? productByKey.get(String(s.raw.offer_id ?? s.raw.nmId ?? '')) : null)
    if (!pid) continue
    const wid = await ensureWarehousePg(marketplaceType, s.warehouseExternalId, s)
    await query(
      `INSERT INTO product_stocks (product_id, warehouse_id, quantity, reserved_quantity, available_quantity, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [pid, wid, s.quantity ?? 0, s.reservedQuantity ?? 0, s.availableQuantity ?? Math.max(0, (s.quantity ?? 0) - (s.reservedQuantity ?? 0))],
    )
  }
}

async function replaceOrdersPg(accountId, marketplaceType, orders) {
  const productByKey = await loadProductMap(accountId)
  await query(`DELETE FROM orders WHERE account_id = $1`, [accountId])

  for (const o of orders) {
    const pid = resolveProductId(productByKey, o)
    if (!pid) continue
    let wid = null
    if (o.warehouseExternalId) {
      wid = await ensureWarehousePg(marketplaceType, o.warehouseExternalId, o)
    }
    const orderedAt = o.orderedAt instanceof Date ? o.orderedAt : new Date(o.orderedAt || Date.now())
    await query(
      `INSERT INTO orders (account_id, product_id, marketplace_order_id, warehouse_id, region, city, quantity, price, ordered_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        accountId,
        pid,
        String(o.externalOrderId).slice(0, 255),
        wid,
        o.region || null,
        o.city || null,
        o.quantity ?? 0,
        o.price ?? 0,
        orderedAt.toISOString(),
        String(o.status || 'unknown').slice(0, 64),
      ],
    )
  }
}

async function rebuildSalesDailyFromOrdersPg(accountId) {
  await query(
    `DELETE FROM sales_daily WHERE product_id IN (SELECT id FROM products WHERE account_id = $1)`,
    [accountId],
  )
  await query(
    `INSERT INTO sales_daily (product_id, warehouse_id, region, date, quantity_sold, revenue)
     SELECT o.product_id,
            o.warehouse_id,
            o.region,
            (o.ordered_at AT TIME ZONE 'UTC')::date,
            SUM(o.quantity)::int,
            COALESCE(SUM(o.price * o.quantity), 0)::numeric
     FROM orders o
     WHERE o.account_id = $1
     GROUP BY o.product_id, o.warehouse_id, o.region, (o.ordered_at AT TIME ZONE 'UTC')::date`,
    [accountId],
  )
}

async function replaceSalesDailyFromRowsPg(accountId, marketplaceType, rows) {
  const productByKey = await loadProductMap(accountId)
  await query(
    `DELETE FROM sales_daily WHERE product_id IN (SELECT id FROM products WHERE account_id = $1)`,
    [accountId],
  )

  const buckets = new Map()
  for (const o of rows) {
    const pid = resolveProductId(productByKey, o)
    if (!pid) continue
    const orderedAt = o.orderedAt instanceof Date ? o.orderedAt : new Date(o.orderedAt || Date.now())
    const date = orderedAt.toISOString().slice(0, 10)
    let wid = null
    if (o.warehouseExternalId) {
      wid = await ensureWarehousePg(marketplaceType, o.warehouseExternalId, o)
    }
    const key = `${pid}|${wid ?? 'null'}|${o.region || ''}|${date}`
    const cur = buckets.get(key) || { pid, wid, region: o.region || null, date, qty: 0, rev: 0 }
    cur.qty += Number(o.quantity) || 0
    cur.rev += (Number(o.price) || 0) * (Number(o.quantity) || 0)
    buckets.set(key, cur)
  }

  for (const cur of buckets.values()) {
    await query(
      `INSERT INTO sales_daily (product_id, warehouse_id, region, date, quantity_sold, revenue)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cur.pid, cur.wid, cur.region, cur.date, cur.qty, cur.rev],
    )
  }
}

function ensureMockWarehouse(marketplaceType, extId, row) {
  const ext = String(extId ?? 'unknown')
  let w = mockDb.warehouses.find(
    (item) => item.marketplaceType === marketplaceType && item.marketplaceWarehouseId === ext,
  )
  if (w) return w.id
  const id = mockDb.nextId('warehouses')
  w = {
    id,
    marketplaceType,
    marketplaceWarehouseId: ext,
    name: row.name || row.warehouseName || ext,
    region: row.region || '',
    city: row.city || '',
    latitude: null,
    longitude: null,
    logisticsCoefficient: 1,
    storageCoefficient: 1,
    isActive: true,
  }
  mockDb.warehouses.push(w)
  return id
}

function mockProductMap(accountId) {
  const m = new Map()
  for (const p of mockDb.products.filter((x) => x.accountId === accountId)) {
    m.set(String(p.marketplaceProductId), p.id)
    m.set(String(p.sku), p.id)
  }
  return m
}

function replaceProductsMock(accountId, products) {
  mockDb.products = mockDb.products.filter((p) => p.accountId !== accountId)
  for (const p of products) {
    const sku = String(p.offerId || p.externalSku || p.externalProductId || 'unknown')
    mockDb.products.push({
      id: mockDb.nextId('products'),
      accountId,
      marketplaceProductId: String(p.externalProductId),
      sku,
      barcode: p.barcode || '',
      name: String(p.name || sku),
      category: p.category || '',
      brand: p.brand || '',
      imageUrl: '',
      isActive: true,
      createdAt: new Date().toISOString(),
    })
  }
}

function replaceStocksMock(accountId, marketplaceType, stocks) {
  const productByKey = mockProductMap(accountId)
  const pids = new Set(mockDb.products.filter((p) => p.accountId === accountId).map((p) => p.id))
  mockDb.productStocks = mockDb.productStocks.filter((s) => !pids.has(s.productId))

  for (const s of stocks) {
    const pid =
      productByKey.get(String(s.productExternalId)) ||
      (s.raw ? productByKey.get(String(s.raw.offer_id ?? s.raw.nmId ?? '')) : null)
    if (!pid) continue
    const wid = ensureMockWarehouse(marketplaceType, s.warehouseExternalId, s)
    mockDb.productStocks.push({
      id: mockDb.nextId('productStocks'),
      productId: pid,
      warehouseId: wid,
      quantity: s.quantity ?? 0,
      reservedQuantity: s.reservedQuantity ?? 0,
      availableQuantity: s.availableQuantity ?? Math.max(0, (s.quantity ?? 0) - (s.reservedQuantity ?? 0)),
      updatedAt: new Date().toISOString(),
    })
  }
}

function replaceOrdersMock(accountId, marketplaceType, orders) {
  const productByKey = mockProductMap(accountId)
  mockDb.orders = mockDb.orders.filter((o) => o.accountId !== accountId)

  for (const o of orders) {
    const pid = resolveProductId(productByKey, o)
    if (!pid) continue
    let wid = null
    if (o.warehouseExternalId) {
      wid = ensureMockWarehouse(marketplaceType, o.warehouseExternalId, o)
    }
    mockDb.orders.push({
      id: mockDb.nextId('orders'),
      accountId,
      productId: pid,
      marketplaceOrderId: String(o.externalOrderId),
      warehouseId: wid,
      region: o.region,
      city: o.city,
      quantity: o.quantity ?? 0,
      price: o.price ?? 0,
      orderedAt: (o.orderedAt instanceof Date ? o.orderedAt : new Date(o.orderedAt || Date.now())).toISOString(),
      status: o.status || 'unknown',
    })
  }
}

function replaceSalesDailyMockFromRows(accountId, marketplaceType, rows) {
  const productByKey = mockProductMap(accountId)
  mockDb.salesDaily = mockDb.salesDaily.filter((s) => {
    const p = mockDb.products.find((x) => x.id === s.productId)
    return p?.accountId !== accountId
  })
  const buckets = new Map()
  for (const o of rows) {
    const pid = resolveProductId(productByKey, o)
    if (!pid) continue
    const orderedAt = o.orderedAt instanceof Date ? o.orderedAt : new Date(o.orderedAt || Date.now())
    const date = orderedAt.toISOString().slice(0, 10)
    let wid = null
    if (o.warehouseExternalId) {
      wid = ensureMockWarehouse(marketplaceType, o.warehouseExternalId, o)
    }
    const key = `${pid}|${wid ?? 'null'}|${o.region || ''}|${date}`
    const cur = buckets.get(key) || { pid, wid, region: o.region || null, date, qty: 0, rev: 0 }
    cur.qty += Number(o.quantity) || 0
    cur.rev += (Number(o.price) || 0) * (Number(o.quantity) || 0)
    buckets.set(key, cur)
  }
  for (const cur of buckets.values()) {
    mockDb.salesDaily.push({
      id: mockDb.nextId('salesDaily'),
      productId: cur.pid,
      warehouseId: cur.wid,
      region: cur.region,
      date: cur.date,
      quantitySold: cur.qty,
      revenue: cur.rev,
    })
  }
}

function rebuildSalesDailyMock(accountId) {
  mockDb.salesDaily = mockDb.salesDaily.filter((s) => {
    const p = mockDb.products.find((x) => x.id === s.productId)
    return p?.accountId !== accountId
  })
  const byKey = new Map()
  for (const o of mockDb.orders.filter((x) => x.accountId === accountId)) {
    const date = String(o.orderedAt).slice(0, 10)
    const key = `${o.productId}|${o.warehouseId ?? 'null'}|${o.region || ''}|${date}`
    const cur = byKey.get(key) || { productId: o.productId, warehouseId: o.warehouseId, region: o.region, date, qty: 0, rev: 0 }
    cur.qty += o.quantity
    cur.rev += o.price * o.quantity
    byKey.set(key, cur)
  }
  for (const cur of byKey.values()) {
    mockDb.salesDaily.push({
      id: mockDb.nextId('salesDaily'),
      productId: cur.productId,
      warehouseId: cur.warehouseId,
      region: cur.region,
      date: cur.date,
      quantitySold: cur.qty,
      revenue: cur.rev,
    })
  }
}

/**
 * Сохраняет сырые строки адаптера в таблицы кабинета (accounts / products / …).
 */
export async function persistSyncEntity({ sellerAccountId, marketplace, entity, rows }) {
  if (!sellerAccountId || !entity || !Array.isArray(rows)) return

  const mp = clampMarketplace(marketplace)

  if (isPgEnabled) {
    if (entity === 'products') await replaceProductsPg(sellerAccountId, rows)
    if (entity === 'warehouses') await syncWarehousesPg(mp, rows)
    if (entity === 'stocks') await replaceStocksPg(sellerAccountId, mp, rows)
    if (entity === 'orders') {
      await replaceOrdersPg(sellerAccountId, mp, rows)
      await rebuildSalesDailyFromOrdersPg(sellerAccountId)
    }
    if (entity === 'sales') await replaceSalesDailyFromRowsPg(sellerAccountId, mp, rows)
    return
  }

  if (entity === 'products') replaceProductsMock(sellerAccountId, rows)
  if (entity === 'warehouses') {
    for (const w of rows) {
      ensureMockWarehouse(mp, w.externalWarehouseId ?? w.id, w)
    }
  }
  if (entity === 'stocks') replaceStocksMock(sellerAccountId, mp, rows)
  if (entity === 'orders') {
    replaceOrdersMock(sellerAccountId, mp, rows)
    rebuildSalesDailyMock(sellerAccountId)
  }
  if (entity === 'sales') replaceSalesDailyMockFromRows(sellerAccountId, mp, rows)
}
