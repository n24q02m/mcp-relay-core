import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { mutationLimiter, pollingLimiter } from './middleware/rate-limit.js'
import { sessionsRouter } from './routes/sessions.js'

export function createApp(): express.Express {
  const app = express()

  // Trust proxy headers from Caddy/CF Tunnel for correct client IP in rate limiting
  const rawTrustProxy = process.env.TRUST_PROXY
  if (rawTrustProxy === 'true') {
    app.set('trust proxy', true)
  } else if (rawTrustProxy === 'false') {
    app.set('trust proxy', false)
  } else if (rawTrustProxy) {
    const num = Number(rawTrustProxy)
    if (!Number.isNaN(num)) {
      app.set('trust proxy', num)
    } else if (rawTrustProxy.includes(',')) {
      app.set(
        'trust proxy',
        rawTrustProxy.split(',').map((s) => s.trim())
      )
    } else {
      app.set('trust proxy', rawTrustProxy)
    }
  } else {
    // Default to 1 for backward compatibility (Caddy/CF Tunnel)
    app.set('trust proxy', 1)
  }

  const rawOrigin = process.env.CORS_ORIGIN
  let corsOrigin: boolean | string | string[] = false // Restrictive default: block cross-origin
  if (rawOrigin) {
    if (rawOrigin === '*') {
      corsOrigin = '*'
    } else {
      corsOrigin = rawOrigin.split(',').map((o) => o.trim())
    }
  }

  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  )
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '100kb' }))

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
