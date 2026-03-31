import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAllSessions, createSession, deleteSession, getSession } from '../src/store.js'

describe('Store', () => {
  beforeEach(() => {
    clearAllSessions()
  })

  afterEach(() => {
    clearAllSessions()
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
