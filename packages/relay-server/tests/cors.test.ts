import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'

let server: Server
let baseUrl: string

async function startServer() {
  const app = createApp()
  server = createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as AddressInfo
      baseUrl = `http://127.0.0.1:${addr.port}`
      resolve()
    })
  })
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }
  vi.unstubAllEnvs()
})

describe('CORS configuration', () => {
  it('defaults to no CORS headers when CORS_ORIGIN is not set', async () => {
    vi.stubEnv('CORS_ORIGIN', '')
    await startServer()

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows a single origin when CORS_ORIGIN is set', async () => {
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

    const res2 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res2.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows multiple origins when CORS_ORIGIN is comma-separated', async () => {
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

    const resC = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://c.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(resC.headers.get('access-control-allow-origin')).toBeNull()
  })
})
