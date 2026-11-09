'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Lightbox } from '@/components/lightbox'
import { useToast } from '@/hooks/use-toast'
import {
  ChevronLeft, ChevronRight, Copy, Download, FileImage, ImagePlus, ImageOff,
  Info, PencilLine, Plus, Save, Star, Trash2, Upload, X,
} from 'lucide-react'
import { api } from '@/lib/client'
import { fmtDual } from '@/lib/format'
import {
  AssetMeta, AssetType, Lookups, LookupItem, ProductDetail, SpecRow, assetUrl,
} from '@/lib/types'

interface DetailResponse {
  product: ProductDetail
  related: {
    id: string; sku: string; name: string
    series?: { name: string } | null
    type?: { name: string } | null
    assets: { id: string; thumbName: string | null; fileName: string }[]
  }[]
}

interface ProductDialogProps {
  id: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string } | null
  lookups: Lookups
  reloadLookups: () => void
  startInEdit: boolean
  openProduct: (id: string, edit?: boolean) => void
}

interface Draft {
  sku: string
  name: string
  brand: string
  description: string
  material: string
  note: string
  seriesId: string
  typeId: string
  categoryId: string
  finishId: string
  specs: SpecRow[]
}

const UNIT_OPTIONS = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'in', label: 'inch' },
  { value: '', label: 'teks' },
]

/** Select lookup dengan opsi tambah nilai baru secara inline (tanpa window baru). */
function LookupField({
  label, kind, items, value, disabled, onChange, onNew,
}: {
  label: string
  kind: string
  items: LookupItem[]
  value: string
  disabled?: boolean
  onChange: (id: string) => void
  onNew: (kind: string, name: string) => Promise<LookupItem | null>
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  if (adding) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label} — nilai baru</Label>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nama ${label.toLowerCase()}`}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && name.trim() && !busy) {
                setBusy(true)
                const item = await onNew(kind, name.trim())
                setBusy(false)
                if (item) { onChange(item.id); setAdding(false); setName('') }
              }
            }}
          />
          <Button
            size="sm"
            disabled={!name.trim() || busy}
            onClick={async () => {
              setBusy(true)
              const item = await onNew(kind, name.trim())
              setBusy(false)
              if (item) { onChange(item.id); setAdding(false); setName('') }
            }}
          >
            Simpan
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setName('') }}>Batal</Button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Select value={value || '_none_'} onValueChange={(v) => onChange(v === '_none_' ? '' : v)}>
          <SelectTrigger disabled={disabled} className="bg-card"><SelectValue placeholder={`Pilih ${label.toLowerCase()}`} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none_">— Tidak ada —</SelectItem>
            {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          type="button" size="icon" variant="outline" title={`Tambah ${label.toLowerCase()} baru`}
          className="shrink-0" onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Dialog produk (desain user): klik produk → dialog box;
 * kiri = foto yang bisa di-slide sesuai jumlah foto, kanan = rincian produk,
 * tombol X di pojok kanan atas. Tidak membuka tab/window baru.
 */
export function ProductDialog({
  id, open, onOpenChange, user, lookups, reloadLookups, startInEdit, openProduct,
}: ProductDialogProps) {
  const { toast } = useToast()
  const isAdmin = !!user

  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [mainIdx, setMainIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const uploadType = useRef<AssetType>('PHOTO')

  const load = useCallback(async () => {
    if (!id) return
    try {
      const d = await api<DetailResponse>(`/api/products/${id}`)
      setData(d)
      setError('')
      setMainIdx(0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!open || !id) return
    setLoading(true)
    load()
  }, [open, load])

  // Mulai dari awal tiap ganti produk; masuk mode edit bila diminta
  useEffect(() => {
    setEdit(!!startInEdit && isAdmin)
    setData(null)
    setDraft(null)
    setError('')
  }, [id, startInEdit, isAdmin])

  useEffect(() => {
    if (data) {
      const p = data.product
      setDraft({
        sku: p.sku, name: p.name, brand: p.brand || '', description: p.description || '',
        material: p.material || '', note: p.note || '',
        seriesId: p.series?.id || '', typeId: p.type?.id || '',
        categoryId: p.category?.id || '', finishId: p.finish?.id || '',
        specs: p.specs.map((s) => ({ ...s })),
      })
    }
  }, [data])

  const assets = data?.product.assets ?? []
  const photos = useMemo(() => assets.filter((a) => a.assetType === 'PHOTO'), [assets])
  const technical = useMemo(() => assets.filter((a) => a.assetType === 'TECHNICAL'), [assets])
  const gallery = useMemo(() => [...photos, ...technical], [photos, technical])
  const current = gallery[Math.min(mainIdx, gallery.length - 1)]

  // Slide foto dengan tombol panah keyboard (selama lightbox tidak terbuka)
  const slide = useCallback((d: number) => {
    if (gallery.length > 1 && !zoom) setMainIdx((i) => (i + d + gallery.length) % gallery.length)
  }, [gallery.length, zoom])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') slide(-1)
      if (e.key === 'ArrowRight') slide(1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, slide])

  const specGroups = useMemo(() => {
    const m = new Map<string, SpecRow[]>()
    for (const s of draft?.specs || []) {
      const g = s.groupName?.trim() || 'Umum'
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(s)
    }
    return Array.from(m.entries())
  }, [draft])

  const patchAsset = async (assetId: string, body: Record<string, unknown>, msg: string) => {
    try {
      await api(`/api/assets/${assetId}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
      await load()
      toast({ title: msg })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const deleteAsset = async (asset: AssetMeta) => {
    if (!window.confirm(`Hapus gambar "${asset.caption || asset.fileName}"?`)) return
    try {
      await api(`/api/assets/${asset.id}`, { method: 'DELETE' })
      await load()
      toast({ title: 'Gambar dihapus' })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleUpload = async (files: FileList | null, assetType: AssetType) => {
    if (!files || !files.length || !data) return
    if (assetType === 'PHOTO' && photos.length + files.length > 8) {
      toast({ title: 'Maksimal 8 foto per produk', description: `Saat ini sudah ada ${photos.length} foto.`, variant: 'destructive' })
      return
    }
    const fd = new FormData()
    fd.set('assetType', assetType)
    Array.from(files).forEach((f) => fd.append('files', f))
    setUploading(true)
    try {
      await api(`/api/products/${data.product.id}/assets`, { method: 'POST', body: fd })
      await load()
      toast({ title: `${files.length} gambar berhasil diunggah` })
    } catch (e) {
      toast({ title: 'Upload gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleLogoUpload = async (files: FileList | null) => {
    if (!files?.length || !data) return
    const fd = new FormData()
    fd.set('file', files[0])
    setUploadingLogo(true)
    try {
      await api(`/api/products/${data.product.id}/logo`, { method: 'POST', body: fd })
      await load()
      toast({ title: 'Logo produk diperbarui' })
    } catch (e) {
      toast({ title: 'Gagal unggah logo', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setUploadingLogo(false)
      if (logoRef.current) logoRef.current.value = ''
    }
  }

  const addLookup = async (kind: string, name: string): Promise<LookupItem | null> => {
    try {
      const r = await api<{ item: LookupItem }>('/api/lookups', {
        method: 'POST', body: JSON.stringify({ kind, name }), headers: { 'Content-Type': 'application/json' },
      })
      reloadLookups()
      toast({ title: `Nilai baru "${r.item.name}" ditambahkan` })
      return r.item
    } catch (e) {
      toast({ title: 'Gagal menambah nilai', description: (e as Error).message, variant: 'destructive' })
      return null
    }
  }

  const save = async () => {
    if (!data || !draft) return
    setSaving(true)
    try {
      await api(`/api/products/${data.product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...draft, specs: draft.specs.map((s, i) => ({ ...s, sortOrder: i })) }),
        headers: { 'Content-Type': 'application/json' },
      })
      await load()
      toast({ title: 'Perubahan tersimpan' })
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const copyCode = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.product.sku)
      toast({ title: 'Kode disalin', description: data.product.sku })
    } catch {
      toast({ title: 'Gagal menyalin kode', variant: 'destructive' })
    }
  }

  const p = data?.product
  const setD = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden max-h-[92dvh] flex flex-col">
          <DialogTitle className="sr-only">Detail produk {p?.sku ?? ''}</DialogTitle>
          <DialogDescription className="sr-only">
            Dialog rincian produk: foto di kiri bisa digeser, rincian di kanan, tutup dengan tombol X.
          </DialogDescription>

          {loading ? (
            <div className="grid lg:grid-cols-2 gap-6 p-6 w-full">
              <Skeleton className="aspect-square rounded-xl" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          ) : error || !data || !draft || !p ? (
            <div className="p-10 text-center space-y-4">
              <p className="text-destructive">{error || 'Produk tidak ditemukan.'}</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:max-h-[92dvh] min-h-0 overflow-y-auto lg:overflow-hidden">
              {/* ---------- KIRI: galeri foto yang bisa di-slide ---------- */}
              <div className="p-4 sm:p-6 space-y-3 flex flex-col min-h-0">
                <div
                  className="relative rounded-xl border bg-white flex items-center justify-center overflow-hidden cursor-zoom-in min-h-[280px] h-[42dvh] lg:h-auto lg:flex-1"
                  onClick={() => current && setZoom(true)}
                  role="button"
                  aria-label="Perbesar gambar"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && current && setZoom(true)}
                >
                  {current ? (
                    <>
                      <img
                        src={assetUrl(current.fileName)}
                        alt={current.caption || `Gambar produk ${p.sku}`}
                        className="w-full h-full object-contain"
                      />
                      {gallery.length > 1 && (
                        <>
                          <button
                            type="button"
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 shadow-md flex items-center justify-center hover:bg-background"
                            onClick={(e) => { e.stopPropagation(); slide(-1) }}
                            aria-label="Foto sebelumnya"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 shadow-md flex items-center justify-center hover:bg-background"
                            onClick={(e) => { e.stopPropagation(); slide(1) }}
                            aria-label="Foto berikutnya"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                          <Badge variant="secondary" className="absolute bottom-2 right-2 bg-background/90">
                            {mainIdx + 1}/{gallery.length}
                          </Badge>
                        </>
                      )}
                      {current.assetType === 'TECHNICAL' && (
                        <Badge variant="secondary" className="absolute top-3 left-3 gap-1">
                          <FileImage className="h-3 w-3" /> Gambar Teknis
                        </Badge>
                      )}
                    </>
                  ) : (
                    <ImageOff className="h-16 w-16 text-muted-foreground/30" />
                  )}
                </div>

                {gallery.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {gallery.map((a, i) => (
                      <button
                        key={a.id}
                        onClick={() => setMainIdx(i)}
                        className={`shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden bg-white transition-colors ${
                          i === mainIdx ? 'border-primary' : 'border-transparent hover:border-border'
                        }`}
                        aria-label={`Tampilkan gambar ${i + 1}`}
                      >
                        <img src={assetUrl(a.thumbName || a.fileName, true)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Manajemen aset (mode edit admin) */}
                {edit && (
                  <div className="rounded-lg border p-3 space-y-2 bg-card">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <ImagePlus className="h-4 w-4" /> Kelola Gambar
                      <Badge variant="outline" className="ml-1">{photos.length}/8 foto · {technical.length} teknis</Badge>
                    </p>
                    <input
                      ref={fileRef} type="file" accept="image/*" multiple hidden
                      onChange={(e) => handleUpload(e.target.files, uploadType.current)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={uploading}
                        onClick={() => { uploadType.current = 'PHOTO'; fileRef.current?.click() }}>
                        <Upload className="h-4 w-4" /> Unggah Foto
                      </Button>
                      <Button size="sm" variant="outline" disabled={uploading}
                        onClick={() => { uploadType.current = 'TECHNICAL'; fileRef.current?.click() }}>
                        <FileImage className="h-4 w-4" /> Unggah Gambar Teknis
                      </Button>
                      {uploading && <span className="text-xs text-muted-foreground self-center">Mengunggah…</span>}
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {assets.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 rounded-md border p-1.5">
                          <img src={assetUrl(a.thumbName || a.fileName, true)} alt="" className="w-9 h-9 rounded object-cover bg-muted" />
                          <Input
                            defaultValue={a.caption || ''} className="h-8 text-xs flex-1" placeholder="Keterangan gambar"
                            onBlur={(e) => e.target.value !== (a.caption || '') && patchAsset(a.id, { caption: e.target.value }, 'Keterangan disimpan')}
                          />
                          <Select value={a.assetType} onValueChange={(v) => patchAsset(a.id, { assetType: v }, 'Tipe gambar diperbarui')}>
                            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PHOTO">Foto</SelectItem>
                              <SelectItem value="TECHNICAL">Teknis</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon" variant={a.isPrimary ? 'default' : 'ghost'} className="h-8 w-8 shrink-0"
                            title="Jadikan gambar utama" disabled={a.isPrimary}
                            onClick={() => patchAsset(a.id, { isPrimary: true }, 'Foto utama diperbarui')}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" title="Hapus gambar"
                            onClick={() => deleteAsset(a)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {!assets.length && <p className="text-xs text-muted-foreground">Belum ada gambar.</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* ---------- KANAN: rincian produk ---------- */}
              <div className="p-4 sm:p-6 space-y-5 border-t lg:border-t-0 lg:border-l bg-card/40 lg:overflow-y-auto min-h-0">
                {/* Baris mode edit admin */}
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-accent/40 px-3 py-2">
                    <Switch id="editmode" checked={edit} onCheckedChange={setEdit} />
                    <Label htmlFor="editmode" className="flex items-center gap-1.5 cursor-pointer text-sm font-medium pr-8">
                      <PencilLine className="h-4 w-4" /> Mode Edit
                    </Label>
                    {edit && (
                      <Button size="sm" onClick={save} disabled={saving} className="ms-auto">
                        <Save className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan'}
                      </Button>
                    )}
                  </div>
                )}

                {edit ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Kode Produk</Label>
                      <Input value={draft.sku} onChange={(e) => setD({ sku: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nama Produk</Label>
                      <Input value={draft.name} onChange={(e) => setD({ name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Brand / Merk</Label>
                      <Input value={draft.brand} onChange={(e) => setD({ brand: e.target.value })} placeholder="mis. Belgindo" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Logo Item</Label>
                      <div className="flex items-center gap-2">
                        {p.logoName && (
                          <img src={assetUrl(p.logoName)} alt="Logo produk" className="h-9 w-9 rounded border bg-white object-contain" />
                        )}
                        <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => handleLogoUpload(e.target.files)} />
                        <Button size="sm" variant="outline" disabled={uploadingLogo} onClick={() => logoRef.current?.click()}>
                          <Upload className="h-4 w-4" /> {uploadingLogo ? 'Mengunggah…' : p.logoName ? 'Ganti Logo' : 'Unggah Logo'}
                        </Button>
                      </div>
                    </div>
                    <LookupField label="Seri" kind="series" items={lookups.series} value={draft.seriesId} onChange={(v) => setD({ seriesId: v })} onNew={addLookup} />
                    <LookupField label="Tipe" kind="type" items={lookups.type} value={draft.typeId} onChange={(v) => setD({ typeId: v })} onNew={addLookup} />
                    <LookupField label="Kategori" kind="category" items={lookups.category} value={draft.categoryId} onChange={(v) => setD({ categoryId: v })} onNew={addLookup} />
                    <LookupField label="Finishing" kind="finish" items={lookups.finish} value={draft.finishId} onChange={(v) => setD({ finishId: v })} onNew={addLookup} />
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Material</Label>
                      <Input value={draft.material} onChange={(e) => setD({ material: e.target.value })} placeholder="mis. Kayu MDF, Paulownia…" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Deskripsi</Label>
                      <Textarea rows={2} value={draft.description} onChange={(e) => setD({ description: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center gap-2.5">
                        {p.logoName && (
                          <img src={assetUrl(p.logoName)} alt={`Logo ${p.brand || p.sku}`} className="h-10 w-10 rounded-md border bg-white object-contain" />
                        )}
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold tracking-wide text-primary">{p.sku}</h2>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyCode} title="Salin kode">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <h1 className="text-xl font-semibold mt-1">{p.name}</h1>
                      {p.brand && <p className="text-sm text-muted-foreground mt-0.5">Brand: {p.brand}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.series && <Badge variant="secondary">Seri: {p.series.name}</Badge>}
                        {p.type && <Badge variant="secondary">Tipe: {p.type.name}</Badge>}
                        {p.category && <Badge variant="secondary">Kategori: {p.category.name}</Badge>}
                        {p.finish && <Badge variant="secondary">Finishing: {p.finish.name}</Badge>}
                        {p.material && <Badge variant="outline">Material: {p.material}</Badge>}
                      </div>
                    </div>
                    {p.description && <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={copyCode}><Copy className="h-4 w-4" /> Salin Kode</Button>
                      {current && (
                        <a href={assetUrl(current.fileName)} download={current.fileName}>
                          <Button size="sm" variant="outline"><Download className="h-4 w-4" /> Unduh Gambar</Button>
                        </a>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                {/* Spesifikasi teknis */}
                <section className="space-y-3">
                  <h3 className="font-semibold">Spesifikasi Teknis</h3>
                  {edit ? (
                    <div className="space-y-2">
                      {draft.specs.map((s, i) => (
                        <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                          <Input className="col-span-3 h-9 text-xs" placeholder="Grup" value={s.groupName}
                            onChange={(e) => { const v = e.target.value; setDraft((d) => d && { ...d, specs: d.specs.map((r, j) => (j === i ? { ...r, groupName: v } : r)) }) }} />
                          <Input className="col-span-4 h-9 text-xs" placeholder="Nama atribut" value={s.attributeName}
                            onChange={(e) => { const v = e.target.value; setDraft((d) => d && { ...d, specs: d.specs.map((r, j) => (j === i ? { ...r, attributeName: v } : r)) }) }} />
                          <Input className="col-span-2 h-9 text-xs" placeholder="Nilai" value={s.attributeValue}
                            onChange={(e) => { const v = e.target.value; setDraft((d) => d && { ...d, specs: d.specs.map((r, j) => (j === i ? { ...r, attributeValue: v } : r)) }) }} />
                          <Select value={s.unit || '_txt'} onValueChange={(v) => { const u = v === '_txt' ? '' : v; setDraft((d) => d && { ...d, specs: d.specs.map((r, j) => (j === i ? { ...r, unit: u } : r)) }) }}>
                            <SelectTrigger className="col-span-2 h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNIT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value || '_txt'}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="ghost" className="col-span-1 h-9 w-9 text-destructive"
                            onClick={() => setDraft((d) => d && { ...d, specs: d.specs.filter((_, j) => j !== i) })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline"
                        onClick={() => setDraft((d) => d && { ...d, specs: [...d.specs, { groupName: 'Ukuran', attributeName: '', attributeValue: '', unit: 'mm' }] })}>
                        <Plus className="h-4 w-4" /> Tambah Baris Spesifikasi
                      </Button>
                    </div>
                  ) : specGroups.length ? (
                    <div className="space-y-4">
                      {specGroups.map(([group, rows]) => (
                        <div key={group} className="rounded-lg border overflow-hidden">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-3 py-2">{group}</p>
                          <table className="w-full text-sm">
                            <tbody>
                              {rows.map((s, i) => (
                                <tr key={i} className={i % 2 ? 'bg-accent/30' : ''}>
                                  <td className="px-3 py-2 text-muted-foreground w-2/5">{s.attributeName}</td>
                                  <td className="px-3 py-2 font-medium">{fmtDual(s.attributeValue, s.unit)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">Nilai ditampilkan dalam mm dan inch secara bersamaan.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum ada spesifikasi tercatat.</p>
                  )}
                </section>

                {/* Catatan */}
                {(edit || p.note) && (
                  <section className="space-y-2">
                    <h3 className="font-semibold">Catatan</h3>
                    {edit ? (
                      <Textarea rows={2} value={draft.note} onChange={(e) => setD({ note: e.target.value })} placeholder="Catatan internal, pemasangan, kemasan…" />
                    ) : (
                      <div className="rounded-lg border border-primary/30 bg-accent/40 px-3 py-2.5 flex gap-2 text-sm">
                        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden />
                        <p className="whitespace-pre-wrap">{p.note}</p>
                      </div>
                    )}
                  </section>
                )}

                {/* Produk serupa */}
                {data.related.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="font-semibold">Produk Serupa</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.related.map((r) => (
                        <button key={r.id} onClick={() => openProduct(r.id)}
                          className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 hover:border-primary/50 hover:shadow-sm transition-all text-left">
                          <span className="w-8 h-8 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                            {r.assets[0] ? (
                              <img src={assetUrl(r.assets[0].thumbName || r.assets[0].fileName, true)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageOff className="h-3.5 w-3.5 text-muted-foreground/40" />
                            )}
                          </span>
                          <span>
                            <span className="block text-xs font-bold text-primary">{r.sku}</span>
                            <span className="block text-xs line-clamp-1 max-w-[140px]">{r.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Perbesar foto: klik foto utama / thumbnail */}
      <Lightbox
        open={zoom}
        onOpenChange={setZoom}
        assets={gallery.map((a) => ({ ...a, assetType: a.assetType as AssetType }))}
        index={mainIdx}
        onIndexChange={setMainIdx}
      />
    </>
  )
}
