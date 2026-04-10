import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// Set limits for testing
process.env.RATE_LIMIT_MUTATION = '30'
process.env.RATE_LIMIT_POLLING = '120'
process.env.RATE_LIMIT_WINDOW_MS = '60000'

import { createApp } from '../src/app.js'
import { clearAllSessions } from '../src/store.js'

let server: ReturnType<typeof createServer>
let baseUrl: string

beforeAll(async () => {
  // Use fake timers to control rate limit windows
  vi.useFakeTimers()

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
  // Advance time significantly to clear rate limit buckets for the next test
  vi.setSystemTime(Date.now() + 120000)
  vi.advanceTimersByTime(120000)
})

afterAll(async () => {
  vi.useRealTimers()
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
})

describe('Rate limiting', () => {
  it('mutation rate limit kicks in after 30 POST requests per minute', async () => {
    const ip = '1.1.1.1'

    // First, create ONE session to have a valid ID for /skip
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip
      },
      body: JSON.stringify({ sessionId: 'mutation-base', serverName: 'test' })
    })
    expect(createRes.status).toBe(201)

    // Now hit /skip 30 more times (total 31 mutations)
    // /skip doesn't have the 10-session per IP limit that /api/sessions POST has.
    const results: number[] = [createRes.status]
    for (let i = 0; i < 30; i++) {
      const res = await fetch(`${baseUrl}/api/sessions/mutation-base/skip`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': ip }
      })
      results.push(res.status)
    }

    // Success = 201 for create, 200/409 for skip (both count as mutations)
    const nonRateLimited = results.filter((s) => s !== 429).length
    expect(nonRateLimited).toBe(30)
    expect(results[30]).toBe(429)

    const errorBody = await (
      await fetch(`${baseUrl}/api/sessions/mutation-base/skip`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': ip }
      })
    ).json()
    expect(errorBody).toEqual({ error: 'Too many requests, please try again later' })
  })

  it('polling rate limit kicks in after 120 requests per minute', async () => {
    const results: number[] = []
    const ip = '1.2.3.4'

    for (let i = 0; i < 121; i++) {
      const res = await fetch(`${baseUrl}/api/sessions/non-existent-${i}`, {
        headers: { 'X-Forwarded-For': ip }
      })
      results.push(res.status)
    }

    const notFoundCount = results.filter((s) => s === 404).length
    expect(notFoundCount).toBe(120)
    expect(results[120]).toBe(429)
  })

  it('different IPs have independent buckets', async () => {
    const ip1 = '2.1.1.1'
    const ip2 = '2.2.2.2'

    // Create session for ip1 to use for skip
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip1 },
      body: JSON.stringify({ sessionId: 'ip1-base', serverName: 'test' })
    })

    // Exhaust ip1 using /skip (30 total)
    for (let i = 0; i < 29; i++) {
      await fetch(`${baseUrl}/api/sessions/ip1-base/skip`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': ip1 }
      })
    }

    const res1 = await fetch(`${baseUrl}/api/sessions/ip1-base/skip`, {
      method: 'POST',
      headers: { 'X-Forwarded-For': ip1 }
    })
    expect(res1.status).toBe(429)

    // ip2 should still be fine
    const res2 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip2
      },
      body: JSON.stringify({ sessionId: 'ip2-ok', serverName: 'test' })
    })
    expect(res2.status).toBe(201)
  })

  it('rate limit resets after the window passes', async () => {
    const ip = '3.3.3.3'

    // Create session to use for skip
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ sessionId: 'reset-base', serverName: 'test' })
    })

    // Hit the limit (30 total)
    for (let i = 0; i < 29; i++) {
      await fetch(`${baseUrl}/api/sessions/reset-base/skip`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': ip }
      })
    }

    expect(
      (
        await fetch(`${baseUrl}/api/sessions/reset-base/skip`, {
          method: 'POST',
          headers: { 'X-Forwarded-For': ip }
        })
      ).status
    ).toBe(429)

    // Advance time by 61 seconds
    vi.advanceTimersByTime(61000)
    vi.setSystemTime(Date.now() + 61000)

    // Should be able to request again
    const res = await fetch(`${baseUrl}/api/sessions/reset-base/skip`, {
      method: 'POST',
      headers: { 'X-Forwarded-For': ip }
    })
    // It should be 409 (already skipped) but NOT 429
    expect(res.status).toBe(409)
  })

  it('mutation limit is shared across ALL mutation paths', async () => {
    const ip = '4.4.4.4'
    const sessionId = 'all-paths-test'

    // 1. Create session (1)
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ sessionId, serverName: 'test' })
    })

    // 2. Submit result (10 times)
    for (let i = 0; i < 10; i++) {
      await fetch(`${baseUrl}/api/sessions/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
        body: JSON.stringify({ browserPub: 'a', ciphertext: 'b', iv: 'c', tag: 'd' })
      })
    }

    // 3. Skip (19 times) - total 30
    for (let i = 0; i < 19; i++) {
      await fetch(`${baseUrl}/api/sessions/${sessionId}/skip`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': ip }
      })
    }

    // 4. 31st request (any mutation) should fail
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ sessionId: 'one-more', serverName: 'test' })
    })
    expect(res.status).toBe(429)
  })
})
