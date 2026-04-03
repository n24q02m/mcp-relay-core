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
    sessionId?: string
    serverName?: string
    schema?: unknown
  }

  if (!sessionId || !serverName) {
    res.status(400).json({ error: 'sessionId and serverName are required' })
    return
  }

  if (schema !== undefined && JSON.stringify(schema).length > 65536) {
    res.status(400).json({ error: 'schema too large (max 64KB)' })
    return
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
    browserPub?: string
    ciphertext?: string
    iv?: string
    tag?: string
  }

  if (!browserPub || !ciphertext || !iv || !tag) {
    res.status(400).json({ error: 'browserPub, ciphertext, iv, and tag are required' })
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
    type?: RelayMessage['type']
    text?: string
    data?: Record<string, unknown>
  }

  if (!type || !text) {
    res.status(400).json({ error: 'type and text are required' })
    return
  }

  const session = getSession(paramId(req))
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }

  const messageId = crypto.randomUUID()
  const message: RelayMessage = { id: messageId, type, text, data }
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
    messageId?: string
    value?: string
  }

  if (!messageId || value === undefined) {
    res.status(400).json({ error: 'messageId and value are required' })
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

  const responses = getResponses(paramId(req), req.query.messageId as string)
  res.status(200).json({ responses })
})

sessionsRouter.delete('/:id', (req: Request, res: Response) => {
  deleteSession(paramId(req))
  res.status(204).send()
})
