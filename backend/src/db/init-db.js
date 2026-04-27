import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPgEnabled, pool, query } from './client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function initDb() {
  if (!isPgEnabled) {
    throw new Error('PostgreSQL is disabled. Set DATABASE_URL and ensure USE_MOCK_DB is false.')
  }

  const schemaPath = resolve(__dirname, './schema.sql')
  const sql = await readFile(schemaPath, 'utf-8')
  await query(sql)
}

async function main() {
  try {
    await initDb()
    console.log('Database schema initialized successfully')
  } finally {
    if (pool) await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
