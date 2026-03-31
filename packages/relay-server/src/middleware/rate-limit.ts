import rateLimit from 'express-rate-limit'

const MUTATION_LIMIT = Number(process.env.RATE_LIMIT_MUTATION ?? 30)
const POLLING_LIMIT = Number(process.env.RATE_LIMIT_POLLING ?? 120)
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000)

// Session mutations (create, submit result, skip)
export const mutationLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: MUTATION_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
})

// Polling endpoints (GET sessions, messages, responses)
// Server polls every 2s = 30 requests/min per session
export const pollingLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: POLLING_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
})
