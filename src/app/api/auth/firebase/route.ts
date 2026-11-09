import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE, createSessionToken } from '@/lib/auth'

/**
 * LOGIN VIA FIREBASE AUTH (admin)
 *
 * Alur: browser login ke Firebase (signInWithEmailAndPassword) → dapat
 * idToken → dikirim ke sini → server memverifikasi token ke Google
 * (Identity Toolkit accounts:lookup) → pastikan email terdaftar sebagai
 * admin aktif di tabel User (PostgreSQL tetap sumber kebenaran) →
 * terbitkan cookie sesi yang sama dengan login lokal.
 */

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''

interface LookupResponse {
  users?: { email?: string; emailVerified?: boolean; disabled?: boolean }[]
  error?: { message?: string }
}

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Token Firebase tidak ditemukan.' }, { status: 400 })
    }
    if (!API_KEY) {
      return NextResponse.json(
        { error: 'Konfigurasi Firebase server belum diisi (.env.local).' },
        { status: 500 }
      )
    }

    // Verifikasi token ke Google — sumber kebenaran keabsahan sesi Firebase.
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      }
    )
    const data = (await r.json()) as LookupResponse
    if (!r.ok || !data.users?.length) {
      const msg = data.error?.message?.includes('INVALID_ID_TOKEN')
        ? 'Sesi Firebase tidak valid atau sudah kedaluwarsa. Coba masuk lagi.'
        : 'Verifikasi Firebase gagal. Coba lagi atau gunakan Masuk Lokal.'
      return NextResponse.json({ error: msg }, { status: 401 })
    }

    const email = data.users[0].email?.toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Akun Firebase tanpa email tidak dapat dipakai.' }, { status: 401 })
    }

    // Admin harus terdaftar & aktif di database katalog.
    const user = await db.user.findFirst({ where: { email, active: true } })
    if (!user) {
      return NextResponse.json(
        { error: `${email} tidak terdaftar sebagai administrator katalog.` },
        { status: 403 }
      )
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      firebase: true,
    })
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
