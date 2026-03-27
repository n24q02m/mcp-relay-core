import type { Request, Response } from 'express'
import { Router } from 'express'
import { createSession, deleteSession, getSession, setSessionResult, skipSession } from '../store.js'

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

sessionsRouter.delete('/:id', (req: Request, res: Response) => {
  deleteSession(paramId(req))
  res.status(204).send()
})
