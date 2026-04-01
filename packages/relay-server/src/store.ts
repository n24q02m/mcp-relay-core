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
    skipped: false,
    createdAt: Date.now(),
    sourceIp,
    messages: [],
    responses: []
  }
  sessions.set(id, session)
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
  return sessions.delete(id)
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

export function getResponses(id: string, messageId?: string): RelayResponse[] {
  const session = getSession(id)
  if (!session) return []
  if (messageId) {
    return session.responses.filter((r) => r.messageId === messageId)
  }
  return session.responses
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
