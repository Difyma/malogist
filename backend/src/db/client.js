import { Pool } from 'pg'
import { env } from '../config/env.js'

export const isPgEnabled = Boolean(env.DATABASE_URL) && !env.USE_MOCK_DB

export const pool =
  isPgEnabled
    ? new Pool({
        connectionString: env.DATABASE_URL,
        max: 10,
      })
    : null

export async function query(text, params = []) {
  if (!pool) throw new Error('PostgreSQL is disabled')
  return pool.query(text, params)
}

export async function withTransaction(fn) {
  if (!pool) throw new Error('PostgreSQL is disabled')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
