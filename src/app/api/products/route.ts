import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

const productCardInclude = {
  series: { select: { name: true } },
  type: { select: { name: true } },
  category: { select: { name: true } },
  finish: { select: { name: true } },
  assets: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
    select: { id: true, thumbName: true, fileName: true, caption: true, assetType: true },
  },
  specs: {
    where: { groupName: { in: ['Ukuran', 'Kemasan'] } },
    orderBy: { sortOrder: 'asc' as const },
    take: 4,
    select: { attributeName: true, attributeValue: true, unit: true },
  },
} satisfies Prisma.ProductInclude

/** Daftar produk: pencarian server-side + filter + urutan + paginasi (siap 1000+ produk). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') || '').trim()
  const seriesId = sp.get('series') || ''
  const typeId = sp.get('type') || ''
  const categoryId = sp.get('category') || ''
  const finishId = sp.get('finish') || ''
  const sort = sp.get('sort') || 'terbaru'
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(48, Math.max(6, parseInt(sp.get('pageSize') || '24', 10) || 24))

  const textFilter = q
    ? {
        OR: [
          { sku: { contains: q } },
          { name: { contains: q } },
          { description: { contains: q } },
          { material: { contains: q } },
          { series: { is: { name: { contains: q } } } },
          { type: { is: { name: { contains: q } } } },
          { category: { is: { name: { contains: q } } } },
          { finish: { is: { name: { contains: q } } } },
          { specs: { some: { OR: [{ attributeName: { contains: q } }, { attributeValue: { contains: q } }] } } },
        ],
      }
    : {}

  const where: Prisma.ProductWhereInput = {
    status: 'AKTIF',
    AND: [
      textFilter,
      seriesId ? { seriesId } : {},
      typeId ? { typeId } : {},
      categoryId ? { categoryId } : {},
      finishId ? { finishId } : {},
    ],
  }

  const orderBy =
    sort === 'nama' ? { name: 'asc' as const } : sort === 'kode' ? { sku: 'asc' as const } : { createdAt: 'desc' as const }

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      include: productCardInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.product.count({ where }),
  ])

  return NextResponse.json({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) })
}

/** Tambah produk baru (hanya admin). Data rinci dilengkapi lewat edit inline di halaman detail. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const sku = String(body.sku || '').trim()
    const name = String(body.name || '').trim()
    if (!sku || !name) {
      return NextResponse.json({ error: 'Kode produk dan nama wajib diisi.' }, { status: 400 })
    }
    const dup = await db.product.findUnique({ where: { sku } })
    if (dup) return NextResponse.json({ error: `Kode ${sku} sudah dipakai produk lain.` }, { status: 409 })
    const product = await db.product.create({
      data: {
        sku,
        name,
        description: body.description || null,
        material: body.material || null,
        note: body.note || null,
        status: 'AKTIF',
        seriesId: body.seriesId || null,
        typeId: body.typeId || null,
        categoryId: body.categoryId || null,
        finishId: body.finishId || null,
      },
    })
    return NextResponse.json({ product })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 })
    return NextResponse.json({ error: 'Gagal membuat produk.' }, { status: 500 })
  }
}
