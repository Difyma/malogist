import { isPgEnabled, query } from '../db/client.js'
import { db as mockDb } from '../db/mock-store.js'
import { decryptCredentials, encryptCredentials } from '../lib/credentials.js'
import { createAccountForUser, updateAccountForUser } from './store.js'

function toIso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

function mapAccount(row) {
  if (!row) return null

  const sellerRaw = row.seller_account_id ?? row.sellerAccountId
  return {
    id: Number(row.id),
    userId: Number(row.user_id ?? row.userId),
    marketplace: row.marketplace,
    name: row.name,
    credentialsEncrypted: row.credentials_encrypted ?? row.credentialsEncrypted,
    externalBusinessId: row.external_business_id ?? row.externalBusinessId,
    externalCampaignId: row.external_campaign_id ?? row.externalCampaignId,
    sellerAccountId: sellerRaw != null ? Number(sellerRaw) : null,
    status: row.status,
    lastSyncAt: toIso(row.last_sync_at ?? row.lastSyncAt),
    lastError: row.last_error ?? row.lastError ?? null,
    createdAt: toIso(row.created_at ?? row.createdAt),
    updatedAt: toIso(row.updated_at ?? row.updatedAt),
  }
}

function ensureMock() {
  if (!Array.isArray(mockDb.marketplaceAccounts)) {
    mockDb.marketplaceAccounts = [
      {
        id: 1,
        userId: 1,
        marketplace: 'wb',
        name: 'WB Demo кабинет',
        credentialsEncrypted: encryptCredentials({ apiKey: 'demo_wb_token' }),
        externalBusinessId: null,
        externalCampaignId: null,
        status: 'disabled',
        lastSyncAt: null,
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
  }
}

export async function listMarketplaceAccountsByUser(userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT id, user_id, marketplace, name, credentials_encrypted, external_business_id,
              external_campaign_id, seller_account_id, status, last_sync_at, last_error, created_at, updated_at
       FROM marketplace_accounts
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId],
    )

    return result.rows.map(mapAccount)
  }

  ensureMock()
  return mockDb.marketplaceAccounts
    .filter((item) => item.userId === userId)
    .map(mapAccount)
}

export async function findMarketplaceAccountByIdForUser(id, userId) {
  if (isPgEnabled) {
    const result = await query(
      `SELECT id, user_id, marketplace, name, credentials_encrypted, external_business_id,
              external_campaign_id, seller_account_id, status, last_sync_at, last_error, created_at, updated_at
       FROM marketplace_accounts
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [id, userId],
    )

    return mapAccount(result.rows[0])
  }

  ensureMock()
  return mapAccount(
    mockDb.marketplaceAccounts.find((item) => item.id === id && item.userId === userId),
  )
}

export async function createMarketplaceAccountForUser(userId, payload) {
  const encrypted = encryptCredentials(payload.credentials || {})

  const seller = await createAccountForUser(userId, {
    name: payload.name,
    marketplaceType: payload.marketplace,
    apiKey: '__marketplace_integration__',
    clientId: payload.marketplace === 'ozon' ? '__marketplace_integration__' : null,
  })

  if (isPgEnabled) {
    const result = await query(
      `INSERT INTO marketplace_accounts (
         user_id,
         marketplace,
         name,
         credentials_encrypted,
         external_business_id,
         external_campaign_id,
         seller_account_id,
         status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, user_id, marketplace, name, credentials_encrypted, external_business_id,
                 external_campaign_id, seller_account_id, status, last_sync_at, last_error, created_at, updated_at`,
      [
        userId,
        payload.marketplace,
        payload.name,
        encrypted,
        payload.externalBusinessId || null,
        payload.externalCampaignId || null,
        seller.id,
        'active',
      ],
    )

    return mapAccount(result.rows[0])
  }

  ensureMock()

  const record = {
    id: mockDb.nextId('marketplaceAccounts'),
    userId,
    marketplace: payload.marketplace,
    name: payload.name,
    credentialsEncrypted: encrypted,
    externalBusinessId: payload.externalBusinessId || null,
    externalCampaignId: payload.externalCampaignId || null,
    sellerAccountId: seller.id,
    status: 'active',
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  mockDb.marketplaceAccounts.push(record)
  return mapAccount(record)
}

/** Для старых интеграций без связи с accounts. */
export async function updateMarketplaceAccountForUser(integrationId, userId, patch = {}) {
  const existing = await findMarketplaceAccountByIdForUser(integrationId, userId)
  if (!existing) return null

  const nextName =
    typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : existing.name

  let credentialsEncrypted = existing.credentialsEncrypted
  if (patch.credentials && typeof patch.credentials === 'object') {
    const current = decryptCredentials(existing.credentialsEncrypted) || {}
    const mp = existing.marketplace
    const merged = { ...current }
    const cred = patch.credentials
    if (mp === 'ozon') {
      if (cred.apiKey != null && String(cred.apiKey).trim()) merged.apiKey = String(cred.apiKey).trim()
      if (cred.clientId != null && String(cred.clientId).trim())
        merged.clientId = String(cred.clientId).trim()
      if (!merged.apiKey || !merged.clientId) {
        const err = new Error('У Ozon должны быть заполнены Client ID и API-ключ')
        err.statusCode = 400
        throw err
      }
    } else {
      if (cred.apiKey != null && String(cred.apiKey).trim()) merged.apiKey = String(cred.apiKey).trim()
      if (!merged.apiKey) {
        const err = new Error('Ключ API обязателен')
        err.statusCode = 400
        throw err
      }
    }
    credentialsEncrypted = encryptCredentials(merged)
  }

  let externalBusinessId = existing.externalBusinessId
  let externalCampaignId = existing.externalCampaignId
  if (patch.externalBusinessId !== undefined) externalBusinessId = patch.externalBusinessId || null
  if (patch.externalCampaignId !== undefined) externalCampaignId = patch.externalCampaignId || null

  if (isPgEnabled) {
    const result = await query(
      `UPDATE marketplace_accounts
       SET name = $1,
           credentials_encrypted = $2,
           external_business_id = $3,
           external_campaign_id = $4,
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING id, user_id, marketplace, name, credentials_encrypted, external_business_id,
                 external_campaign_id, seller_account_id, status, last_sync_at, last_error, created_at, updated_at`,
      [
        nextName,
        credentialsEncrypted,
        externalBusinessId,
        externalCampaignId,
        integrationId,
        userId,
      ],
    )

    const updated = mapAccount(result.rows[0])
    if (existing.sellerAccountId) {
      await updateAccountForUser(existing.sellerAccountId, userId, { name: nextName })
    }
    return updated
  }

  ensureMock()
  const item = mockDb.marketplaceAccounts.find((a) => a.id === integrationId && a.userId === userId)
  if (!item) return null

  item.name = nextName
  item.credentialsEncrypted = credentialsEncrypted
  item.externalBusinessId = externalBusinessId
  item.externalCampaignId = externalCampaignId
  item.updatedAt = new Date().toISOString()

  if (existing.sellerAccountId) {
    await updateAccountForUser(existing.sellerAccountId, userId, { name: nextName })
  }

  return mapAccount(item)
}

export async function ensureSellerAccountForIntegration(integrationId, userId) {
  const existing = await findMarketplaceAccountByIdForUser(integrationId, userId)
  if (!existing) return null
  if (existing.sellerAccountId) return existing.sellerAccountId

  const seller = await createAccountForUser(userId, {
    name: existing.name,
    marketplaceType: existing.marketplace,
    apiKey: '__marketplace_integration__',
    clientId: existing.marketplace === 'ozon' ? '__marketplace_integration__' : null,
  })

  if (isPgEnabled) {
    await query(
      `UPDATE marketplace_accounts
       SET seller_account_id = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [seller.id, integrationId, userId],
    )
    return seller.id
  }

  ensureMock()
  const item = mockDb.marketplaceAccounts.find((a) => a.id === integrationId && a.userId === userId)
  if (item) item.sellerAccountId = seller.id
  return seller.id
}

export async function updateMarketplaceAccountStatus(id, userId, status, lastError = null) {
  if (isPgEnabled) {
    const result = await query(
      `UPDATE marketplace_accounts
       SET status = $1,
           last_error = $2,
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, user_id, marketplace, name, credentials_encrypted, external_business_id,
                 external_campaign_id, seller_account_id, status, last_sync_at, last_error, created_at, updated_at`,
      [status, lastError, id, userId],
    )

    return mapAccount(result.rows[0])
  }

  ensureMock()
  const item = mockDb.marketplaceAccounts.find((account) => account.id === id && account.userId === userId)
  if (!item) return null

  item.status = status
  item.lastError = lastError
  item.updatedAt = new Date().toISOString()

  return mapAccount(item)
}

export async function touchMarketplaceAccountSync(id, userId) {
  if (isPgEnabled) {
    const result = await query(
      `UPDATE marketplace_accounts
       SET last_sync_at = NOW(),
           status = 'active',
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, marketplace, name, credentials_encrypted, external_business_id,
                 external_campaign_id, seller_account_id, status, last_sync_at, last_error, created_at, updated_at`,
      [id, userId],
    )

    return mapAccount(result.rows[0])
  }

  ensureMock()
  const item = mockDb.marketplaceAccounts.find((account) => account.id === id && account.userId === userId)
  if (!item) return null

  item.lastSyncAt = new Date().toISOString()
  item.status = 'active'
  item.lastError = null
  item.updatedAt = new Date().toISOString()

  return mapAccount(item)
}

export function getMarketplaceCredentials(account) {
  return decryptCredentials(account?.credentialsEncrypted)
}
