'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/client'
import {
  ChevronDown, ChevronRight, FolderTree, LayoutGrid, PackagePlus, Search, ShieldCheck, Upload,
} from 'lucide-react'
import { Lookups, SessionUser } from '@/lib/types'

interface ZipImportResult {
  total: number
  productsCreated: number
  photosAdded: number
  skipped: { file: string; reason: string }[]
}

interface SidebarMenuProps {
  lookups: Lookups
  user: SessionUser | null
  selectedSeries: string | null
  onSelectSeries: (id: string | null) => void
  openProduct: (id: string, edit?: boolean) => void
  onDataChanged: () => void
}

/**
 * SIDEBAR KIRI (desain user):
 * - Menu utama "Nama Profile": diklik → expand/collapse dropdown berisi
 *   daftar nama profile yang ditambahkan admin; kolom cari di paling atas.
 * - Saat login, muncul menu admin: Tambah Produk (form mini) + Impor Massal ZIP.
 */
export function SidebarMenu({
  lookups, user, selectedSeries, onSelectSeries, openProduct, onDataChanged,
}: SidebarMenuProps) {
  const { toast } = useToast()
  const [openProfiles, setOpenProfiles] = useState(true)
  const [openAdmin, setOpenAdmin] = useState(true)
  const [cari, setCari] = useState('')

  // Form tambah produk (admin)
  const [tambahOpen, setTambahOpen] = useState(false)
  const [sku, setSku] = useState('')
  const [nama, setNama] = useState('')
  const [busy, setBusy] = useState(false)

  // Impor ZIP (admin)
  const zipRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ZipImportResult | null>(null)

  const kata = cari.trim().toLowerCase()
  const daftar = lookups.series.filter((s) => s.name.toLowerCase().includes(kata))

  const buatProduk = async () => {
    if (!sku.trim() || !nama.trim()) return
    setBusy(true)
    try {
      const r = await api<{ product: { id: string } }>('/api/products', {
        method: 'POST',
        body: JSON.stringify({ sku: sku.trim(), name: nama.trim() }),
        headers: { 'Content-Type': 'application/json' },
      })
      toast({ title: 'Produk dibuat', description: 'Lengkapi foto & spesifikasi di dialog (mode edit).' })
      setSku(''); setNama('')
      setTambahOpen(false)
      onDataChanged()
      openProduct(r.product.id, true)
    } catch (e) {
      toast({ title: 'Gagal membuat produk', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const imporZip = async (files: FileList | null) => {
    if (!files?.length) return
    const fd = new FormData()
    fd.set('file', files[0])
    setImporting(true)
    setImportResult(null)
    try {
      const r = await api<ZipImportResult>('/api/import/zip', { method: 'POST', body: fd })
      setImportResult(r)
      toast({
        title: 'Impor selesai',
        description: `${r.productsCreated} produk baru, ${r.photosAdded} foto ditambahkan${r.skipped.length ? `, ${r.skipped.length} dilewati` : ''}.`,
      })
      onDataChanged()
    } catch (e) {
      toast({ title: 'Impor gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setImporting(false)
      if (zipRef.current) zipRef.current.value = ''
    }
  }

  const itemClass = (active: boolean) =>
    `w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
      active
        ? 'bg-accent font-semibold text-primary shadow-sm'
        : 'hover:bg-accent/40 text-foreground/90'
    }`

  return (
    <nav className="py-3 text-sm h-full overflow-y-auto" aria-label="Menu sidebar">
      {/* ---------- Nama Profile (expand/collapse) ---------- */}
      <button
        type="button"
        onClick={() => setOpenProfiles((v) => !v)}
        aria-expanded={openProfiles}
        aria-controls="sidebar-profile-list"
        className="w-full flex items-center justify-between px-4 py-2.5 font-semibold hover:bg-accent/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-primary" /> Nama Profile
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openProfiles ? '' : '-rotate-90'}`} />
      </button>

      {openProfiles && (
        <div id="sidebar-profile-list" className="px-3 pb-3 space-y-2">
          {/* Kolom cari nama profile (paling atas) */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama profile…"
              aria-label="Cari nama profile"
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          <ul className="space-y-0.5" aria-label="Daftar nama profile">
            <li>
              <button
                type="button"
                onClick={() => onSelectSeries(null)}
                className={itemClass(selectedSeries === null)}
                aria-current={selectedSeries === null}
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" /> Semua Profil
              </button>
            </li>
            {daftar.map((s) => {
              const active = selectedSeries === s.id
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSeries(s.id)}
                    className={itemClass(active)}
                    aria-current={active}
                    title={s.name}
                  >
                    <span className="w-3.5 shrink-0 flex justify-center">
                      {active ? <span className="block h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                    </span>
                    <span className="truncate">{s.name}</span>
                  </button>
                </li>
              )
            })}
            {daftar.length === 0 && (
              <li className="px-2 py-3 text-xs text-muted-foreground text-center">
                Tidak ada nama profile yang cocok.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ---------- Menu Admin (hanya saat login) ---------- */}
      {user && (
        <>
          <div className="mx-4 border-t" />
          <button
            type="button"
            onClick={() => setOpenAdmin((v) => !v)}
            aria-expanded={openAdmin}
            aria-controls="sidebar-admin-menu"
            className="w-full flex items-center justify-between px-4 py-2.5 font-semibold hover:bg-accent/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Menu Admin
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openAdmin ? '' : '-rotate-90'}`} />
          </button>

          {openAdmin && (
            <div id="sidebar-admin-menu" className="px-3 pb-3 space-y-2">
              <button
                type="button"
                onClick={() => setTambahOpen((v) => !v)}
                aria-expanded={tambahOpen}
                className="w-full flex items-center justify-between rounded-md border bg-background px-2.5 py-2 text-xs font-medium hover:bg-accent/40 transition-colors"
              >
                <span className="flex items-center gap-2"><PackagePlus className="h-3.5 w-3.5 text-primary" /> Tambah Produk</span>
                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${tambahOpen ? 'rotate-90' : ''}`} />
              </button>

              {tambahOpen && (
                <div className="rounded-md border bg-background p-2.5 space-y-2">
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Kode produk *" aria-label="Kode produk baru" className="h-8 text-xs" />
                  <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama produk *" aria-label="Nama produk baru" className="h-8 text-xs" />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-8 flex-1 text-xs" disabled={busy || !sku.trim() || !nama.trim()} onClick={buatProduk}>
                      {busy ? 'Menyimpan…' : 'Buat & Edit'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setTambahOpen(false)}>
                      Tutup
                    </Button>
                  </div>
                </div>
              )}

              <input ref={zipRef} type="file" accept=".zip" hidden onChange={(e) => imporZip(e.target.files)} />
              <button
                type="button"
                onClick={() => zipRef.current?.click()}
                disabled={importing}
                className="w-full flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-xs font-medium hover:bg-accent/40 transition-colors disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5 text-primary" />
                {importing ? 'Mengimpor… (jangan tutup halaman)' : 'Impor Massal ZIP'}
              </button>
              <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                Pola file: <code className="bg-muted px-1 rounded">84270.jpg</code>,{' '}
                <code className="bg-muted px-1 rounded">84270_face.jpg</code>, juga{' '}
                <code className="bg-muted px-1 rounded">_sudut _depan _belakang _detail _side _profil</code>. Maks 8 foto/produk.
              </p>

              {importResult && (
                <div className="rounded-md border bg-accent/30 p-2 text-[11px] space-y-1">
                  <p className="font-medium">
                    Hasil: {importResult.total} file · {importResult.productsCreated} produk baru · {importResult.photosAdded} foto
                    {importResult.skipped.length > 0 && ` · ${importResult.skipped.length} dilewati`}
                  </p>
                  {importResult.skipped.slice(0, 3).map((s, i) => (
                    <p key={i} className="text-muted-foreground truncate">
                      <span className="text-destructive">•</span> {s.file}: {s.reason}
                    </p>
                  ))}
                  {importResult.skipped.length > 3 && (
                    <p className="text-muted-foreground">…dan {importResult.skipped.length - 3} lainnya.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </nav>
  )
}
