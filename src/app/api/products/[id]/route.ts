import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

/** Detail satu produk: identitas, semua aset, spesifikasi, dan produk serupa. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const product = await db.product.findUnique({
    where: { id },
    include: {
      series: true,
      type: true,
      category: true,
      finish: true,
      assets: { orderBy: [{ assetType: 'asc' }, { isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      specs: { orderBy: [{ groupName: 'asc' }, { sortOrder: 'asc' }] },
    },
  })
  if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 })

  const relatedOr: Record<string, string>[] = []
  if (product.seriesId) relatedOr.push({ seriesId: product.seriesId })
  if (product.typeId) relatedOr.push({ typeId: product.typeId })

  const related = relatedOr.length
    ? await db.product.findMany({
        where: { id: { not: product.id }, status: 'AKTIF', OR: relatedOr },
        include: {
          series: { select: { name: true } },
          type: { select: { name: true } },
          assets: {
            where: { assetType: 'PHOTO' },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
            select: { id: true, thumbName: true, fileName: true },
          },
        },
        take: 8,
      })
    : []

  return NextResponse.json({ product, related })
}

/** Simpan perubahan produk (hanya admin, edit inline di halaman detail). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    const body = await req.json()
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 })

    if (typeof body.name === 'string' && !body.name.trim()) {
      return NextResponse.json({ error: 'Nama produk tidak boleh kosong.' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.sku === 'string' && body.sku.trim() && body.sku.trim() !== existing.sku) {
      const sku = body.sku.trim()
      const dup = await db.product.findUnique({ where: { sku } })
      if (dup) return NextResponse.json({ error: `Kode ${sku} sudah dipakai produk lain.` }, { status: 409 })
      data.sku = sku
    }
    for (const key of ['name', 'description', 'material', 'note', 'brand'] as const) {
      if (typeof body[key] === 'string') data[key] = body[key].trim() || null
    }
    for (const key of ['seriesId', 'typeId', 'categoryId', 'finishId'] as const) {
      if (key in body) data[key] = body[key] || null
    }

    // spesifikasi: ganti seluruh set (pengeditan tabel dinamis)
    if (Array.isArray(body.specs)) {
      const rows = body.specs
        .filter((s: { attributeName?: string }) => s.attributeName?.trim())
        .map((s: { groupName?: string; attributeName: string; attributeValue?: string; unit?: string }, i: number) => ({
          groupName: s.groupName?.trim() || 'Umum',
          attributeName: s.attributeName.trim(),
          attributeValue: s.attributeValue?.trim() || '',
          unit: s.unit?.trim() || null,
          sortOrder: i,
        }))
      data.specs = { deleteMany: {}, create: rows }
    }

    const product = await db.product.update({ where: { id }, data, include: { specs: true } })
    return NextResponse.json({ product })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 })
    console.error('[PATCH product]', e)
    return NextResponse.json({ error: 'Gagal menyimpan perubahan.' }, { status: 500 })
  }
}
