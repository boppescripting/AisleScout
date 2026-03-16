import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'

// Derive a stateless token from the password — changing APP_PASSWORD invalidates all sessions
function deriveToken(password: string): string {
  return crypto.createHmac('sha256', password).update('aisles-auth').digest('hex')
}

export function getExpectedToken(): string | null {
  const pw = process.env.APP_PASSWORD
  if (!pw) return null
  return deriveToken(pw)
}

export function loginHandler(req: Request, res: Response) {
  const appPassword = process.env.APP_PASSWORD
  if (!appPassword) {
    // Auth disabled — hand back a sentinel token
    return res.json({ token: 'no-auth' })
  }
  const { password } = req.body
  if (!password) return res.status(401).json({ error: 'Password required' })

  const provided = Buffer.from(deriveToken(password), 'utf8')
  const expected = Buffer.from(deriveToken(appPassword), 'utf8')

  // Constant-time compare to avoid timing attacks
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Invalid password' })
  }
  res.json({ token: deriveToken(appPassword) })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const expected = getExpectedToken()
  if (!expected) return next() // APP_PASSWORD not set → open access

  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const providedBuf = Buffer.from(token, 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}
