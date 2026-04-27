import cors from 'cors'
import express from 'express'
import authRoutes from './routes/auth.routes.js'
import accountsRoutes from './routes/accounts.routes.js'
import productsRoutes from './routes/products.routes.js'
import stocksRoutes from './routes/stocks.routes.js'
import salesRoutes from './routes/sales.routes.js'
import forecastRoutes from './routes/forecast.routes.js'
import recommendationsRoutes from './routes/recommendations.routes.js'
import notificationsRoutes from './routes/notifications.routes.js'
import landingRoutes from './routes/landing.routes.js'
import integrationsRoutes from './routes/integrations.routes.js'
import { getStorageMode } from './repositories/store.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_, res) => {
    res.json({
      status: 'ok',
      service: 'malogist-api',
      version: 'mvp-architecture',
      storage: getStorageMode(),
    })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/accounts', accountsRoutes)
  app.use('/api/products', productsRoutes)
  app.use('/api/stocks', stocksRoutes)
  app.use('/api/sales', salesRoutes)
  app.use('/api/forecast', forecastRoutes)
  app.use('/api/recommendations', recommendationsRoutes)
  app.use('/api/notifications', notificationsRoutes)
  app.use('/api/integrations', integrationsRoutes)

  // Backward-compatible endpoints used by current frontend.
  app.use('/api', landingRoutes)

  app.use((_, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.use((error, _, res, __) => {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  })

  return app
}
