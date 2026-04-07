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
  it('defaults to restrictive (no CORS headers) when CORS_ORIGIN is unset', async () => {
    vi.stubEnv('CORS_ORIGIN', '') // Ensure it's empty/unset
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

  it('allows all origins when CORS_ORIGIN is *', async () => {
    vi.stubEnv('CORS_ORIGIN', '*')
    await startServer()

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://example.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('allows specific origins when CORS_ORIGIN is set to a list', async () => {
    vi.stubEnv('CORS_ORIGIN', 'http://allowed.com, http://another.com')
    await startServer()

    const res1 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://allowed.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res1.headers.get('access-control-allow-origin')).toBe('http://allowed.com')

    const res2 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res2.headers.get('access-control-allow-origin')).toBeNull()
  })
})
