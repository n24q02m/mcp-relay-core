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

describe('Security Validation (Type and Structure)', () => {
  it('rejects non-string sessionId (400)', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 123, serverName: 'test' })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('must be strings')
  })

  it('rejects non-object schema (400)', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test', serverName: 'test', schema: 'bad' })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('must be a plain object')
  })

  it('rejects array schema (400)', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test', serverName: 'test', schema: [] })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('must be a plain object')
  })

  it('rejects non-string result fields (400)', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'type-1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/type-1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserPub: 123, ciphertext: 'ct', iv: 'iv', tag: 'tag' })
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('must be strings')
  })
})
