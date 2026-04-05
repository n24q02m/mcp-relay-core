import type { Request, Response } from 'express'
import { Router } from 'express'
import type { RelayMessage } from '../store.js'
import {
  addMessage,
  addResponse,
  createSession,
  deleteSession,
  getMessages,
  getResponses,
  getSession,
  setSessionResult,
  skipSession
} from '../store.js'

function paramId(req: Request): string {
  const id = req.params.id
  return Array.isArray(id) ? id[0] : id
}

export const sessionsRouter: ReturnType<typeof Router> = Router()

sessionsRouter.post('/', (req: Request, res: Response) => {
  const { sessionId, serverName, schema } = req.body as {
    sessionId?: unknown
    serverName?: unknown
    schema?: unknown
  }

  if (typeof sessionId !== 'string' || typeof serverName !== 'string') {
    res.status(400).json({ error: 'sessionId and serverName are required strings' })
    return
  }

  if (sessionId.length > 256) {
    res.status(400).json({ error: 'sessionId too long (max 256 chars)' })
    return
  }

  if (serverName.length > 256) {
    res.status(400).json({ error: 'serverName too long (max 256 chars)' })
    return
  }

  if (schema !== undefined) {
    try {
      if (JSON.stringify(schema).length > 65536) {
        res.status(400).json({ error: 'schema too large (max 64KB)' })
        return
      }
    } catch {
      res.status(400).json({ error: 'invalid schema' })
      return
    }
  }

  const sourceIp = req.ip ?? req.socket.remoteAddress ?? 'unknown'
  const session = createSession(sessionId, serverName, schema, sourceIp)

  if (!session) {
    res.status(429).json({ error: 'Too many active sessions for this IP' })
    return
  }

  res.status(201).json({ sessionId: session.id })
})

sessionsRouter.get('/:id', (req: Request, res: Response) => {
  const session = getSession(paramId(req))

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  if (session.skipped) {
    res.status(200).json({ status: 'skipped' })
    return
  }

  if (session.result === null) {
    res
      .status(202)
      .json({ status: 'pending', sessionId: session.id, serverName: session.serverName, schema: session.schema })
    return
  }

  res.status(200).json({ status: 'ready', result: session.result })
})

sessionsRouter.post('/:id/result', (req: Request, res: Response) => {
  const { browserPub, ciphertext, iv, tag } = req.body as {
    browserPub?: unknown
    ciphertext?: unknown
    iv?: unknown
    tag?: unknown
  }

  if (
    typeof browserPub !== 'string' ||
    typeof ciphertext !== 'string' ||
    typeof iv !== 'string' ||
    typeof tag !== 'string'
  ) {
    res.status(400).json({ error: 'browserPub, ciphertext, iv, and tag are required strings' })
    return
  }

  if (browserPub.length > 4096 || ciphertext.length > 4096 || iv.length > 4096 || tag.length > 4096) {
    res.status(400).json({ error: 'result field(s) too large (max 4KB each)' })
    return
  }

  const session = getSession(paramId(req))
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  const success = setSessionResult(paramId(req), { browserPub, ciphertext, iv, tag })
  if (!success) {
    res.status(409).json({ error: 'Result already submitted' })
    return
  }

  res.status(200).json({ ok: true })
})

sessionsRouter.post('/:id/skip', (req: Request, res: Response) => {
  const session = getSession(paramId(req))
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  const success = skipSession(paramId(req))
  if (!success) {
    res.status(409).json({ error: 'Session already has a result or is already skipped' })
    return
  }

  res.status(200).json({ ok: true })
})

// Server pushes a message to the browser
sessionsRouter.post('/:id/messages', (req: Request, res: Response) => {
  const { type, text, data } = req.body as {
    type?: unknown
    text?: unknown
    data?: unknown
  }

  if (typeof type !== 'string' || typeof text !== 'string') {
    res.status(400).json({ error: 'type and text are required strings' })
    return
  }

  const validTypes: RelayMessage['type'][] = ['info', 'oauth_device_code', 'input_required', 'complete', 'error']
  if (!validTypes.includes(type as RelayMessage['type'])) {
    res.status(400).json({ error: 'invalid message type' })
    return
  }

  if (text.length > 10240) {
    res.status(400).json({ error: 'text too long (max 10KB)' })
    return
  }

  if (data !== undefined) {
    try {
      if (JSON.stringify(data).length > 65536) {
        res.status(400).json({ error: 'data too large (max 64KB)' })
        return
      }
    } catch {
      res.status(400).json({ error: 'invalid data' })
      return
    }
  }

  const session = getSession(paramId(req))
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  const messageId = crypto.randomUUID()
  const message: RelayMessage = {
    id: messageId,
    type: type as RelayMessage['type'],
    text,
    data: data as Record<string, unknown>
  }
  const success = addMessage(paramId(req), message)
  if (!success) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  res.status(201).json({ id: messageId })
})

// Browser polls for messages from server
sessionsRouter.get('/:id/messages', (req: Request, res: Response) => {
  const session = getSession(paramId(req))
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  const after = Number.parseInt(req.query.after as string, 10)
  const afterIndex = Number.isNaN(after) ? 0 : after
  const messages = getMessages(paramId(req), afterIndex)
  res.status(200).json({ messages })
})

// Browser sends a response to a message
sessionsRouter.post('/:id/responses', (req: Request, res: Response) => {
  const { messageId, value } = req.body as {
    messageId?: unknown
    value?: unknown
  }

  if (typeof messageId !== 'string' || typeof value !== 'string') {
    res.status(400).json({ error: 'messageId and value are required strings' })
    return
  }

  if (messageId.length > 256) {
    res.status(400).json({ error: 'messageId too long (max 256 chars)' })
    return
  }

  if (value.length > 65536) {
    res.status(400).json({ error: 'value too large (max 64KB)' })
    return
  }

  const session = getSession(paramId(req))
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  const success = addResponse(paramId(req), { messageId, value })
  if (!success) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  res.status(200).json({ ok: true })
})

// Server polls for responses from browser
sessionsRouter.get('/:id/responses', (req: Request, res: Response) => {
  const session = getSession(paramId(req))
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  const responses = getResponses(paramId(req))
  res.status(200).json({ responses })
})

sessionsRouter.delete('/:id', (req: Request, res: Response) => {
  deleteSession(paramId(req))
  res.status(204).send()
})
