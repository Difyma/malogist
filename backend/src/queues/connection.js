import IORedis from 'ioredis'
import { env } from '../config/env.js'

export const redisConnection =
  env.REDIS_ENABLED
    ? new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      })
    : null
