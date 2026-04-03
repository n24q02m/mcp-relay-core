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

describe('Security: Input Size Validation', () => {
  it('rejects oversized sessionId in POST /api/sessions', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'a'.repeat(300),
        serverName: 'test'
      })
    })
    // Currently this might pass (201) because there's no validation yet
    // We want it to be 400
    expect(res.status).toBe(400)
  })

  it('rejects oversized serverName in POST /api/sessions', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'test',
        serverName: 'a'.repeat(300)
      })
    })
    expect(res.status).toBe(400)
  })

  it('rejects oversized message text in POST /api/sessions/:id/messages', async () => {
    // Create session first
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/s1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'info',
        text: 'a'.repeat(20000) // > 10KB
      })
    })
    expect(res.status).toBe(400)
  })

  it('rejects oversized message data in POST /api/sessions/:id/messages', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/s1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'info',
        text: 'hello',
        data: { payload: 'a'.repeat(70000) } // > 64KB
      })
    })
    expect(res.status).toBe(400)
  })

  it('rejects oversized response value in POST /api/sessions/:id/responses', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/s1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: 'm1',
        value: 'a'.repeat(70000) // > 64KB
      })
    })
    expect(res.status).toBe(400)
  })

  it('rejects oversized result fields in POST /api/sessions/:id/result', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', serverName: 'test' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/s1/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        browserPub: 'a'.repeat(5000), // > 4KB
        ciphertext: 'ct',
        iv: 'iv',
        tag: 'tag'
      })
    })
    expect(res.status).toBe(400)
  })
})
