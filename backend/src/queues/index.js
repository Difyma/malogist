import { Queue } from 'bullmq'
import { env } from '../config/env.js'
import { redisConnection } from './connection.js'
import { queueNames } from './names.js'

function buildQueues() {
  if (!env.REDIS_ENABLED || !redisConnection) {
    return Object.fromEntries(queueNames.map((name) => [name, null]))
  }
  return Object.fromEntries(
    queueNames.map((name) => [name, new Queue(name, { connection: redisConnection })]),
  )
}

export const queues = buildQueues()

export async function enqueueDefaultJobs() {
  if (!env.REDIS_ENABLED || !redisConnection) {
    console.warn('enqueueDefaultJobs: Redis disabled; nothing enqueued.')
    return
  }
  await queues['sync-products'].add('sync-products-now', {}, { removeOnComplete: true })
  await queues['sync-warehouses'].add('sync-warehouses-now', {}, { removeOnComplete: true })
  await queues['sync-stocks'].add('sync-stocks-now', {}, { removeOnComplete: true })
  await queues['sync-orders'].add('sync-orders-now', {}, { removeOnComplete: true })
  await queues['sync-sales'].add('sync-sales-now', {}, { removeOnComplete: true })
  await queues['sync-tariffs'].add('sync-tariffs-now', {}, { removeOnComplete: true })
  await queues['aggregate-sales-daily'].add('aggregate-sales-daily-now', {}, { removeOnComplete: true })
  await queues['forecast-generate'].add('forecast-generate-now', {}, { removeOnComplete: true })
  await queues['recommendations-generate'].add('recommendations-generate-now', {}, { removeOnComplete: true })
  await queues['notifications-send'].add('notifications-send-now', {}, { removeOnComplete: true })
}
