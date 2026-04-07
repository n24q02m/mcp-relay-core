import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it, afterEach } from 'vitest'
import { createApp } from '../src/app.js'

describe('Proxy IP resolution', () => {
  let server: ReturnType<typeof createServer>
  let baseUrl: string

  const startServer = async (env: Record<string, string>) => {
    const originalEnv = { ...process.env }

    // Clear existing TRUST_PROXY if any
    delete process.env.TRUST_PROXY

    for (const [key, value] of Object.entries(env)) {
      process.env[key] = value
    }

    const app = createApp()

    // Add a test route to return the IP
    app.get('/test-ip', (req, res) => {
      res.json({ ip: req.ip })
    })

    server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo
        baseUrl = `http://127.0.0.1:${addr.port}`
        resolve()
      })
    })

    // Restore env immediately after creating app so it doesn't leak to other tests
    process.env = originalEnv
  }

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
  })

  it('defaults to trust proxy 1', async () => {
    await startServer({})
    const res = await fetch(`${baseUrl}/test-ip`, {
      headers: { 'X-Forwarded-For': '1.2.3.4' }
    })
    const data = await res.json() as { ip: string }
    // Trusts 1 hop (the remote address 127.0.0.1), so it sees 1.2.3.4
    expect(data.ip).toBe('1.2.3.4')
  })

  it('supports boolean true', async () => {
    await startServer({ TRUST_PROXY: 'true' })
    const res = await fetch(`${baseUrl}/test-ip`, {
      headers: { 'X-Forwarded-For': '1.2.3.4, 5.6.7.8' }
    })
    const data = await res.json() as { ip: string }
    // Trusts all hops, takes leftmost
    expect(data.ip).toBe('1.2.3.4')
  })

  it('supports boolean false', async () => {
    await startServer({ TRUST_PROXY: 'false' })
    const res = await fetch(`${baseUrl}/test-ip`, {
      headers: { 'X-Forwarded-For': '1.2.3.4, 5.6.7.8' }
    })
    const data = await res.json() as { ip: string }
    // Does not trust proxy, returns remote address (might be IPv6 mapped)
    expect(data.ip.endsWith('127.0.0.1')).toBe(true)
  })

  it('supports numeric value', async () => {
    await startServer({ TRUST_PROXY: '2' })
    const res = await fetch(`${baseUrl}/test-ip`, {
      headers: { 'X-Forwarded-For': '1.1.1.1, 2.2.2.2' }
    })
    const data = await res.json() as { ip: string }
    // Trusts 2 hops (remote address + 2.2.2.2), so it sees 1.1.1.1
    expect(data.ip).toBe('1.1.1.1')
  })

  it('supports comma-separated list', async () => {
    // 127.0.0.1 is the remote address of the test fetch
    await startServer({ TRUST_PROXY: '127.0.0.1, 10.0.0.1' })
    const res = await fetch(`${baseUrl}/test-ip`, {
      headers: { 'X-Forwarded-For': '1.2.3.4' }
    })
    const data = await res.json() as { ip: string }
    expect(data.ip).toBe('1.2.3.4')
  })
})
