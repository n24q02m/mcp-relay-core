import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { mutationLimiter, pollingLimiter } from './middleware/rate-limit.js'
import { sessionsRouter } from './routes/sessions.js'

export function createApp(): express.Express {
  const app = express()

  // Trust proxy headers from Caddy/CF Tunnel for correct client IP in rate limiting
  app.set('trust proxy', 1)

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
      contentSecurityPolicy: true, // Fix insecure configuration of Helmet security middleware
      crossOriginEmbedderPolicy: true
    })
  )

  // Secure CORS origin handler
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!corsOrigin || (corsOrigin as unknown) === false) return callback(null, false)
        if (corsOrigin === '*') return callback(null, true)
        if (Array.isArray(corsOrigin) && corsOrigin.includes(requestOrigin as string)) return callback(null, true)
        callback(new Error('Not allowed by CORS'), false)
      }
    })
  )
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
