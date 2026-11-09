import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'
import { saveUploaded } from '@/lib/uploads'

type Ctx = { params: Promise<{ id: string }> }

const MAX_PHOTO = 8 // keputusan: 1 item maksimal 8 foto berbagai sudut

/** Upload foto (multi-file) / gambar teknis untuk satu produk (hanya admin). */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const product = await db.product.findUnique({ where: { id }, include: { assets: true } })
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 })

    const form = await req.formData()
    const assetType = form.get('assetType') === 'TECHNICAL' ? 'TECHNICAL' : 'PHOTO'
    const files = form.getAll('files').filter((f): f is File => f instanceof File)
    if (!files.length) return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 })

    const photoCount = product.assets.filter((a) => a.assetType === 'PHOTO').length
    if (assetType === 'PHOTO' && photoCount + files.length > MAX_PHOTO) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_PHOTO} foto per produk (sudah ada ${photoCount}).` },
        { status: 400 }
      )
    }

    const hasPrimary = product.assets.some((a) => a.isPrimary)
    let sortOrder = product.assets.length
    const created = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: `${file.name}: hanya file gambar yang didukung.` }, { status: 400 })
      }
      const meta = await saveUploaded(file)
      const asset = await db.productAsset.create({
        data: {
          productId: id,
          fileName: meta.fileName,
          thumbName: meta.thumbName,
          mimeType: meta.mimeType,
          fileSize: meta.fileSize,
          width: meta.width,
          height: meta.height,
          assetType,
          caption: file.name.replace(/\.[^.]+$/, ''),
          isPrimary: !hasPrimary && assetType === 'PHOTO' && !created.length,
          sortOrder,
        },
      })
      created.push(asset)
      sortOrder++
    }
    return NextResponse.json({ assets: created })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 })
    return NextResponse.json({ error: 'Upload gagal.' }, { status: 500 })
  }
}
