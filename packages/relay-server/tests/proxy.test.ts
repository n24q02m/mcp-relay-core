import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { clearAllSessions } from '../src/store.js'

describe('Proxy IP Resolution', () => {
  let server: Server
  let baseUrl: string

  async function startServer() {
    const app = createApp()
    server = createServer(app)
    return new Promise<string>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo
        resolve(`http://127.0.0.1:${addr.port}`)
      })
    })
  }

  afterEach(async () => {
    vi.unstubAllEnvs()
    clearAllSessions()
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('uses TRUST_PROXY env var to resolve client IP', async () => {
    // Currently app.ts has hardcoded app.set('trust proxy', 1)
    // We want to verify we can change it to trust more hops

    vi.stubEnv('TRUST_PROXY', '2')
    baseUrl = await startServer()

    // With trust proxy = 2, and X-Forwarded-For: 1.2.3.4, 5.6.7.8, 9.9.9.9
    // Express should pick 5.6.7.8 (2nd from the right)

    // Fill up quota for 5.6.7.8
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '1.2.3.4, 5.6.7.8, 127.0.0.1' // 127.0.0.1 is the immediate peer (server.listen(0))
        },
        body: JSON.stringify({ sessionId: `s1-${i}`, serverName: 'test' })
      })
      expect(res.status).toBe(201)
    }

    // This should fail because it resolves to the same IP (5.6.7.8)
    const resFail = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '9.9.9.9, 5.6.7.8, 127.0.0.1'
      },
      body: JSON.stringify({ sessionId: 's1-fail', serverName: 'test' })
    })
    expect(resFail.status).toBe(429)

    // This should succeed because it resolves to a different IP (1.2.3.4)
    const resSuccess = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '1.2.3.4, 8.8.8.8, 127.0.0.1'
      },
      body: JSON.stringify({ sessionId: 's1-success', serverName: 'test' })
    })
    expect(resSuccess.status).toBe(201)
  })

  it('disables proxy trust when TRUST_PROXY is false', async () => {
    vi.stubEnv('TRUST_PROXY', 'false')
    baseUrl = await startServer()

    // With trust proxy = false, X-Forwarded-For should be ignored.
    // All requests from localhost will be seen as 127.0.0.1

    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `1.2.3.${i}`
        },
        body: JSON.stringify({ sessionId: `s2-${i}`, serverName: 'test' })
      })
      expect(res.status).toBe(201)
    }

    // 11th request should fail regardless of X-Forwarded-For
    const resFail = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '9.9.9.9'
      },
      body: JSON.stringify({ sessionId: 's2-fail', serverName: 'test' })
    })
    expect(resFail.status).toBe(429)
  })
})
