import type { AddressInfo } from 'node:net'
import express from 'express'
import { createApp } from './app.js'

export async function startLocalRelay(pagesDir: string): Promise<{ port: number; url: string; close: () => void }> {
  // Allow all CORS for local test relay server
  process.env.CORS_ORIGIN = '*'
  const app = createApp()
  app.use(express.static(pagesDir))

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address() as AddressInfo
      resolve({
        port: addr.port,
        url: `http://localhost:${addr.port}`,
        close: () => server.close()
      })
    })
  })
}
