import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'
import { UPLOAD_DIR } from '@/lib/uploads'

type Ctx = { params: Promise<{ id: string }> }

/** Ubah metadata aset: caption, tipe, jadikan foto utama (hanya admin). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const body = await req.json()
    const asset = await db.productAsset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Aset tidak ditemukan.' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.caption === 'string') data.caption = body.caption.trim() || null
    if (body.assetType === 'PHOTO' || body.assetType === 'TECHNICAL') data.assetType = body.assetType
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder

    if (body.isPrimary === true) {
      await db.productAsset.updateMany({ where: { productId: asset.productId }, data: { isPrimary: false } })
      data.isPrimary = true
    } else if (body.isPrimary === false) {
      data.isPrimary = false
    }

    const updated = await db.productAsset.update({ where: { id }, data })
    return NextResponse.json({ asset: updated })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 })
    return NextResponse.json({ error: 'Gagal menyimpan aset.' }, { status: 500 })
  }
}

/** Hapus satu aset foto/gambar teknis yang salah unggah (hanya admin; produk tetap tidak dapat dihapus). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const asset = await db.productAsset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Aset tidak ditemukan.' }, { status: 404 })

    await db.productAsset.delete({ where: { id } })
    for (const name of [asset.fileName, asset.thumbName].filter(Boolean) as string[]) {
      await unlink(path.join(UPLOAD_DIR, name)).catch(() => {})
    }
    // pastikan produk tetap punya foto utama bila masih ada foto lain
    const remaining = await db.productAsset.findFirst({
      where: { productId: asset.productId, assetType: 'PHOTO' },
      orderBy: { sortOrder: 'asc' },
    })
    if (remaining && !remaining.isPrimary) {
      await db.productAsset.update({ where: { id: remaining.id }, data: { isPrimary: true } })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 })
    return NextResponse.json({ error: 'Gagal menghapus aset.' }, { status: 500 })
  }
}
