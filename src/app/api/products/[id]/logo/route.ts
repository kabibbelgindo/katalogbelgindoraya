import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'
import { saveUploaded } from '@/lib/uploads'

type Ctx = { params: Promise<{ id: string }> }

/** Unggah / ganti logo per item (hanya admin). Satu produk memiliki satu logo kecil. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File logo wajib dipilih.' }, { status: 400 })
    }
    if (!/^image\/(png|jpeg|webp|svg\+xml|x-icon|avif)$/i.test(file.type)) {
      return NextResponse.json({ error: 'Logo harus berupa gambar (PNG/JPG/WebP/SVG).' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran logo maksimal 2 MB.' }, { status: 400 })
    }

    const saved = await saveUploaded(file)
    await db.product.update({ where: { id }, data: { logoName: saved.fileName } })
    return NextResponse.json({ ok: true, logoName: saved.fileName })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 })
    console.error('[POST logo]', e)
    return NextResponse.json({ error: 'Gagal mengunggah logo.' }, { status: 500 })
  }
}
