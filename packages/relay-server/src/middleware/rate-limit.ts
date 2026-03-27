import rateLimit from 'express-rate-limit'

// Session mutations (create, submit result, skip) — stricter limit
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
})

// Polling endpoints (GET sessions, messages, responses) — higher limit
// Browser polls every 2s = 30 requests/min per session
export const pollingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
})
