import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'

describe('CORS configuration', () => {
  let server: Server
  let baseUrl: string

  const startServer = async () => {
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
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
    vi.unstubAllEnvs()
  })

  it('should block CORS by default (when CORS_ORIGIN is unset)', async () => {
    vi.stubEnv('CORS_ORIGIN', '')
    await startServer()

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'GET',
      headers: { Origin: 'http://malicious.com' }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('should block CORS when CORS_ORIGIN is set to *', async () => {
    vi.stubEnv('CORS_ORIGIN', '*')
    await startServer()

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'GET',
      headers: { Origin: 'http://any-origin.com' }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('should allow multiple origins when CORS_ORIGIN is a comma-separated list', async () => {
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:3000,http://example.com')
    await startServer()

    const res1 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'GET',
      headers: { Origin: 'http://localhost:3000' }
    })
    expect(res1.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')

    const res2 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'GET',
      headers: { Origin: 'http://example.com' }
    })
    expect(res2.headers.get('access-control-allow-origin')).toBe('http://example.com')

    const res3 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'GET',
      headers: { Origin: 'http://malicious.com' }
    })
    expect(res3.headers.get('access-control-allow-origin')).toBeNull()
  })
})
