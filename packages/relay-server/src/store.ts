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
let cleanupTimer: ReturnType<typeof setInterval> | null = null

export function getSession(id: string): Session | undefined {
  const session = sessions.get(id)
  if (session && Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(id)
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
  sessions.set(id, session)
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
  return sessions.delete(id)
}

function countSessionsByIp(ip: string): number {
  const now = Date.now()
  let count = 0
  for (const session of sessions.values()) {
    if (session.sourceIp === ip && now - session.createdAt <= SESSION_TTL_MS) {
      count++
    }
  }
  return count
}

function cleanup(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id)
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
}
