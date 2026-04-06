import { describe, expect, it } from 'vitest'
import { tryOpenBrowser } from '../../src/relay/browser.js'

describe('tryOpenBrowser', () => {
  it('never throws', async () => {
    // tryOpenBrowser should never throw regardless of environment
    // On CI / headless, it will return false but must not throw
    const result = await tryOpenBrowser('https://example.com/test-never-throws')
    expect(typeof result).toBe('boolean')
  })

  it('returns a boolean', async () => {
    const result = await tryOpenBrowser('https://example.com/test-returns-boolean')
    expect(result === true || result === false).toBe(true)
  })
})
