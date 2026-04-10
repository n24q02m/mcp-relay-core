import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('createApp', () => {
  let server: Server | null = null
  let baseUrl: string

  async function startServer() {
    const app = createApp()
    server = createServer(app)
    await new Promise<void>((resolve) => {
      server?.listen(0, () => {
        const addr = server?.address() as AddressInfo
        baseUrl = `http://127.0.0.1:${addr.port}`
        resolve()
      })
    })
  }

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()))
      server = null
    }
    vi.unstubAllEnvs()
  })

  it('sets security headers (Helmet)', async () => {
    await startServer()
    // Using a known route to check headers
    const res = await fetch(`${baseUrl}/api/sessions`, { method: 'POST' })
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(res.headers.get('content-security-policy')).toBeDefined()
  })

  it('handles CORS with allowed origin', async () => {
    vi.stubEnv('CORS_ORIGIN', 'http://example.com')
    await startServer()
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://example.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://example.com')
  })

  it('returns error for disallowed CORS origin', async () => {
    vi.stubEnv('CORS_ORIGIN', 'http://example.com')
    await startServer()
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    // Based on app.ts: callback(new Error('Not allowed by CORS'), false)
    // This typically results in a 500 error in Express if not handled
    expect(res.status).toBe(500)
  })

  it('allows all origins when CORS_ORIGIN is *', async () => {
    vi.stubEnv('CORS_ORIGIN', '*')
    await startServer()
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://anything.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    // When origin function returns true, cors reflects the request origin
    expect(res.headers.get('access-control-allow-origin')).toBe('http://anything.com')
  })

  it('supports multiple CORS origins', async () => {
    vi.stubEnv('CORS_ORIGIN', 'http://a.com, http://b.com')
    await startServer()
    const resA = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://a.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(resA.headers.get('access-control-allow-origin')).toBe('http://a.com')

    const resB = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://b.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(resB.headers.get('access-control-allow-origin')).toBe('http://b.com')
  })

  it('blocks CORS when CORS_ORIGIN is not set', async () => {
    await startServer()
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://any.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('enforces JSON body limit (100kb)', async () => {
    await startServer()
    // Create a body slightly larger than 100kb
    const largeData = 'a'.repeat(101 * 1024)
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'large', serverName: 'test', data: largeData })
    })
    expect(res.status).toBe(413) // Payload Too Large
  })

  it('serves static files from PAGES_DIR', async () => {
    const pagesPath = path.join(__dirname, 'fixtures', 'pages')
    vi.stubEnv('PAGES_DIR', pagesPath)
    await startServer()
    const res = await fetch(`${baseUrl}/index.html`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('hello world')
    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it('respects trust proxy setting', async () => {
    const app = createApp()
    app.get('/test-ip', (req, res) => {
      res.json({ ip: req.ip })
    })
    server = createServer(app)
    await new Promise<void>((resolve) => {
      server?.listen(0, () => {
        const addr = server?.address() as AddressInfo
        baseUrl = `http://127.0.0.1:${addr.port}`
        resolve()
      })
    })

    const res = await fetch(`${baseUrl}/test-ip`, {
      headers: { 'X-Forwarded-For': '1.2.3.4' }
    })
    const body = await res.json()
    expect(body.ip).toBe('1.2.3.4')
  })
})
