import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { sendTelegramTestAlert } from '../notifications.js'
import {
  getNotificationSettingsByUser,
  upsertNotificationSettingsByUser,
} from '../repositories/store.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const settings = await getNotificationSettingsByUser(req.auth.userId)
  return res.json(settings)
})

router.patch('/settings', requireAuth, async (req, res) => {
  const settings = await upsertNotificationSettingsByUser(req.auth.userId, req.body ?? {})
  return res.json(settings)
})

router.post('/test', async (req, res) => {
  const message =
    req.body?.message || 'MaLogist: тестовое уведомление. Критичные SKU требуют внимания.'

  try {
    const status = await sendTelegramTestAlert(message)
    return res.json(status)
  } catch (error) {
    return res.status(502).json({ sent: false, mode: 'error', message: error.message })
  }
})

router.post('/telegram/test', async (req, res) => {
  const message =
    req.body?.message || 'MaLogist: тестовое уведомление. Критичные SKU требуют внимания.'

  try {
    const status = await sendTelegramTestAlert(message)
    return res.json(status)
  } catch (error) {
    return res.status(502).json({ sent: false, mode: 'error', message: error.message })
  }
})

export default router
