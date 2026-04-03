import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllSessions, createSession, deleteSession, getSession } from '../src/store.js'

describe('Store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearAllSessions()
  })

  afterEach(() => {
    clearAllSessions()
    vi.useRealTimers()
  })

  describe('countSessionsByIp', () => {
    it('accurately counts sessions for an IP after they expire but before background cleanup', () => {
      const ip = '127.0.0.1'
      const SESSION_TTL_MS = 10 * 60 * 1000

      // Create 10 sessions
      for (let i = 0; i < 10; i++) {
        createSession(`session-${i}`, 'test-server', {}, ip)
      }

      // 11th should fail
      expect(createSession('session-11', 'test-server', {}, ip)).toBeNull()

      // Advance time past TTL
      vi.advanceTimersByTime(SESSION_TTL_MS + 1000)

      // 11th should now SUCCEED because opportunistic cleanup happens during countSessionsByIp
      const session = createSession('session-11', 'test-server', {}, ip)
      expect(session).not.toBeNull()
      expect(session?.id).toBe('session-11')
    })
  })

  describe('deleteSession', () => {
    it('deletes an existing session', () => {
      const sessionId = 'test-delete-1'
      createSession(sessionId, 'test-server', {}, '127.0.0.1')

      expect(getSession(sessionId)).toBeDefined()

      const result = deleteSession(sessionId)
      expect(result).toBe(true)

      expect(getSession(sessionId)).toBeUndefined()
    })

    it('returns false when deleting a non-existent session', () => {
      const result = deleteSession('non-existent-session')
      expect(result).toBe(false)
    })
  })
})
