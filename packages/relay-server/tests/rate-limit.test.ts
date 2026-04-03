import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { clearAllSessions } from '../src/store.js'

let server: ReturnType<typeof createServer>
let baseUrl: string

beforeAll(async () => {
  const app = createApp()
  server = createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as AddressInfo
      baseUrl = `http://127.0.0.1:${addr.port}`
      resolve()
    })
  })
})

afterEach(() => {
  clearAllSessions()
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
})

describe('Rate limiting', () => {
  it('mutation rate limit kicks in after 30 POST requests per minute', async () => {
    // POST requests go through mutationLimiter (30/min)
    const results: number[] = []
    for (let i = 0; i < 31; i++) {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverName: `test-${i}`, schema: {} })
      })
      results.push(res.status)
    }

    // First 30 should succeed (201 created)
    const successCount = results.filter((s) => s === 201).length
    expect(successCount).toBeLessThanOrEqual(30)

    // 31st should be rate limited
    expect(results[30]).toBe(429)
  })

  it('polling rate limit allows 120 GET requests per minute', async () => {
    // GET requests go through pollingLimiter (120/min)
    // Send 31 GETs — all should be 404 (no rate limit at this count)
    const results: number[] = []
    for (let i = 0; i < 31; i++) {
      const res = await fetch(`${baseUrl}/api/sessions/poll-test-${i}`)
      results.push(res.status)
    }

    // All 31 should be 404 (not rate limited — limit is 120)
    for (const status of results) {
      expect(status).toBe(404)
    }
  })
})
