import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { clearAllSessions } from '../src/store.js'

describe('Proxy IP Resolution', () => {
  let server: Server
  let baseUrl: string

  async function startServer() {
    const app = createApp()
    server = createServer(app)
    return new Promise<string>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo
        resolve(`http://127.0.0.1:${addr.port}`)
      })
    })
  }

  afterEach(async () => {
    delete process.env.TRUST_PROXY
    clearAllSessions()
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('uses TRUST_PROXY env var to resolve client IP (number)', async () => {
    process.env.TRUST_PROXY = '2'
    baseUrl = await startServer()

    // Fill up quota for 5.6.7.8 (2nd from the right)
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '1.2.3.4, 5.6.7.8, 127.0.0.1'
        },
        body: JSON.stringify({ sessionId: `s1-${i}`, serverName: 'test' })
      })
      expect(res.status).toBe(201)
    }

    const resFail = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '9.9.9.9, 5.6.7.8, 127.0.0.1'
      },
      body: JSON.stringify({ sessionId: 's1-fail', serverName: 'test' })
    })
    expect(resFail.status).toBe(429)
  })

  it('uses TRUST_PROXY env var to resolve client IP (list)', async () => {
    process.env.TRUST_PROXY = '127.0.0.1, 10.0.0.1'
    baseUrl = await startServer()

    // X-Forwarded-For: 1.2.3.4, 10.0.0.1
    // Express trusts 127.0.0.1 (direct) and 10.0.0.1 (listed), so it picks 1.2.3.4
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '1.2.3.4, 10.0.0.1'
        },
        body: JSON.stringify({ sessionId: `sl-${i}`, serverName: 'test' })
      })
      expect(res.status).toBe(201)
    }

    const resFail = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '8.8.8.8, 1.2.3.4, 10.0.0.1'
      },
      body: JSON.stringify({ sessionId: 'sl-fail', serverName: 'test' })
    })
    expect(resFail.status).toBe(429)
  })

  it('disables proxy trust when TRUST_PROXY is false', async () => {
    process.env.TRUST_PROXY = 'false'
    baseUrl = await startServer()

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
