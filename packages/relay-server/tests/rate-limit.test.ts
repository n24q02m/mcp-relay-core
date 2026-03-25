import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { clearAllSessions } from '../src/store.js'

let server: Server
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
  it('rate limit kicks in after 30 requests per minute', async () => {
    // Send 30 requests (all should succeed with 404 since no session exists)
    const results: number[] = []
    for (let i = 0; i < 31; i++) {
      const res = await fetch(`${baseUrl}/api/sessions/rate-test-${i}`)
      results.push(res.status)
    }

    // First 30 should be 404 (valid response, session not found)
    for (let i = 0; i < 30; i++) {
      expect(results[i]).toBe(404)
    }

    // 31st should be rate limited
    expect(results[30]).toBe(429)
  })
})
