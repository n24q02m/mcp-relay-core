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

describe('POST /api/sessions security', () => {
  it('rejects overly large overall payload (100KB+)', async () => {
    const largeSchema = { data: 'a'.repeat(1024 * 120) } // 120KB schema -> larger than 100KB limit
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'large-payload', serverName: 'test', schema: largeSchema })
    })

    // express.json({ limit: '100kb' }) throws 413 Payload Too Large
    expect(res.status).toBe(413)
  })

  it('rejects overly large schema (64KB+) but under 100KB payload', async () => {
    const mediumSchema = { data: 'a'.repeat(1024 * 70) } // 70KB schema -> under 100KB limit, but over 64KB schema limit
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'medium-schema', serverName: 'test', schema: mediumSchema })
    })

    // Our custom validation returns 400
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('schema too large (max 64KB)')
  })
})
