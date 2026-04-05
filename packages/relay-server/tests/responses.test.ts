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

describe('Responses API', () => {
  it('stores and retrieves responses as an object', async () => {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test-resp', serverName: 'test' })
    })

    await fetch(`${baseUrl}/api/sessions/test-resp/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-1', value: 'val-1' })
    })

    await fetch(`${baseUrl}/api/sessions/test-resp/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-2', value: 'val-2' })
    })

    const res = await fetch(`${baseUrl}/api/sessions/test-resp/responses`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.responses).toEqual({
      'msg-1': 'val-1',
      'msg-2': 'val-2'
    })
  })
})
