import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { clearAllSessions } from '../src/store.js'

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

describe('Security Validations', () => {
  it('should reject non-string sessionId or serverName', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 123, serverName: 'test' })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('sessionId and serverName are required strings')
  })

  it('should reject oversized sessionId', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'a'.repeat(257), serverName: 'test' })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('sessionId too long (max 256 chars)')
  })

  it('should reject oversized schema', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'test',
        serverName: 'test',
        schema: { data: 'a'.repeat(70000) }
      })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('schema too large (max 64KB)')
  })

  it('should reject non-string result fields', async () => {
    // Create a session first
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/s1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        browserPub: 'pub',
        ciphertext: 'ct',
        iv: 'iv',
        tag: 123
      })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('browserPub, ciphertext, iv, and tag are required strings')
  })

  it('should reject non-string message fields', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/s1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'info', text: 123 })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('type and text are required strings')
  })

  it('should reject invalid message type', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/s1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invalid', text: 'hello' })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid message type')
  })

  it('should reject non-string response fields', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/s1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'm1', value: 123 })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('messageId and value are required strings')
  })
})
