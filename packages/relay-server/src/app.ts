import cors from 'cors'
import express from 'express'
import { rateLimiter } from './middleware/rate-limit.js'
import { sessionsRouter } from './routes/sessions.js'

export function createApp(): express.Express {
  const app = express()

  const corsOrigin = process.env.CORS_ORIGIN ?? '*'
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '1mb' }))
  app.use(rateLimiter)

  app.use('/api/sessions', sessionsRouter)

  const pagesDir = process.env.PAGES_DIR
  if (pagesDir) {
    app.use(express.static(pagesDir))
  }

  return app
}
