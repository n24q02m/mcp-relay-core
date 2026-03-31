import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

let server: Server
let baseUrl: string

async function startApp(corsOriginEnv?: string) {
  if (corsOriginEnv !== undefined) {
    process.env.CORS_ORIGIN = corsOriginEnv
  } else {
    delete process.env.CORS_ORIGIN
  }

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
})

describe('CORS Configuration', () => {
  it('blocks cross-origin requests by default (no env var)', async () => {
    await startApp()
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows all origins when CORS_ORIGIN is *', async () => {
    await startApp('*')
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('allows specific origin when CORS_ORIGIN is a single domain', async () => {
    await startApp('https://trusted.com')

    // Allowed origin
    const res1 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://trusted.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res1.headers.get('access-control-allow-origin')).toBe('https://trusted.com')

    // Disallowed origin
    const res2 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res2.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows multiple specific origins when CORS_ORIGIN is a comma-separated list', async () => {
    await startApp('https://trusted.com, http://localhost:3000')

    // Allowed origin 1
    const res1 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://trusted.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res1.headers.get('access-control-allow-origin')).toBe('https://trusted.com')

    // Allowed origin 2
    const res2 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res2.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')

    // Disallowed origin
    const res3 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res3.headers.get('access-control-allow-origin')).toBeNull()
  })
})
