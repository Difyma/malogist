import { Queue } from 'bullmq'
import { redisConnection } from './connection.js'
import { queueNames } from './names.js'

export const queues = Object.fromEntries(
  queueNames.map((name) => [name, new Queue(name, { connection: redisConnection })]),
)

export async function enqueueDefaultJobs() {
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
