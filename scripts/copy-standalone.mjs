/**
 * Menyalin berkas statis ke folder standalone setelah `next build`
 * (lintas-platform: Windows/Linux/macOS).
 * Dipanggil otomatis oleh `npm run build`.
 */
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dest = path.join(root, '.next', 'standalone')
if (!existsSync(dest)) {
  console.error('Folder .next/standalone tidak ditemukan — jalankan `next build` dulu.')
  process.exit(1)
}
cpSync(path.join(root, '.next', 'static'), path.join(dest, '.next', 'static'), { recursive: true })
if (existsSync(path.join(root, 'public'))) {
  cpSync(path.join(root, 'public'), path.join(dest, 'public'), { recursive: true })
}
console.log('OK: berkas statis disalin ke .next/standalone')
