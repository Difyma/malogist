import { isPgEnabled, pool, withTransaction } from './client.js'
import { buildOrdersAndSalesDaily, notificationSettingsSeed, seedData } from './seed-data.js'

const TABLES_WITH_SERIAL_ID = [
  'users',
  'accounts',
  'products',
  'warehouses',
  'product_stocks',
  'orders',
  'sales_daily',
  'logistics_costs',
  'forecast_settings',
  'product_rules',
  'marketplace_accounts',
  'marketplace_products',
  'marketplace_warehouses',
  'marketplace_stocks',
  'marketplace_orders',
  'marketplace_sales_daily',
  'marketplace_tariffs',
]

async function setSerialSequences(client) {
  for (const table of TABLES_WITH_SERIAL_ID) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
    )
  }
}

export async function seedDb() {
  if (!isPgEnabled) {
    throw new Error('PostgreSQL is disabled. Set DATABASE_URL and ensure USE_MOCK_DB is false.')
  }

  const { orders, salesDaily } = buildOrdersAndSalesDaily()

  await withTransaction(async (client) => {
    await client.query(`
      TRUNCATE TABLE
        supply_recommendations,
        marketplace_tariffs,
        marketplace_sales_daily,
        marketplace_orders,
        marketplace_stocks,
        marketplace_products,
        marketplace_warehouses,
        marketplace_accounts,
        notification_settings,
        product_rules,
        forecast_settings,
        logistics_costs,
        sales_daily,
        orders,
        product_stocks,
        products,
        warehouses,
        accounts,
        users
      RESTART IDENTITY CASCADE
    `)

    for (const user of seedData.users) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.email, user.passwordHash, user.name, user.createdAt],
      )
    }

    for (const account of seedData.accounts) {
      await client.query(
        `INSERT INTO accounts (id, user_id, name, marketplace_type, api_key_encrypted, client_id_encrypted, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          account.id,
          account.userId,
          account.name,
          account.marketplaceType,
          account.apiKeyEncrypted,
          account.clientIdEncrypted,
          account.isActive,
          account.createdAt,
        ],
      )
    }

    for (const product of seedData.products) {
      await client.query(
        `INSERT INTO products (id, account_id, marketplace_product_id, sku, barcode, name, category, brand, image_url, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          product.id,
          product.accountId,
          product.marketplaceProductId,
          product.sku,
          product.barcode,
          product.name,
          product.category,
          product.brand,
          product.imageUrl,
          product.isActive,
          product.createdAt,
        ],
      )
    }

    for (const warehouse of seedData.warehouses) {
      await client.query(
        `INSERT INTO warehouses (
           id,
           marketplace_type,
           marketplace_warehouse_id,
           name,
           region,
           city,
           latitude,
           longitude,
           logistics_coefficient,
           storage_coefficient,
           is_active
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          warehouse.id,
          warehouse.marketplaceType,
          warehouse.marketplaceWarehouseId,
          warehouse.name,
          warehouse.region,
          warehouse.city,
          warehouse.latitude,
          warehouse.longitude,
          warehouse.logisticsCoefficient,
          warehouse.storageCoefficient,
          warehouse.isActive,
        ],
      )
    }

    for (const stock of seedData.productStocks) {
      await client.query(
        `INSERT INTO product_stocks (id, product_id, warehouse_id, quantity, reserved_quantity, available_quantity, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stock.id,
          stock.productId,
          stock.warehouseId,
          stock.quantity,
          stock.reservedQuantity,
          stock.availableQuantity,
          stock.updatedAt,
        ],
      )
    }

    for (const order of orders) {
      await client.query(
        `INSERT INTO orders (
           id,
           account_id,
           product_id,
           marketplace_order_id,
           warehouse_id,
           region,
           city,
           quantity,
           price,
           ordered_at,
           status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          order.id,
          order.accountId,
          order.productId,
          order.marketplaceOrderId,
          order.warehouseId,
          order.region,
          order.city,
          order.quantity,
          order.price,
          order.orderedAt,
          order.status,
        ],
      )
    }

    for (const row of salesDaily) {
      await client.query(
        `INSERT INTO sales_daily (id, product_id, warehouse_id, region, date, quantity_sold, revenue)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          row.id,
          row.productId,
          row.warehouseId,
          row.region,
          row.date,
          row.quantitySold,
          row.revenue,
        ],
      )
    }

    for (const row of seedData.logisticsCosts) {
      await client.query(
        `INSERT INTO logistics_costs (
           id,
           account_id,
           product_id,
           warehouse_id,
           date,
           delivery_cost,
           storage_cost,
           return_cost,
           total_cost
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          row.id,
          row.accountId,
          row.productId,
          row.warehouseId,
          row.date,
          row.deliveryCost,
          row.storageCost,
          row.returnCost,
          row.totalCost,
        ],
      )
    }

    for (const setting of seedData.forecastSettings) {
      await client.query(
        `INSERT INTO forecast_settings (
           id,
           account_id,
           forecast_days,
           safety_stock_days,
           min_stock_units,
           target_turnover_days,
           strategy
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          setting.id,
          setting.accountId,
          setting.forecastDays,
          setting.safetyStockDays,
          setting.minStockUnits,
          setting.targetTurnoverDays,
          setting.strategy,
        ],
      )
    }

    for (const rule of seedData.productRules) {
      await client.query(
        `INSERT INTO product_rules (
           id,
           product_id,
           always_keep_stock,
           min_stock_units,
           max_stock_units,
           preferred_warehouse_id,
           excluded_warehouse_ids
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::bigint[])`,
        [
          rule.id,
          rule.productId,
          rule.alwaysKeepStock,
          rule.minStockUnits,
          rule.maxStockUnits,
          rule.preferredWarehouseId,
          rule.excludedWarehouseIds,
        ],
      )
    }

    for (const settings of notificationSettingsSeed) {
      await client.query(
        `INSERT INTO notification_settings (user_id, telegram_enabled, email_enabled, stockout_alert_days)
         VALUES ($1, $2, $3, $4)`,
        [
          settings.userId,
          settings.telegramEnabled,
          settings.emailEnabled,
          settings.stockoutAlertDays,
        ],
      )
    }

    for (const account of seedData.marketplaceAccounts || []) {
      await client.query(
        `INSERT INTO marketplace_accounts (
           id,
           user_id,
           marketplace,
           name,
           credentials_encrypted,
           external_business_id,
           external_campaign_id,
           seller_account_id,
           status,
           last_sync_at,
           last_error,
           created_at,
           updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          account.id,
          account.userId,
          account.marketplace,
          account.name,
          account.credentialsEncrypted,
          account.externalBusinessId,
          account.externalCampaignId,
          account.sellerAccountId ?? null,
          account.status,
          account.lastSyncAt,
          account.lastError,
          account.createdAt,
          account.updatedAt,
        ],
      )
    }

    await setSerialSequences(client)
  })
}

async function main() {
  try {
    await seedDb()
    console.log('Database seeded successfully')
  } finally {
    if (pool) await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
