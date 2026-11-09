import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'
import sharp from 'sharp'

export const UPLOAD_DIR = path.join(process.cwd(), 'db', 'uploads')

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true })
}

export function safeFileName(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-64)
}

/**
 * Simpan satu gambar yang diunggah: file asli + thumbnail (maks 480px).
 * Mengembalikan metadata untuk record ProductAsset.
 */
export async function saveUploaded(file: File) {
  await ensureUploadDir()
  const buf = Buffer.from(await file.arrayBuffer())
  const ext = (file.name.match(/\.(jpe?g|png|webp|gif|pdf)$/i)?.[1] || 'jpg').toLowerCase()
  const base = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const fileName = `${base}.${ext}`

  const meta: {
    fileName: string
    thumbName: string | null
    mimeType: string
    fileSize: number
    width: number | null
    height: number | null
  } = {
    fileName,
    thumbName: null,
    mimeType: file.type || `image/${ext}`,
    fileSize: buf.length,
    width: null,
    height: null,
  }

  if (ext === 'pdf') {
    await writeFile(path.join(UPLOAD_DIR, fileName), buf)
    return meta
  }

  const image = sharp(buf, { failOn: 'none' })
  const info = await image.metadata()
  meta.width = info.width ?? null
  meta.height = info.height ?? null

  // simpan asli apa adanya (keputusan: file asli resolusi penuh tersimpan)
  await writeFile(path.join(UPLOAD_DIR, fileName), buf)

  // thumbnail ringan untuk grid 1000+ produk
  const thumb = await image
    .clone()
    .rotate()
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()
  const thumbName = `${base}_thumb.jpg`
  await writeFile(path.join(UPLOAD_DIR, thumbName), thumb)
  meta.thumbName = thumbName

  return meta
}

export function resolveUploadPath(name: string): string | null {
  const clean = safeFileName(name)
  if (!clean || clean.startsWith('.')) return null
  const full = path.join(UPLOAD_DIR, clean)
  if (!full.startsWith(UPLOAD_DIR)) return null
  return full
}
