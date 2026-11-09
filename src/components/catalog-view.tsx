'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ImageOff, LayoutGrid, List, PackageSearch, PencilLine, Search, X } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/client'
import { fmtShort } from '@/lib/format'
import { Lookups, ProductListItem, assetUrl } from '@/lib/types'

interface CatalogViewProps {
  lookups: Lookups
  user: { id: string } | null
  reloadKey: number
  openProduct: (id: string, edit?: boolean) => void
  /** Nama profile terpilih dari sidebar (null = semua). */
  seriesId: string | null
  onSeriesChange: (id: string | null) => void
}

interface ListResponse {
  items: ProductListItem[]
  total: number
  page: number
  pages: number
}

function dimsLine(p: ProductListItem): string {
  const dims = (p.specs || []).filter((s) => s.attributeName.toLowerCase().match(/lebar|tinggi|panjang|tebal/))
  if (!dims.length) return ''
  return dims
    .slice(0, 2)
    .map((s) => fmtShort(s.attributeValue, s.unit))
    .join(' × ')
}

function ProductCard({ p, onOpen, canEdit }: { p: ProductListItem; onOpen: (id: string, edit?: boolean) => void; canEdit: boolean }) {
  const primary = p.assets?.[0]
  const dims = dimsLine(p)
  return (
    <button
      onClick={() => onOpen(p.id)}
      className="group text-left rounded-xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring relative"
      aria-label={`Buka detail produk ${p.sku}`}
    >
      {canEdit && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Edit produk ${p.sku}`}
          title="Edit produk ini"
          onClick={(e) => { e.stopPropagation(); onOpen(p.id, true) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onOpen(p.id, true) } }}
          className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/90 border shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:text-primary"
        >
          <PencilLine className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {primary ? (
          <img
            src={assetUrl(primary.thumbName || primary.fileName, true)}
            alt={primary.caption || `Foto produk ${p.sku}`}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="font-bold tracking-wide text-primary">{p.sku}</p>
        <p className="text-sm font-medium leading-snug line-clamp-1">{p.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {[p.type?.name, p.series?.name].filter(Boolean).join(' · ') || '—'}
        </p>
        {dims && <p className="text-xs text-muted-foreground/90">{dims}</p>}
      </div>
    </button>
  )
}

/** Baris produk untuk tampilan List (ala Windows Explorer: Details view). */
function ProductRow({ p, onOpen, canEdit }: { p: ProductListItem; onOpen: (id: string, edit?: boolean) => void; canEdit: boolean }) {
  const primary = p.assets?.[0]
  const dims = dimsLine(p)
  return (
    <TableRow
      onClick={() => onOpen(p.id)}
      className="cursor-pointer"
      aria-label={`Buka detail produk ${p.sku}`}
    >
      <TableCell className="w-16 pr-0">
        <div className="h-12 w-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
          {primary ? (
            <img
              src={assetUrl(primary.thumbName || primary.fileName, true)}
              alt={primary.caption || `Foto produk ${p.sku}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageOff className="h-5 w-5 text-muted-foreground/40" />
          )}
        </div>
      </TableCell>
      <TableCell className="font-bold text-primary whitespace-nowrap">{p.sku}</TableCell>
      <TableCell className="font-medium">
        <div className="line-clamp-1">{p.name}</div>
        <div className="text-xs text-muted-foreground md:hidden">
          {[p.type?.name, p.series?.name].filter(Boolean).join(' · ') || '—'}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">{p.type?.name || '—'}</TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">{p.series?.name || '—'}</TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground">{p.finish?.name || '—'}</TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground whitespace-nowrap">{dims || '—'}</TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-center">{p.assets.length}</TableCell>
      {canEdit && (
        <TableCell className="w-12 text-right">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label={`Edit produk ${p.sku}`}
            title="Edit produk ini"
            onClick={(e) => { e.stopPropagation(); onOpen(p.id, true) }}
          >
            <PencilLine className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}

/** Header kolom yang bisa diklik untuk mengurutkan (ala Explorer). */
function SortHeader({
  label, value, sort, onSort,
}: { label: string; value: string; sort: string; onSort: (v: string) => void }) {
  const active = sort === value
  return (
    <TableHead aria-sort={active ? 'ascending' : undefined}>
      <button
        type="button"
        onClick={() => onSort(value)}
        className={`inline-flex items-center gap-1 transition-colors ${
          active ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-label={`Urutkan berdasarkan ${label}`}
      >
        {label}
        {active ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </button>
    </TableHead>
  )
}

const ALL = 'ALL'

export function CatalogView({ lookups, user, reloadKey, openProduct, seriesId, onSeriesChange }: CatalogViewProps) {
  const [q, setQ] = useState('')
  const [qDeb, setQDeb] = useState('')
  const [type, setType] = useState(ALL)
  const [category, setCategory] = useState(ALL)
  const [finish, setFinish] = useState(ALL)
  const [sort, setSort] = useState('terbaru')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setQDeb(q.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  // Ganti nama profile dari sidebar → kembali ke halaman 1
  useEffect(() => {
    setPage(1)
  }, [seriesId])

  // Ingat pilihan tampilan ala Windows Explorer (kunci v2: default sekarang LIST)
  useEffect(() => {
    const saved = window.localStorage.getItem('br-view-mode-v2')
    if (saved === 'list' || saved === 'grid') setViewMode(saved)
  }, [])
  const changeViewMode = (m: 'grid' | 'list') => {
    setViewMode(m)
    window.localStorage.setItem('br-view-mode-v2', m)
  }

  const params = useMemo(() => {
    const sp = new URLSearchParams({ sort, page: String(page), pageSize: '24' })
    if (qDeb) sp.set('q', qDeb)
    if (seriesId) sp.set('series', seriesId)
    if (type !== ALL) sp.set('type', type)
    if (category !== ALL) sp.set('category', category)
    if (finish !== ALL) sp.set('finish', finish)
    return sp
  }, [qDeb, seriesId, type, category, finish, sort, page])

  useEffect(() => {
    let alive = true
    const run = async () => {
      setLoading(true)
      try {
        const d = await api<ListResponse>(`/api/products?${params}`)
        if (!alive) return
        setData(d)
        setError('')
      } catch (e) {
        if (alive) setError((e as Error).message)
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [params, reloadKey])

  const namaSeri = lookups.series.find((s) => s.id === seriesId)?.name || ''
  const hasFilter = qDeb || seriesId || type !== ALL || category !== ALL || finish !== ALL
  const resetFilters = () => {
    setQ('')
    onSeriesChange(null)
    setType(ALL)
    setCategory(ALL)
    setFinish(ALL)
    setSort('terbaru')
    setPage(1)
  }

  return (
    <div className="px-4 sm:px-6 py-5 w-full">
      {/* Baris alat: pencarian + toggle grid/list + urutan (+ filter ringkas) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode, nama, atau spesifikasi…"
            className="pl-9 h-10 rounded-full shadow-sm"
            aria-label="Pencarian produk"
          />
          {q && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
              onClick={() => setQ('')}
              aria-label="Bersihkan pencarian"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Pilih nama profile (hanya layar kecil — desktop memakai sidebar) */}
        <Select value={seriesId || ALL} onValueChange={(v) => onSeriesChange(v === ALL ? null : v)}>
          <SelectTrigger className="w-[150px] md:hidden bg-card h-10" aria-label="Pilih nama profile">
            <SelectValue placeholder="Profil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Profil</SelectItem>
            {lookups.series.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ms-auto flex items-center gap-2">
          {/* Toggle tampilan Grid / List ala Windows Explorer */}
          <div
            className="flex items-center rounded-md border bg-muted/60 p-0.5 shadow-sm"
            role="group"
            aria-label="Pilih mode tampilan"
          >
            <button
              type="button"
              onClick={() => changeViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="Tampilan grid"
              title="Tampilan Grid (kartu)"
              className={`inline-flex h-8 w-9 items-center justify-center rounded-sm transition-colors ${
                viewMode === 'grid'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeViewMode('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="Tampilan list"
              title="Tampilan List (rincian)"
              className={`inline-flex h-8 w-9 items-center justify-center rounded-sm transition-colors ${
                viewMode === 'list'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[140px] bg-card h-10" aria-label="Urutan"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="terbaru">Terbaru</SelectItem>
              <SelectItem value="nama">Nama A–Z</SelectItem>
              <SelectItem value="kode">Kode A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter ringkas tambahan (tipe/kategori/finishing) — opsional, ringkas */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-card" aria-label="Filter tipe"><SelectValue placeholder="Tipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tipe: Semua</SelectItem>
            {lookups.type.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-card" aria-label="Filter kategori"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Kategori: Semua</SelectItem>
            {lookups.category.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={finish} onValueChange={(v) => { setFinish(v); setPage(1) }}>
          <SelectTrigger className="w-[160px] h-8 text-xs bg-card" aria-label="Filter finishing"><SelectValue placeholder="Finishing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Finishing: Semua</SelectItem>
            {lookups.finish.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Jumlah hasil + nama profile terpilih */}
      <div className="flex items-center gap-2 mt-4 mb-3 text-sm text-muted-foreground">
        {loading ? (
          <span>Memuat…</span>
        ) : (
          <span>
            <strong className="text-foreground">{data?.total ?? 0}</strong> produk ditemukan
          </span>
        )}
        {namaSeri && (
          <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
            {namaSeri}
            <button
              type="button"
              onClick={() => onSeriesChange(null)}
              aria-label={`Hapus pilihan nama profile ${namaSeri}`}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {hasFilter && !loading && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetFilters}>
            <X className="h-3.5 w-3.5" /> Bersihkan filter
          </Button>
        )}
        {user && <Badge variant="outline" className="ms-auto">Mode Admin</Badge>}
      </div>

      {error && <p className="text-sm text-destructive py-8 text-center">{error}</p>}

      {/* Grid kartu */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {data.items.map((p) => (
              <ProductCard key={p.id} p={p} onOpen={openProduct} canEdit={!!user} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="w-16">
                    <span className="sr-only">Foto</span>
                  </TableHead>
                  <SortHeader label="Kode" value="kode" sort={sort} onSort={(v) => { setSort(v); setPage(1) }} />
                  <SortHeader label="Nama Produk" value="nama" sort={sort} onSort={(v) => { setSort(v); setPage(1) }} />
                  <TableHead className="hidden md:table-cell text-muted-foreground">Tipe</TableHead>
                  <TableHead className="hidden md:table-cell text-muted-foreground">Seri</TableHead>
                  <TableHead className="hidden lg:table-cell text-muted-foreground">Finishing</TableHead>
                  <TableHead className="hidden lg:table-cell text-muted-foreground">Ukuran</TableHead>
                  <TableHead className="hidden lg:table-cell text-muted-foreground text-center w-16">Foto</TableHead>
                  {user && <TableHead className="w-12"><span className="sr-only">Aksi</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <ProductRow key={p.id} p={p} onOpen={openProduct} canEdit={!!user} />
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : !error ? (
        <div className="py-20 text-center space-y-3">
          <PackageSearch className="h-12 w-12 mx-auto text-muted-foreground/40" aria-hidden />
          <p className="font-medium">Produk tidak ditemukan</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Coba kata kunci lain, atau hapus filter yang aktif untuk melihat seluruh katalog.
          </p>
          <Button variant="outline" size="sm" onClick={resetFilters}>Hapus semua filter</Button>
        </div>
      ) : null}

      {/* Paginasi */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Halaman {data.page} dari {data.pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Berikutnya <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
