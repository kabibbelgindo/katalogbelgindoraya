/**
 * Menjalankan server produksi (hasil `next build` standalone)
 * sambil memuat file .env dari folder proyek, lintas-platform.
 * Dipakai oleh `npm run start`.
 */
import pkg from '@next/env'

// Muat .env / .env.local / .env.production dari folder proyek (cwd)
const { loadEnvConfig } = pkg
loadEnvConfig(process.cwd())

await import('../.next/standalone/server.js')
