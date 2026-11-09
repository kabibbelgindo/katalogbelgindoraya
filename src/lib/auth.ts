import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/hash'

const SECRET = process.env.AUTH_SECRET || 'belgindo-katalog-secret-2026'
export const SESSION_COOKIE = 'belgindo_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 hari

export { hashPassword, verifyPassword } from '@/lib/hash'

// ---------- Sesi (token HMAC di cookie httpOnly) ----------
function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function createSessionToken(userId: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, email, exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined): { uid: string; email: string } | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  if (sign(payload) !== sig) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!data.uid || typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return { uid: data.uid, email: data.email }
  } catch {
    return null
  }
}

/** Ambil admin yang sedang login (null bila tidak login). */
export async function getSessionUser() {
  const store = await cookies()
  const session = verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session) return null
  const user = await db.user.findFirst({
    where: { id: session.uid, active: true },
    select: { id: true, email: true, name: true, role: true },
  })
  return user
}

/** Guard untuk API mutasi: hanya admin yang boleh. */
export async function requireAdmin() {
  const user = await getSessionUser()
  if (!user) {
    throw new AuthError('Hanya administrator yang dapat melakukan perubahan.')
  }
  return user
}

export class AuthError extends Error {}
