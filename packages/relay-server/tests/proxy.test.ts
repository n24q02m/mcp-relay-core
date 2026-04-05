import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('Trust proxy configuration', () => {
  const originalEnv = process.env.TRUST_PROXY

  afterEach(() => {
    process.env.TRUST_PROXY = originalEnv
  })

  it('defaults to 1 if TRUST_PROXY is not set', () => {
    delete process.env.TRUST_PROXY
    const app = createApp()
    expect(app.get('trust proxy')).toBe(1)
  })

  it('sets trust proxy to true if TRUST_PROXY is "true"', () => {
    process.env.TRUST_PROXY = 'true'
    const app = createApp()
    expect(app.get('trust proxy')).toBe(true)
  })

  it('sets trust proxy to false if TRUST_PROXY is "false"', () => {
    process.env.TRUST_PROXY = 'false'
    const app = createApp()
    expect(app.get('trust proxy')).toBe(false)
  })

  it('sets trust proxy to a number if TRUST_PROXY is a numeric string', () => {
    process.env.TRUST_PROXY = '2'
    const app = createApp()
    expect(app.get('trust proxy')).toBe(2)
  })

  it('sets trust proxy to a comma-separated list if TRUST_PROXY contains commas', () => {
    process.env.TRUST_PROXY = '127.0.0.1, 10.0.0.1'
    const app = createApp()
    expect(app.get('trust proxy')).toEqual(['127.0.0.1', '10.0.0.1'])
  })

  it('sets trust proxy to a string if TRUST_PROXY is any other string', () => {
    process.env.TRUST_PROXY = 'loopback'
    const app = createApp()
    expect(app.get('trust proxy')).toBe('loopback')
  })
})
