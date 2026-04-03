import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { clearAllSessions, getSession } from '../src/store.js'

let server: Server
let baseUrl: string

beforeAll(async () => {
  const app = createApp()
  server = createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as AddressInfo
      baseUrl = `http://127.0.0.1:${addr.port}`
      resolve()
    })
  })
})

afterEach(() => {
  clearAllSessions()
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
})

describe('POST /api/sessions', () => {
  it('creates a session and returns 201', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test-1', serverName: 'telegram', schema: { token: 'string' } })
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.sessionId).toBe('test-1')
  })

  it('rejects after 10 sessions from the same IP (429)', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: `s-${i}`, serverName: 'telegram', schema: {} })
      })
      expect(res.status).toBe(201)
    }

    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's-6', serverName: 'telegram', schema: {} })
    })
    expect(res.status).toBe(429)
  })

  it('returns 400 when sessionId or serverName is missing', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test-bad' })
    })
    expect(res.status).toBe(400)
  })

  it('respects X-Forwarded-For when trust proxy is enabled', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.100'
      },
      body: JSON.stringify({ sessionId: 'proxy-1', serverName: 'telegram', schema: {} })
    })
    expect(res.status).toBe(201)

    const session = getSession('proxy-1')
    expect(session?.sourceIp).toBe('192.168.1.100')
  })
})

describe('GET /api/sessions/:id', () => {
  it('returns 202 when session is pending', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'pending-1', serverName: 'telegram', schema: {} })
    })

    const res = await fetch(`${baseUrl}/api/sessions/pending-1`)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.status).toBe('pending')
    expect(body.serverName).toBe('telegram')
  })

  it('returns 200 with result when ready', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'ready-1', serverName: 'telegram', schema: {} })
    })

    await fetch(`${baseUrl}/api/sessions/ready-1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserPub: 'pub', ciphertext: 'ct', iv: 'iv', tag: 'tag' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/ready-1`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ready')
    expect(body.result.ciphertext).toBe('ct')
  })

  it('returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/nonexistent`)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/sessions/:id/result', () => {
  it('stores result (200)', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'res-1', serverName: 'telegram', schema: {} })
    })

    const res = await fetch(`${baseUrl}/api/sessions/res-1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserPub: 'pub', ciphertext: 'ct', iv: 'iv', tag: 'tag' })
    })
    expect(res.status).toBe(200)
  })

  it('rejects second submission with 409 (one-shot)', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'oneshot-1', serverName: 'telegram', schema: {} })
    })

    await fetch(`${baseUrl}/api/sessions/oneshot-1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserPub: 'pub', ciphertext: 'ct', iv: 'iv', tag: 'tag' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/oneshot-1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserPub: 'pub2', ciphertext: 'ct2', iv: 'iv2', tag: 'tag2' })
    })
    expect(res.status).toBe(409)
  })

  it('returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/nonexistent/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserPub: 'pub', ciphertext: 'ct', iv: 'iv', tag: 'tag' })
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields are missing', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'bad-res-1', serverName: 'telegram', schema: {} })
    })

    const res = await fetch(`${baseUrl}/api/sessions/bad-res-1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserPub: 'pub' })
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/sessions/:id', () => {
  it('removes session (204)', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'del-1', serverName: 'telegram', schema: {} })
    })

    const res = await fetch(`${baseUrl}/api/sessions/del-1`, { method: 'DELETE' })
    expect(res.status).toBe(204)

    const getRes = await fetch(`${baseUrl}/api/sessions/del-1`)
    expect(getRes.status).toBe(404)
  })
})
