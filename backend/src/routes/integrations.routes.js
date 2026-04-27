import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  createMarketplaceAccountForUser,
  ensureSellerAccountForIntegration,
  findMarketplaceAccountByIdForUser,
  getMarketplaceCredentials,
  listMarketplaceAccountsByUser,
  touchMarketplaceAccountSync,
  updateMarketplaceAccountForUser,
  updateMarketplaceAccountStatus,
} from '../repositories/integrations-store.js'
import { syncMarketplaceEntities, testMarketplaceConnection } from '../integrations/marketplace.service.js'
import { queues } from '../queues/index.js'

const router = Router()

router.use(requireAuth)

const allowedMarketplaces = new Set(['wb', 'ozon', 'yandex'])
const allowedEntities = ['products', 'warehouses', 'stocks', 'orders', 'sales', 'tariffs']

const queueNameByEntity = {
  products: 'sync-products',
  warehouses: 'sync-warehouses',
  stocks: 'sync-stocks',
  orders: 'sync-orders',
  sales: 'sync-sales',
  tariffs: 'sync-tariffs',
}

router.get('/', async (req, res) => {
  const items = await listMarketplaceAccountsByUser(req.auth.userId)

  return res.json(
    items.map((item) => ({
      id: item.id,
      marketplace: item.marketplace,
      name: item.name,
      status: item.status,
      externalBusinessId: item.externalBusinessId,
      externalCampaignId: item.externalCampaignId,
      lastSyncAt: item.lastSyncAt,
      lastError: item.lastError,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  )
})

router.post('/connect', async (req, res) => {
  const { marketplace, name, credentials, externalBusinessId, externalCampaignId } = req.body ?? {}

  if (!allowedMarketplaces.has(marketplace)) {
    return res.status(400).json({ message: 'marketplace must be wb, ozon or yandex' })
  }

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'name is required' })
  }

  if (!credentials || typeof credentials !== 'object') {
    return res.status(400).json({ message: 'credentials are required' })
  }

  if (marketplace === 'wb' && !credentials.apiKey) {
    return res.status(400).json({ message: 'WB requires credentials.apiKey' })
  }

  if (marketplace === 'ozon') {
    const apiKey = credentials.apiKey != null ? String(credentials.apiKey).trim() : ''
    const clientId = credentials.clientId != null ? String(credentials.clientId).trim() : ''
    if (!apiKey || !clientId) {
      return res.status(400).json({ message: 'Ozon requires credentials.clientId and credentials.apiKey' })
    }
    credentials.apiKey = apiKey
    credentials.clientId = clientId
  }

  if (marketplace === 'yandex' && !credentials.apiKey) {
    return res.status(400).json({ message: 'Yandex requires credentials.apiKey' })
  }

  const account = await createMarketplaceAccountForUser(req.auth.userId, {
    marketplace,
    name,
    credentials,
    externalBusinessId,
    externalCampaignId,
  })

  return res.status(201).json({
    id: account.id,
    marketplace: account.marketplace,
    name: account.name,
    status: account.status,
    externalBusinessId: account.externalBusinessId,
    externalCampaignId: account.externalCampaignId,
    lastSyncAt: account.lastSyncAt,
    createdAt: account.createdAt,
  })
})

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const account = await findMarketplaceAccountByIdForUser(id, req.auth.userId)
  if (!account) return res.status(404).json({ message: 'Integration account not found' })

  const { name, credentials, externalBusinessId, externalCampaignId } = req.body ?? {}
  const patch = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name must be a non-empty string' })
    }
    patch.name = name.trim()
  }

  if (credentials !== undefined) {
    if (credentials === null || typeof credentials !== 'object') {
      return res.status(400).json({ message: 'credentials must be an object' })
    }
    patch.credentials = credentials
  }

  if (externalBusinessId !== undefined) patch.externalBusinessId = externalBusinessId
  if (externalCampaignId !== undefined) patch.externalCampaignId = externalCampaignId

  if (
    patch.name === undefined &&
    patch.credentials === undefined &&
    patch.externalBusinessId === undefined &&
    patch.externalCampaignId === undefined
  ) {
    return res.status(400).json({ message: 'No fields to update' })
  }

  try {
    const updated = await updateMarketplaceAccountForUser(id, req.auth.userId, patch)
    return res.json({
      id: updated.id,
      marketplace: updated.marketplace,
      name: updated.name,
      status: updated.status,
      externalBusinessId: updated.externalBusinessId,
      externalCampaignId: updated.externalCampaignId,
      lastSyncAt: updated.lastSyncAt,
      lastError: updated.lastError,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    })
  } catch (error) {
    const status = error.statusCode || 500
    return res.status(status).json({ message: error.message })
  }
})

router.post('/:id/test', async (req, res) => {
  const id = Number(req.params.id)
  const account = await findMarketplaceAccountByIdForUser(id, req.auth.userId)
  if (!account) return res.status(404).json({ message: 'Integration account not found' })

  const credentials = getMarketplaceCredentials(account)
  if (!credentials) {
    await updateMarketplaceAccountStatus(id, req.auth.userId, 'error', 'Invalid credentials payload')
    return res.status(400).json({ ok: false, message: 'Invalid credentials payload' })
  }

  try {
    await testMarketplaceConnection(account, credentials)
    await updateMarketplaceAccountStatus(id, req.auth.userId, 'active', null)

    return res.json({ ok: true, status: 'active' })
  } catch (error) {
    await updateMarketplaceAccountStatus(id, req.auth.userId, 'error', error.message)
    return res.status(502).json({ ok: false, status: 'error', message: error.message })
  }
})

router.post('/:id/sync', async (req, res) => {
  const id = Number(req.params.id)
  const account = await findMarketplaceAccountByIdForUser(id, req.auth.userId)
  if (!account) return res.status(404).json({ message: 'Integration account not found' })

  const credentials = getMarketplaceCredentials(account)
  if (!credentials) {
    await updateMarketplaceAccountStatus(id, req.auth.userId, 'error', 'Invalid credentials payload')
    return res.status(400).json({ ok: false, message: 'Invalid credentials payload' })
  }

  const requestedEntities = Array.isArray(req.body?.entities)
    ? req.body.entities.filter((item) => allowedEntities.includes(item))
    : allowedEntities

  const useQueue = Boolean(req.body?.queued)

  if (useQueue) {
    const jobs = []

    for (const entity of requestedEntities) {
      const queueName = queueNameByEntity[entity]
      const queue = queues[queueName]

      if (!queue) {
        jobs.push({ entity, queued: false, reason: `Queue ${queueName} unavailable` })
        continue
      }

      const job = await queue.add(
        `${queueName}:${id}:${Date.now()}`,
        {
          integrationId: id,
          userId: req.auth.userId,
          entity,
          dateFrom: req.body?.dateFrom || null,
          dateTo: req.body?.dateTo || null,
        },
        { removeOnComplete: true, removeOnFail: 100 },
      )

      jobs.push({ entity, queued: true, queue: queueName, jobId: job.id })
    }

    return res.json({ queued: true, jobs })
  }

  try {
    const sellerAccountId =
      account.sellerAccountId ?? (await ensureSellerAccountForIntegration(id, req.auth.userId))
    if (!sellerAccountId) {
      return res.status(500).json({ queued: false, message: 'Failed to resolve seller account for integration' })
    }

    const summary = await syncMarketplaceEntities(account, credentials, requestedEntities, {
      dateFrom: req.body?.dateFrom,
      dateTo: req.body?.dateTo,
      externalCampaignId: account.externalCampaignId,
      sellerAccountId,
    })

    await touchMarketplaceAccountSync(id, req.auth.userId)
    return res.json({ queued: false, summary })
  } catch (error) {
    await updateMarketplaceAccountStatus(id, req.auth.userId, 'error', error.message)
    return res.status(502).json({ queued: false, message: error.message })
  }
})

export default router
