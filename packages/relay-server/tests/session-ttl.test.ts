import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllSessions, createSession, getSession, startCleanup, stopCleanup } from '../src/store.js'

describe('Session TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearAllSessions()
  })

  afterEach(() => {
    stopCleanup()
    vi.useRealTimers()
  })

  it('sessions expire after 10 minutes', () => {
    createSession('ttl-1', 'telegram', {}, '127.0.0.1')
    expect(getSession('ttl-1')).toBeDefined()

    // Advance 9 minutes - should still exist
    vi.advanceTimersByTime(9 * 60 * 1000)
    expect(getSession('ttl-1')).toBeDefined()

    // Advance past 10 minutes
    vi.advanceTimersByTime(2 * 60 * 1000)
    expect(getSession('ttl-1')).toBeUndefined()
  })

  it('cleanup runs every 60 seconds and removes expired sessions', () => {
    startCleanup()

    createSession('cleanup-1', 'telegram', {}, '127.0.0.1')

    // Advance 11 minutes (past TTL + multiple cleanup cycles)
    vi.advanceTimersByTime(11 * 60 * 1000)

    // After cleanup, session should be gone
    expect(getSession('cleanup-1')).toBeUndefined()
  })

  it('cleanup does not remove sessions within TTL', () => {
    startCleanup()

    createSession('alive-1', 'telegram', {}, '127.0.0.1')

    // Advance 2 cleanup cycles (120s) - well within 10 min TTL
    vi.advanceTimersByTime(2 * 60 * 1000)

    expect(getSession('alive-1')).toBeDefined()
  })
})
