import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

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
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }
  delete process.env.CORS_ORIGIN
})

describe('CORS', () => {
  it('blocks all origins when CORS_ORIGIN is * (new behavior)', async () => {
    process.env.CORS_ORIGIN = '*'
    baseUrl = await startServer()

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('blocks all origins when CORS_ORIGIN is not set', async () => {
    process.env.CORS_ORIGIN = ''
    baseUrl = await startServer()

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows specific origins when CORS_ORIGIN is set', async () => {
    process.env.CORS_ORIGIN = 'http://trusted.com, http://another.com'
    baseUrl = await startServer()

    const res1 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://trusted.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res1.headers.get('access-control-allow-origin')).toBe('http://trusted.com')

    const res2 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://another.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res2.headers.get('access-control-allow-origin')).toBe('http://another.com')

    const res3 = await fetch(`${baseUrl}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
    expect(res3.headers.get('access-control-allow-origin')).toBeNull()
  })
})
