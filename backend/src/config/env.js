import dotenv from 'dotenv'

dotenv.config({ quiet: true })

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 8080,
  DATABASE_URL: process.env.DATABASE_URL || '',
  USE_MOCK_DB: parseBoolean(process.env.USE_MOCK_DB, false),
  JWT_SECRET: process.env.JWT_SECRET || 'malogist-dev-secret',
  JWT_TTL: process.env.JWT_TTL || '7d',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
}
