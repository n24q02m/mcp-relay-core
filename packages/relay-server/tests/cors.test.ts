import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'

let server: Server | undefined

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()))
    server = undefined
  }
  vi.unstubAllEnvs()
})

async function startServer() {
  const app = createApp()
  server = createServer(app)
  return new Promise<string>((resolve) => {
    server?.listen(0, () => {
      const addr = server?.address() as AddressInfo
      resolve(`http://127.0.0.1:${addr.port}`)
    })
  })
}

describe('CORS behavior', () => {
  it('defaults to blocking cross-origin requests when CORS_ORIGIN is unset', async () => {
    vi.stubEnv('CORS_ORIGIN', '')
    const url = await startServer()

    const res = await fetch(`${url}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('blocks * when CORS_ORIGIN=*', async () => {
    vi.stubEnv('CORS_ORIGIN', '*')
    const url = await startServer()

    const res = await fetch(`${url}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://anything.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows specific origin when CORS_ORIGIN is set', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://example.com')
    const url = await startServer()

    const res = await fetch(`${url}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBe('https://example.com')

    const res2 = await fetch(`${url}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res2.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows multiple origins when CORS_ORIGIN is comma-separated', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://example.com, https://app.example.com')
    const url = await startServer()

    const res = await fetch(`${url}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
  })
})
