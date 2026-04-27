import { Router } from 'express'
import { generateAccountRecommendations } from '../domain/recommendations.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getAccountDatasetForRecommendations,
  getDefaultAccountIdForUser,
  getForecastSettingsByAccount,
  getLatestForecastRunByAccount,
  getLatestRecommendationsByAccount,
  persistLatestForecastRunSnapshot,
  saveRecommendationsSnapshot,
  upsertForecastSettingsByAccountForUser,
} from '../repositories/store.js'

const router = Router()
router.use(requireAuth)

async function resolveAccountId(userId, value) {
  if (value) return Number(value)
  return getDefaultAccountIdForUser(userId)
}

router.post('/run', async (req, res) => {
  const { accountId, forecastDays } = req.body ?? {}
  const effectiveAccountId = await resolveAccountId(req.auth.userId, accountId)

  if (!effectiveAccountId) {
    return res.status(400).json({ message: 'accountId is required' })
  }

  const dataset = await getAccountDatasetForRecommendations(effectiveAccountId, req.auth.userId)
  if (!dataset) return res.status(404).json({ message: 'Account not found' })

  const recommendations = generateAccountRecommendations(dataset, {
    accountId: effectiveAccountId,
    forecastDays,
  })

  const settings = await getForecastSettingsByAccount(effectiveAccountId)
  const effectiveForecastDays = Number(forecastDays) || settings?.forecastDays || 28
  const generatedAt = new Date().toISOString()

  await saveRecommendationsSnapshot(effectiveAccountId, recommendations, generatedAt)

  const snapshot = {
    accountId: effectiveAccountId,
    forecastDays: effectiveForecastDays,
    generatedAt,
    recommendationsCount: recommendations.length,
  }

  await persistLatestForecastRunSnapshot(effectiveAccountId, snapshot)

  return res.json(snapshot)
})

router.get('/latest', async (req, res) => {
  const queryAccountId = Number(req.query.accountId) || null
  const effectiveAccountId = await resolveAccountId(req.auth.userId, queryAccountId)

  if (!effectiveAccountId) {
    return res.status(404).json({ message: 'No accounts found' })
  }

  const latest = await getLatestForecastRunByAccount(effectiveAccountId)
  if (!latest) return res.status(404).json({ message: 'No forecast runs yet' })

  return res.json(latest)
})

router.get('/settings', async (req, res) => {
  const queryAccountId = Number(req.query.accountId) || null
  const effectiveAccountId = await resolveAccountId(req.auth.userId, queryAccountId)

  if (!effectiveAccountId) {
    return res.status(404).json({ message: 'No accounts found' })
  }

  const settings = await getForecastSettingsByAccount(effectiveAccountId)
  if (!settings) {
    return res.json({
      accountId: effectiveAccountId,
      forecastDays: 28,
      safetyStockDays: 5,
      minStockUnits: 0,
      targetTurnoverDays: 28,
      strategy: 'balanced',
    })
  }

  return res.json(settings)
})

router.patch('/settings', async (req, res) => {
  const queryAccountId = Number(req.query.accountId) || null
  const effectiveAccountId = await resolveAccountId(req.auth.userId, queryAccountId)

  if (!effectiveAccountId) {
    return res.status(404).json({ message: 'No accounts found' })
  }

  const updated = await upsertForecastSettingsByAccountForUser(
    effectiveAccountId,
    req.auth.userId,
    req.body ?? {},
  )

  if (!updated) {
    return res.status(404).json({ message: 'Account not found' })
  }

  return res.json(updated)
})

router.get('/product/:productId', async (req, res) => {
  const productId = Number(req.params.productId)
  const queryAccountId = Number(req.query.accountId) || null
  const effectiveAccountId = await resolveAccountId(req.auth.userId, queryAccountId)

  if (!effectiveAccountId) {
    return res.status(404).json({ message: 'No accounts found' })
  }

  let recommendations = await getLatestRecommendationsByAccount(effectiveAccountId)
  if (!recommendations.length) {
    const dataset = await getAccountDatasetForRecommendations(effectiveAccountId, req.auth.userId)
    if (!dataset) return res.status(404).json({ message: 'Account not found' })

    recommendations = generateAccountRecommendations(dataset, {
      accountId: effectiveAccountId,
    })
  }

  const rows = recommendations.filter((item) => item.productId === productId)
  return res.json(rows)
})

export default router
