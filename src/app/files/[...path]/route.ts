
import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { resolveUploadPath } from '@/lib/uploads'

type Ctx = { params: Promise<{ path: string[] }> }

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

/** Penyaji file upload dari folder server (mendukung ?thumb=1). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { path: parts } = await ctx.params
  const name = (parts || []).join('/')
  const wantThumb = req.nextUrl.searchParams.get('thumb') === '1'
  let target = resolveUploadPath(wantThumb && name ? name.replace(/(\.[^.]+)$/, '_thumb.jpg') : name)
  if (!target) return NextResponse.json({ error: 'File tidak valid.' }, { status: 400 })

  try {
    await stat(target)
  } catch {
    // thumbnail belum tersedia → fallback ke file asli
    target = resolveUploadPath(name)
    if (!target) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })
    try {
      await stat(target)
    } catch {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })
    }
  }

  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
  const buf = await readFile(target)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export const runtime = 'nodejs'
