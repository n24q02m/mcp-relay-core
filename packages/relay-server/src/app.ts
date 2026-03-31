import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { mutationLimiter, pollingLimiter } from './middleware/rate-limit.js'
import { sessionsRouter } from './routes/sessions.js'

export function createApp(): express.Express {
  const app = express()

  // Trust proxy headers from Caddy/CF Tunnel for correct client IP in rate limiting
  // Defaults to false to prevent IP spoofing when exposed directly to the internet
  const trustProxy = process.env.TRUST_PROXY
  if (trustProxy !== undefined) {
    const parsed = Number(trustProxy)
    app.set(
      'trust proxy',
      Number.isNaN(parsed) ? (trustProxy === 'true' ? true : trustProxy === 'false' ? false : trustProxy) : parsed
    )
  }

  const corsOrigin = process.env.CORS_ORIGIN ?? '*'
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  )
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
    // Short cache for JS/CSS (pages update with releases), no-cache for HTML
    app.use(
      express.static(pagesDir, {
        maxAge: '1h',
        setHeaders: (res, path) => {
          if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
        }
      })
    )
  }

  return app
}
