import cors from 'cors'
import express from 'express'
import { mutationLimiter, pollingLimiter } from './middleware/rate-limit.js'
import { sessionsRouter } from './routes/sessions.js'

export function createApp(): express.Express {
  const app = express()

  const corsOrigin = process.env.CORS_ORIGIN ?? '*'
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '1mb' }))

  // Split rate limits: stricter for mutations, relaxed for polling
  app.use('/api', pollingLimiter) // GET requests (polling) — 120/min
  app.post('/api/sessions', mutationLimiter) // Create session — 30/min
  app.post('/api/sessions/:id/result', mutationLimiter) // Submit credentials — 30/min
  app.post('/api/sessions/:id/skip', mutationLimiter) // Skip — 30/min

  app.use('/api/sessions', sessionsRouter)

  const pagesDir = process.env.PAGES_DIR
  if (pagesDir) {
    app.use(express.static(pagesDir))
  }

  return app
}
