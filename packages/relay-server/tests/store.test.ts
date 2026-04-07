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

  describe('IP Based Session Limits', () => {
    it('correctly increments and decrements IP counts on create and delete', () => {
      const ip = '1.2.3.4'
      // Create 10 sessions
      for (let i = 0; i < 10; i++) {
        expect(createSession(`s-${i}`, 'test', {}, ip)).not.toBeNull()
      }
      // 11th should fail
      expect(createSession('s-11', 'test', {}, ip)).toBeNull()

      // Delete one
      deleteSession('s-0')

      // Now 11th should succeed
      expect(createSession('s-11', 'test', {}, ip)).not.toBeNull()
    })

    it('overwriting a session ID when at the limit still fails (consistent with API tests)', () => {
      const ip = '1.2.3.4'
      // Fill up sessions to the limit
      for (let i = 0; i < 10; i++) {
        createSession(`s-${i}`, 'test', {}, ip)
      }

      // Attempt to overwrite an existing session ID from the same IP when at limit
      // Based on sessions.test.ts, this should return null/429
      expect(createSession('s-0', 'test-new', {}, ip)).toBeNull()
    })

    it('overwriting a session with the same ID correctly updates counts when under the limit', () => {
      const ip1 = '1.1.1.1'
      const ip2 = '2.2.2.2'

      createSession('shared-id', 'test', {}, ip1)

      // ip2 has 0 sessions, ip1 has 1
      expect(createSession('ip2-1', 'test', {}, ip2)).not.toBeNull()
      // ip2 has 1 session (ip2-1)

      // Overwrite 'shared-id' (currently ip1) with ip2
      expect(createSession('shared-id', 'test', {}, ip2)).not.toBeNull()

      // Now 'shared-id' should be ip2.
      // ip1 should have 0 sessions, ip2 should have 2 sessions.

      // Verify ip1 count is 0 by filling it up to 10
      for (let i = 0; i < 10; i++) {
        expect(createSession(`ip1-${i}`, 'test', {}, ip1)).not.toBeNull()
      }
      expect(createSession('ip1-extra', 'test', {}, ip1)).toBeNull()

      // Verify ip2 count is 2 (ip2-1 and shared-id)
      // We can add 8 more
      for (let i = 0; i < 8; i++) {
        expect(createSession(`ip2-extra-${i}`, 'test', {}, ip2)).not.toBeNull()
      }
      expect(createSession('ip2-too-many', 'test', {}, ip2)).toBeNull()
    })
  })
})
