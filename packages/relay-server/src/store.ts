export interface SessionResult {
  browserPub: string
  ciphertext: string
  iv: string
  tag: string
}

export interface RelayMessage {
  id: string
  type: 'info' | 'oauth_device_code' | 'input_required' | 'complete' | 'error'
  text: string
  data?: Record<string, unknown>
}

export interface RelayResponse {
  messageId: string
  value: string
}

export interface Session {
  id: string
  serverName: string
  schema: unknown
  result: SessionResult | null
  skipped: boolean
  createdAt: number
  sourceIp: string
  messages: RelayMessage[]
  responses: RelayResponse[]
}

const SESSION_TTL_MS = 10 * 60 * 1000 // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000 // 60 seconds
const MAX_SESSIONS_PER_IP = 10
const MAX_MESSAGES_PER_SESSION = 50
const MAX_RESPONSES_PER_SESSION = 50

const sessions = new Map<string, Session>()
const sessionsByIp = new Map<string, Set<string>>()
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function removeFromIpIndex(ip: string, sessionId: string): void {
  const ipSessions = sessionsByIp.get(ip)
  if (ipSessions) {
    ipSessions.delete(sessionId)
    if (ipSessions.size === 0) {
      sessionsByIp.delete(ip)
    }
  }
}

function addToIpIndex(ip: string, sessionId: string): void {
  let ipSessions = sessionsByIp.get(ip)
  if (!ipSessions) {
    ipSessions = new Set()
    sessionsByIp.set(ip, ipSessions)
  }
  ipSessions.add(sessionId)
}

export function getSession(id: string): Session | undefined {
  const session = sessions.get(id)
  if (session && Date.now() - session.createdAt > SESSION_TTL_MS) {
    removeFromIpIndex(session.sourceIp, id)
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
    skipped: false,
    createdAt: Date.now(),
    sourceIp,
    messages: [],
    responses: []
  }
  sessions.set(id, session)
  addToIpIndex(sourceIp, id)
  return session
}

export function setSessionResult(id: string, result: SessionResult): boolean {
  const session = getSession(id)
  if (!session) return false
  if (session.result !== null) return false
  if (session.skipped) return false
  session.result = result
  return true
}

export function skipSession(id: string): boolean {
  const session = getSession(id)
  if (!session) return false
  if (session.result !== null) return false
  if (session.skipped) return false
  session.skipped = true
  return true
}

export function deleteSession(id: string): boolean {
  const session = sessions.get(id)
  if (session) {
    removeFromIpIndex(session.sourceIp, id)
    return sessions.delete(id)
  }
  return false
}

export function addMessage(id: string, message: RelayMessage): boolean {
  const session = getSession(id)
  if (!session) return false
  if (session.messages.length >= MAX_MESSAGES_PER_SESSION) return false
  session.messages.push(message)
  return true
}

export function getMessages(id: string, afterIndex?: number): RelayMessage[] {
  const session = getSession(id)
  if (!session) return []
  const start = afterIndex ?? 0
  return session.messages.slice(start)
}

export function addResponse(id: string, response: RelayResponse): boolean {
  const session = getSession(id)
  if (!session) return false
  if (session.responses.length >= MAX_RESPONSES_PER_SESSION) return false
  session.responses.push(response)
  return true
}

export function getResponses(id: string): RelayResponse[] {
  const session = getSession(id)
  if (!session) return []
  return session.responses
}

function countSessionsByIp(ip: string): number {
  const ipSessions = sessionsByIp.get(ip)
  if (!ipSessions) return 0

  const now = Date.now()
  let count = 0
  for (const sessionId of ipSessions) {
    const session = sessions.get(sessionId)
    if (!session || now - session.createdAt > SESSION_TTL_MS) {
      // Opportunistic cleanup
      ipSessions.delete(sessionId)
      if (session) {
        sessions.delete(sessionId)
      }
    } else {
      count++
    }
  }

  if (ipSessions.size === 0) {
    sessionsByIp.delete(ip)
  }

  return count
}

function cleanup(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      removeFromIpIndex(session.sourceIp, id)
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
  sessionsByIp.clear()
}
