'use client'

/**
 * Konfigurasi Firebase (Auth login admin) — PT. Belgindo Raya.
 *
 * Config web Firebase bersifat publik (identifikasi proyek, bukan rahasia)
 * sesuai dokumentasi Firebase. Nilai diambil dari .env.local agar mudah
 * diganti tanpa menyentuh kode.
 *
 * Data katalog TETAP di PostgreSQL terpusat — Firebase hanya dipakai
 * untuk autentikasi login administrator.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
}

/** True bila config Firebase lengkap (fitur login Firebase aktif). */
export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
)

/** Terjemahan pesan error Firebase Auth ke bahasa Indonesia. */
export function pesanFirebase(code: string): string {
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Email atau password Firebase salah.'
  if (code.includes('operation-not-allowed'))
    return 'Metode Email/Password belum diaktifkan di konsol Firebase (Authentication → Sign-in method).'
  if (code.includes('too-many-requests'))
    return 'Terlalu banyak percobaan gagal. Tunggu beberapa menit lalu coba lagi.'
  if (code.includes('network-request-failed'))
    return 'Tidak dapat menghubungi Firebase. Periksa koneksi internet kantor.'
  if (code.includes('invalid-email')) return 'Format email tidak valid.'
  return 'Login Firebase gagal (' + code + ').'
}

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

let analyticsInited = false

/** Analytics diinisialisasi malas, hanya di browser yang mendukung (tanpa SSR error). */
export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsInited || typeof window === 'undefined') return null
  if (!firebaseEnabled || !firebaseConfig.measurementId) return null
  analyticsInited = true
  try {
    if (await isSupported()) {
      return getAnalytics(getFirebaseApp())
    }
  } catch {
    // Analytics gagal (mis. diblokir) tidak boleh mengganggu aplikasi.
  }
  return null
}
