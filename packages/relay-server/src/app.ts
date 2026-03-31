import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { mutationLimiter, pollingLimiter } from './middleware/rate-limit.js'
import { sessionsRouter } from './routes/sessions.js'

export function createApp(): express.Express {
  const app = express()

  // SECURITY: Trust proxy headers only if explicitly configured via environment variable
  // Default to untrusted to prevent IP spoofing bypasses unless explicitly allowed.
  // We default to '1' for backwards compatibility, but it should ideally be configured via TRUST_PROXY
  const trustProxy = process.env.TRUST_PROXY
  if (trustProxy) {
    // Parse numeric values if provided (e.g., '1'), otherwise use the string
    const parsedProxy = !Number.isNaN(Number(trustProxy)) ? Number(trustProxy) : trustProxy
    app.set('trust proxy', parsedProxy)
  } else {
    app.set('trust proxy', 1)
  }

  // SECURITY: Restrictive CORS configuration by default
  // Parse comma-separated list of allowed origins from environment variable
  let corsOrigin: string | string[] | boolean = '*'
  if (process.env.CORS_ORIGIN) {
    if (process.env.CORS_ORIGIN === '*') {
      corsOrigin = '*'
    } else {
      corsOrigin = process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      if (corsOrigin.length === 1) {
        corsOrigin = corsOrigin[0]
      }
    }
  }

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
