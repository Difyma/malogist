import { Router } from 'express'
import { buildSupplyPlan, getCriticalSkus, landingData, supplyPlanToCsv } from '../data.js'

const router = Router()

router.get('/landing-data', (_, res) => {
  res.json(landingData)
})

router.get('/critical-skus', (req, res) => {
  const thresholdDays = Number(req.query.days) || 5
  const criticalSkus = getCriticalSkus({ thresholdDays })
  res.json({ thresholdDays, items: criticalSkus })
})

router.post('/supply-plan', (req, res) => {
  const { horizonDays, selectedSkus } = req.body ?? {}
  const plan = buildSupplyPlan({ horizonDays, selectedSkus })
  res.json(plan)
})

router.get('/supply-plan-export', (req, res) => {
  const horizonDays = Number(req.query.horizonDays) || 28
  const selectedSkus =
    typeof req.query.selectedSkus === 'string' && req.query.selectedSkus.length
      ? req.query.selectedSkus.split(',').map((sku) => sku.trim())
      : []

  const plan = buildSupplyPlan({ horizonDays, selectedSkus })
  const csv = supplyPlanToCsv(plan)
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="malogist-supply-plan-${timestamp}.csv"`)
  res.send(csv)
})

export default router
