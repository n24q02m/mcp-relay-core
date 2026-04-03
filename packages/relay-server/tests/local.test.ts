import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { startLocalRelay } from '../src/local.js'

describe('startLocalRelay', () => {
  it('starts a server and serves static files from the provided directory', async () => {
    const pagesDir = path.join(__dirname, 'fixtures', 'pages')
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true })
    }
    const testFilePath = path.join(pagesDir, 'test.txt')
    fs.writeFileSync(testFilePath, 'local relay test')

    const server = await startLocalRelay(pagesDir)

    expect(server).toBeDefined()
    expect(server.port).toBeGreaterThan(0)
    expect(server.url).toBe(`http://localhost:${server.port}`)
    expect(typeof server.close).toBe('function')

    const response = await fetch(`${server.url}/test.txt`)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('local relay test')

    server.close()

    fs.unlinkSync(testFilePath)
  })
})
