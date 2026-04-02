import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { clearAllSessions, getSession } from '../src/store.js'

describe('Proxy trust configuration', () => {
  let server: Server
  let baseUrl: string

  async function startServer() {
    const app = createApp()
    server = createServer(app)
    return new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo
        baseUrl = `http://127.0.0.1:${addr.port}`
        resolve()
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

  it('ignores X-Forwarded-For when TRUST_PROXY is not set', async () => {
    vi.stubEnv('TRUST_PROXY', '')
    await startServer()

    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '1.2.3.4'
      },
      body: JSON.stringify({ sessionId: 'test-proxy-1', serverName: 'test', schema: {} })
    })

    const session = getSession('test-proxy-1')
    // CURRENTLY this will FAIL because it is hardcoded to trust proxy 1
    expect(session?.sourceIp).not.toBe('1.2.3.4')
    expect(session?.sourceIp).toBe('127.0.0.1')
  })

  it('respects X-Forwarded-For when TRUST_PROXY is set', async () => {
    vi.stubEnv('TRUST_PROXY', '1')
    await startServer()

    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '1.2.3.4'
      },
      body: JSON.stringify({ sessionId: 'test-proxy-2', serverName: 'test', schema: {} })
    })

    const session = getSession('test-proxy-2')
    expect(session?.sourceIp).toBe('1.2.3.4')
  })
})
