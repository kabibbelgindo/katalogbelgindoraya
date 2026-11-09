import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'
import { saveUploaded } from '@/lib/uploads'

const execFileAsync = promisify(execFile)

/**
 * IMPOR MASSAL ZIP (hanya admin)
 *
 * Terima file ZIP berisi foto produk, kenali pola nama file:
 *   84270.jpg            → produk 84270, foto umum (tampak sudut)
 *   84270_face.jpg       → produk 84270, tampak face/profil
 *   84270_sudut.jpg      → produk 84270, tampak sudut
 *   dst: _depan _belakang _back _detail _side _profil _corner
 *
 * Produk otomatis dibuat bila kode belum ada (nama sementara = kode).
 * Maksimal 8 foto per produk; sisanya dilewati dengan alasan.
 */

const JENIS_MAP: Record<string, string> = {
  face: 'Tampak face/profil',
  corner: 'Tampak sudut',
  sudut: 'Tampak sudut',
  depan: 'Tampak depan',
  belakang: 'Tampak belakang',
  back: 'Tampak belakang',
  detail: 'Detail',
  side: 'Tampak samping',
  profil: 'Profil',
}

const SUFFIX = Object.keys(JENIS_MAP).join('|')
const PATTERN = new RegExp(`^(.+?)(?:_(${SUFFIX}))?$`, 'i')
const IMG_RE = /\.(jpe?g|png|webp)$/i
const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File ZIP wajib dipilih.' }, { status: 400 })
    }
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran ZIP maksimal 200 MB.' }, { status: 400 })
    }

    const tmp = await mkdtemp(path.join(tmpdir(), 'brzip-'))
    try {
      const zipPath = path.join(tmp, 'import.zip')
      await writeFile(zipPath, Buffer.from(await file.arrayBuffer()))
      const outDir = path.join(tmp, 'out')
      await mkdir(outDir, { recursive: true })
      await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', outDir])

      // Kumpulkan semua file (termasuk di dalam subfolder)
      const files: string[] = []
      const walk = async (dir: string) => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === '__MACOSX') continue
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) await walk(full)
          else files.push(full)
        }
      }
      await walk(outDir)

      let productsCreated = 0
      let photosAdded = 0
      const skipped: { file: string; reason: string }[] = []

      for (const f of files) {
        const base = path.basename(f)
        if (!IMG_RE.test(base)) {
          skipped.push({ file: base, reason: 'Bukan gambar (jpg/png/webp)' })
          continue
        }
        const stem = base.replace(IMG_RE, '')
        const m = PATTERN.exec(stem)
        const kode = m?.[1]?.trim()
        if (!kode) {
          skipped.push({ file: base, reason: 'Nama file tidak mengandung kode produk' })
          continue
        }
        const jenis = (m?.[2] || '').toLowerCase()

        // Cari produk: sama persis, lalu tidak peka huruf besar-kecil
        let product = await db.product.findUnique({ where: { sku: kode } })
        if (!product) {
          const candidates = await db.product.findMany({
            where: { sku: { in: [kode, kode.toUpperCase(), kode.toLowerCase()] } },
            take: 1,
          })
          product = candidates[0] ?? null
        }
        if (!product) {
          product = await db.product.create({ data: { sku: kode, name: kode } })
          productsCreated++
        }

        const photoCount = await db.productAsset.count({
          where: { productId: product.id, assetType: 'PHOTO' },
        })
        if (photoCount >= 8) {
          skipped.push({ file: base, reason: `Produk ${product.sku} sudah memiliki 8 foto` })
          continue
        }

        const ext = (base.match(IMG_RE)?.[1] || 'jpg').toLowerCase()
        const fobj = new File([await readFile(f)], base, { type: MIME[ext] || 'application/octet-stream' })
        const saved = await saveUploaded(fobj)
        await db.productAsset.create({
          data: {
            productId: product.id,
            fileName: saved.fileName,
            thumbName: saved.thumbName,
            mimeType: saved.mimeType,
            fileSize: saved.fileSize,
            width: saved.width,
            height: saved.height,
            assetType: 'PHOTO',
            caption: JENIS_MAP[jenis] || null,
            sortOrder: photoCount,
          },
        })
        photosAdded++
      }

      return NextResponse.json({ ok: true, total: files.length, productsCreated, photosAdded, skipped })
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 })
    const msg = e instanceof Error && /unzip/i.test(e.message)
      ? 'Gagal mengekstrak ZIP (pastikan file .zip valid).'
      : 'Gagal mengimpor ZIP.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
