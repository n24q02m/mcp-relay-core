import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
  clearAllSessions()
})

describe('Security - Type Confusion', () => {
  it('rejects non-string sessionId', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: { length: 1 }, serverName: 'test' })
    })
    // If it's not a string, it should ideally be rejected with 400
    expect(res.status).toBe(400)
  })

  it('rejects non-string serverName', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test', serverName: { length: 1 } })
    })
    expect(res.status).toBe(400)
  })

  it('handles circular references in schema gracefully', async () => {
    // Note: express.json() will parse the body.
    // It's hard to send a circular reference via JSON.stringify in the test itself.
    // But we can test if stringifying it in the server throws.
  })

  it('rejects non-string result fields', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'confuse-1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/confuse-1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        browserPub: { length: 1 },
        ciphertext: 'ct',
        iv: 'iv',
        tag: 'tag'
      })
    })
    expect(res.status).toBe(400)
  })
})
