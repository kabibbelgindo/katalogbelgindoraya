import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE, createSessionToken, verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 })
    }
    const user = await db.user.findFirst({ where: { email: String(email).toLowerCase(), active: true } })
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 })
    }
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.email), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }
}
