import { Router } from 'express'
import { averageDailySales, daysUntilStockout } from '../domain/calculations.js'
import { requireAuth } from '../middleware/auth.js'
import {
  findProductByIdForUser,
  listProductsByUser,
  listSalesDailyByProductIds,
  listStocksByProductIds,
  listWarehousesByIds,
} from '../repositories/store.js'

const router = Router()
router.use(requireAuth)

function buildStockRows({ stocks, productsById, warehousesById, avgSalesByProduct }) {
  return stocks.map((stock) => {
    const product = productsById.get(stock.productId)
    const warehouse = warehousesById.get(stock.warehouseId)
    const avg = avgSalesByProduct.get(stock.productId) || 0

    return {
      productId: stock.productId,
      sku: product?.sku,
      name: product?.name,
      warehouseId: stock.warehouseId,
      warehouse: warehouse?.name,
      stock: stock.availableQuantity,
      daysUntilStockout: Number(daysUntilStockout(stock.availableQuantity, avg).toFixed(2)),
      updatedAt: stock.updatedAt,
    }
  })
}

async function getStockContextByUser(userId) {
  const products = await listProductsByUser(userId)
  const productIds = products.map((item) => item.id)

  const [stocks, salesRows] = await Promise.all([
    listStocksByProductIds(productIds),
    listSalesDailyByProductIds(productIds, { days: 14 }),
  ])

  const warehouseIds = [...new Set(stocks.map((stock) => stock.warehouseId).filter(Boolean))]
  const warehouses = await listWarehousesByIds(warehouseIds)

  const totalSalesByProduct = new Map()
  for (const row of salesRows) {
    totalSalesByProduct.set(
      row.productId,
      (totalSalesByProduct.get(row.productId) || 0) + row.quantitySold,
    )
  }

  const avgSalesByProduct = new Map()
  for (const productId of productIds) {
    avgSalesByProduct.set(productId, averageDailySales(totalSalesByProduct.get(productId) || 0, 14))
  }

  return {
    productsById: new Map(products.map((product) => [product.id, product])),
    warehousesById: new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    avgSalesByProduct,
    stocks,
  }
}

router.get('/', async (req, res) => {
  const context = await getStockContextByUser(req.auth.userId)
  const rows = buildStockRows(context)
  return res.json(rows)
})

router.get('/product/:productId', async (req, res) => {
  const productId = Number(req.params.productId)
  const product = await findProductByIdForUser(productId, req.auth.userId)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const context = await getStockContextByUser(req.auth.userId)
  const rows = buildStockRows(context).filter((row) => row.productId === productId)

  return res.json({
    productId,
    sku: product.sku,
    name: product.name,
    warehouses: rows.map((row) => ({
      warehouse: row.warehouse,
      stock: row.stock,
      daysUntilStockout: row.daysUntilStockout,
    })),
  })
})

router.get('/critical', async (req, res) => {
  const threshold = Number(req.query.days) || 5
  const context = await getStockContextByUser(req.auth.userId)
  const rows = buildStockRows(context).filter((row) => row.daysUntilStockout <= threshold)

  return res.json({ thresholdDays: threshold, items: rows })
})

export default router
