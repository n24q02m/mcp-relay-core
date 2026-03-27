export interface SessionResult {
  browserPub: string
  ciphertext: string
  iv: string
  tag: string
}

export interface Session {
  id: string
  serverName: string
  schema: unknown
  result: SessionResult | null
  createdAt: number
  sourceIp: string
}

const SESSION_TTL_MS = 10 * 60 * 1000 // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000 // 60 seconds
const MAX_SESSIONS_PER_IP = 5

const sessions = new Map<string, Session>()
// ⚡ Bolt: O(1) lookup cache for IP rate limiting to prevent O(N) loops on every session creation
// Performance Impact: O(N) -> O(1) session creation time
const sessionCountsByIp = new Map<string, number>()
let cleanupTimer: ReturnType<typeof setInterval> | null = null

export function getSession(id: string): Session | undefined {
  const session = sessions.get(id)
  if (session && Date.now() - session.createdAt > SESSION_TTL_MS) {
    deleteSession(id)
    return undefined
  }
  return session
}

export function createSession(id: string, serverName: string, schema: unknown, sourceIp: string): Session | null {
  const ipCount = countSessionsByIp(sourceIp)
  if (ipCount >= MAX_SESSIONS_PER_IP) {
    return null
  }

  const session: Session = {
    id,
    serverName,
    schema,
    result: null,
    createdAt: Date.now(),
    sourceIp
  }
  const existing = sessions.get(id)
  if (existing) {
    // Edge case: overwrite same ID, decrement old IP
    const count = sessionCountsByIp.get(existing.sourceIp) ?? 0
    if (count <= 1) {
      sessionCountsByIp.delete(existing.sourceIp)
    } else {
      sessionCountsByIp.set(existing.sourceIp, count - 1)
    }
  }
  sessions.set(id, session)
  sessionCountsByIp.set(sourceIp, (sessionCountsByIp.get(sourceIp) ?? 0) + 1)
  return session
}

export function setSessionResult(id: string, result: SessionResult): boolean {
  const session = getSession(id)
  if (!session) return false
  if (session.result !== null) return false
  session.result = result
  return true
}

export function deleteSession(id: string): boolean {
  const session = sessions.get(id)
  if (!session) return false
  const count = sessionCountsByIp.get(session.sourceIp) ?? 0
  if (count <= 1) {
    sessionCountsByIp.delete(session.sourceIp)
  } else {
    sessionCountsByIp.set(session.sourceIp, count - 1)
  }
  return sessions.delete(id)
}

function countSessionsByIp(ip: string): number {
  return sessionCountsByIp.get(ip) ?? 0
}

function cleanup(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      deleteSession(id)
    }
  }
}

export function startCleanup(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS)
    cleanupTimer.unref?.()
  }
}

export function stopCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}

export function clearAllSessions(): void {
  sessions.clear()
  sessionCountsByIp.clear()
}
