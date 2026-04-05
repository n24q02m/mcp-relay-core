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

describe('Store IP Counting', () => {
  beforeEach(() => {
    clearAllSessions()
  })

  afterEach(() => {
    clearAllSessions()
  })

  it('limits sessions per IP', () => {
    const ip = '1.2.3.4'
    for (let i = 0; i < 10; i++) {
      const session = createSession(`s${i}`, 'test', {}, ip)
      expect(session).not.toBeNull()
    }
    const extraSession = createSession('extra', 'test', {}, ip)
    expect(extraSession).toBeNull()
  })

  it('decrements count when session is deleted', () => {
    const ip = '1.2.3.4'
    for (let i = 0; i < 10; i++) {
      createSession(`s${i}`, 'test', {}, ip)
    }
    expect(createSession('extra', 'test', {}, ip)).toBeNull()

    deleteSession('s0')
    const session = createSession('extra', 'test', {}, ip)
    expect(session).not.toBeNull()
  })

  it('does not leak count when overwriting session with same ID', () => {
    const ip = '1.2.3.4'
    for (let i = 0; i < 10; i++) {
      createSession('same-id', 'test', {}, ip)
    }
    // If it leaks, the count will be 10 and next one will fail.
    const session = createSession('new-id', 'test', {}, ip)
    expect(session, 'Should not leak count when overwriting session').not.toBeNull()
  })

  it('counts sessions per IP independently', () => {
    const ip1 = '1.1.1.1'
    const ip2 = '2.2.2.2'
    for (let i = 0; i < 10; i++) {
      createSession(`ip1-s${i}`, 'test', {}, ip1)
    }
    expect(createSession('ip1-extra', 'test', {}, ip1)).toBeNull()
    expect(createSession('ip2-s0', 'test', {}, ip2)).not.toBeNull()
  })
})
