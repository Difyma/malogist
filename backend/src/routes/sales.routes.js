import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  listSalesByProductForUser,
  listSalesByRegionForUser,
  listSalesByWarehouseForUser,
  listSalesDailyByUser,
} from '../repositories/store.js'

const router = Router()
router.use(requireAuth)

router.get('/daily', async (req, res) => {
  const rows = await listSalesDailyByUser(req.auth.userId)
  return res.json(rows)
})

router.get('/by-region', async (req, res) => {
  const rows = await listSalesByRegionForUser(req.auth.userId)
  return res.json(rows)
})

router.get('/by-warehouse', async (req, res) => {
  const rows = await listSalesByWarehouseForUser(req.auth.userId)
  return res.json(rows)
})

router.get('/product/:productId', async (req, res) => {
  const productId = Number(req.params.productId)
  const rows = await listSalesByProductForUser(req.auth.userId, productId)
  if (rows === null) return res.status(404).json({ message: 'Product not found' })
  return res.json(rows)
})

export default router
