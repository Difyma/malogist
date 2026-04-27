import { Router } from 'express'
import { averageDailySales, daysUntilStockout } from '../domain/calculations.js'
import { requireAuth } from '../middleware/auth.js'
import {
  findProductByIdForUser,
  listProductsByUser,
  listSalesDailyByProductIds,
  listStocksByProductIds,
  upsertProductRuleForUser,
} from '../repositories/store.js'

const router = Router()
router.use(requireAuth)

function statusFromDays(days) {
  if (days <= 3) return 'critical'
  if (days <= 7) return 'high'
  if (days <= 14) return 'medium'
  return 'ok'
}

router.get('/', async (req, res) => {
  const { search, category, stockStatus } = req.query

  const products = await listProductsByUser(req.auth.userId)
  const productIds = products.map((item) => item.id)

  const [stocks, salesRows] = await Promise.all([
    listStocksByProductIds(productIds),
    listSalesDailyByProductIds(productIds, { days: 14 }),
  ])

  const totalSalesByProduct = new Map()
  for (const row of salesRows) {
    totalSalesByProduct.set(
      row.productId,
      (totalSalesByProduct.get(row.productId) || 0) + row.quantitySold,
    )
  }

  const stocksByProduct = new Map()
  for (const stock of stocks) {
    const current = stocksByProduct.get(stock.productId) || []
    current.push(stock)
    stocksByProduct.set(stock.productId, current)
  }

  const withStatus = products.map((product) => {
    const totalSales = totalSalesByProduct.get(product.id) || 0
    const avg = averageDailySales(totalSales, 14)
    const productStocks = stocksByProduct.get(product.id) || []

    const minDays = productStocks.length
      ? Math.min(
          ...productStocks.map((stock) => daysUntilStockout(stock.availableQuantity, avg)),
        )
      : Number.POSITIVE_INFINITY

    return {
      ...product,
      stockStatus: statusFromDays(minDays),
    }
  })

  const needle = search ? String(search).toLowerCase() : ''

  const filtered = withStatus.filter((item) => {
    if (needle && !item.name.toLowerCase().includes(needle) && !item.sku.toLowerCase().includes(needle)) {
      return false
    }

    if (category && item.category !== category) return false
    if (stockStatus && item.stockStatus !== stockStatus) return false

    return true
  })

  return res.json(filtered)
})

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const product = await findProductByIdForUser(id, req.auth.userId)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  return res.json(product)
})

router.patch('/:id/rules', async (req, res) => {
  const productId = Number(req.params.id)
  const rule = await upsertProductRuleForUser(productId, req.auth.userId, req.body ?? {})

  if (!rule) return res.status(404).json({ message: 'Product not found' })
  return res.json(rule)
})

export default router
