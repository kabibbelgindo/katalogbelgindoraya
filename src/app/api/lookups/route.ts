import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nilai'
}

const MODELS = {
  series: db.series,
  type: db.productType,
  category: db.category,
  finish: db.finish,
} as const

type Kind = keyof typeof MODELS

/** Daftar nilai lookup untuk filter & form. */
export async function GET() {
  const [series, type, category, finish] = await Promise.all([
    db.series.findMany({ orderBy: { name: 'asc' } }),
    db.productType.findMany({ orderBy: { name: 'asc' } }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
    db.finish.findMany({ orderBy: { name: 'asc' } }),
  ])
  return NextResponse.json({ series, type, category, finish })
}

/** Tambah nilai baru (hanya admin) — dipakai saat edit inline bila nilai belum ada. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { kind, name } = await req.json()
    if (!kind || !(kind in MODELS) || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'Jenis dan nama nilai wajib diisi.' }, { status: 400 })
    }
    const model = MODELS[kind as Kind]
    const clean = String(name).trim()
    const existing = await (model as { findUnique: (a: { where: { name: string } }) => unknown }).findUnique({ where: { name: clean } })
    if (existing) return NextResponse.json({ item: existing })
    const item = await (model as unknown as {
      create: (a: { data: { name: string; slug: string } }) => Promise<unknown>
    }).create({ data: { name: clean, slug: slugify(clean) } })
    return NextResponse.json({ item })
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 })
    return NextResponse.json({ error: 'Gagal menambah nilai.' }, { status: 500 })
  }
}
