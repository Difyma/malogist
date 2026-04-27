import { Worker } from 'bullmq'
import { redisConnection } from '../queues/connection.js'
import { queueNames } from '../queues/names.js'
import {
  processAggregateSalesDaily,
  processCalculateForecast,
  processGenerateRecommendations,
  processSendNotifications,
  processSyncOrders,
  processSyncProducts,
  processSyncSales,
  processSyncStocks,
  processSyncTariffs,
  processSyncWarehouses,
} from './processors.js'

const processors = {
  'sync-products': processSyncProducts,
  'sync-warehouses': processSyncWarehouses,
  'sync-stocks': processSyncStocks,
  'sync-orders': processSyncOrders,
  'sync-sales': processSyncSales,
  'sync-tariffs': processSyncTariffs,
  'aggregate-sales-daily': processAggregateSalesDaily,
  'forecast-generate': processCalculateForecast,
  'recommendations-generate': processGenerateRecommendations,
  'notifications-send': processSendNotifications,
}

const workers = queueNames.map(
  (queueName) =>
    new Worker(queueName, processors[queueName], {
      connection: redisConnection,
      concurrency: 2,
    }),
)

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    console.log(`[worker:${job.queueName}] completed ${job.name}`)
  })

  worker.on('failed', (job, error) => {
    console.error(`[worker:${job?.queueName}] failed ${job?.name}: ${error.message}`)
  })
})

console.log('Workers started for queues:', queueNames.join(', '))
