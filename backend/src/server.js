import { env } from './config/env.js'
import { createApp } from './app.js'

const app = createApp()

app.listen(env.PORT, () => {
  console.log(`MaLogist API running on http://localhost:${env.PORT}`)
})
