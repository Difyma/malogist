import { env } from '../config/env.js'

function buildSalt() {
  return Buffer.from(env.JWT_SECRET || 'malogist-dev-secret').toString('base64url').slice(0, 12)
}

export function encryptCredentials(payload) {
  const wrapper = {
    v: 1,
    salt: buildSalt(),
    payload,
  }

  return Buffer.from(JSON.stringify(wrapper), 'utf-8').toString('base64url')
}

export function decryptCredentials(encoded) {
  if (!encoded) return null

  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    const parsed = JSON.parse(decoded)

    if (!parsed || typeof parsed !== 'object') return null
    return parsed.payload ?? null
  } catch {
    return null
  }
}
