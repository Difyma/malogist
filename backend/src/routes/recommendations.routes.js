import { Router } from 'express'
import { toCsv } from '../lib/csv.js'
import { generateAccountRecommendations } from '../domain/recommendations.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getAccountDatasetForRecommendations,
  getDefaultAccountIdForUser,
  getLatestRecommendationsByAccount,
  saveRecommendationsSnapshot,
} from '../repositories/store.js'

const router = Router()
router.use(requireAuth)

async function resolveAccountId(userId, value) {
  if (value) return Number(value)
  return getDefaultAccountIdForUser(userId)
}

async function getRecommendations(userId, accountId, forecastDays) {
  const effectiveAccountId = await resolveAccountId(userId, accountId)
  if (!effectiveAccountId) return { accountId: null, items: [] }

  if (!forecastDays) {
    const cached = await getLatestRecommendationsByAccount(effectiveAccountId)
    if (cached.length) {
      return { accountId: effectiveAccountId, items: cached }
    }
  }

  const dataset = await getAccountDatasetForRecommendations(effectiveAccountId, userId)
  if (!dataset) {
    return { accountId: effectiveAccountId, items: null }
  }

  const generated = generateAccountRecommendations(dataset, {
    accountId: effectiveAccountId,
    forecastDays,
  })

  await saveRecommendationsSnapshot(effectiveAccountId, generated, new Date().toISOString())

  return { accountId: effectiveAccountId, items: generated }
}

router.get('/', async (req, res) => {
  const accountId = Number(req.query.accountId) || null
  const response = await getRecommendations(req.auth.userId, accountId)

  if (response.accountId === null) {
    return res.status(404).json({ message: 'No accounts found' })
  }

  if (response.items === null) {
    return res.status(404).json({ message: 'Account not found' })
  }

  return res.json(response.items)
})

router.get('/critical', async (req, res) => {
  const accountId = Number(req.query.accountId) || null
  const response = await getRecommendations(req.auth.userId, accountId)

  if (response.accountId === null) {
    return res.status(404).json({ message: 'No accounts found' })
  }

  if (response.items === null) {
    return res.status(404).json({ message: 'Account not found' })
  }

  const rows = response.items.filter((item) => ['critical', 'high'].includes(item.priority))
  return res.json(rows)
})

router.post('/generate', async (req, res) => {
  const { accountId, forecastDays } = req.body ?? {}
  const response = await getRecommendations(req.auth.userId, Number(accountId) || null, forecastDays)

  if (response.accountId === null) {
    return res.status(404).json({ message: 'No accounts found' })
  }

  if (response.items === null) {
    return res.status(404).json({ message: 'Account not found' })
  }

  return res.json({ accountId: response.accountId, count: response.items.length, items: response.items })
})

router.post('/export', async (req, res) => {
  const { accountId, forecastDays } = req.body ?? {}
  const response = await getRecommendations(req.auth.userId, Number(accountId) || null, forecastDays)

  if (response.accountId === null) {
    return res.status(404).json({ message: 'No accounts found' })
  }

  if (response.items === null) {
    return res.status(404).json({ message: 'Account not found' })
  }

  const csv = toCsv([
    ['SKU', 'Товар', 'Склад', 'Остаток', 'Продажи в день', 'Хватит на дней', 'Рекомендация', 'Приоритет', 'Причина'],
    ...response.items.map((item) => [
      item.sku,
      item.name,
      item.warehouse,
      item.currentStock,
      item.avgDailySales,
      item.daysUntilStockout,
      item.recommendedQuantity,
      item.priority,
      item.reason,
    ]),
  ])

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="recommendations.csv"')
  return res.send(csv)
})

export default router
