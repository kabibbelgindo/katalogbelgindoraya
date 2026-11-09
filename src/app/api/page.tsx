'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { CatalogView } from '@/components/catalog-view'
import { ProductDialog } from '@/components/detail-view'
import { SidebarMenu } from '@/components/sidebar-menu'
import { LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { api } from '@/lib/client'
import { firebaseEnabled, initFirebaseAnalytics, pesanFirebase } from '@/lib/firebase'
import { Lookups, SessionUser } from '@/lib/types'

/**
 * SATU HALAMAN (desain user):
 * - Tanpa halaman login: kolom email + password langsung di header kanan atas.
 * - Setelah login, halaman yang SAMA menjadi editable (inline) + menu admin di sidebar.
 * - Sidebar kiri: menu "Nama Profile" (expand/collapse + kolom cari).
 * - Klik produk → dialog box (foto slide kiri, rincian kanan, tombol X) — tanpa tab/window baru.
 */
export default function Home() {
  const { toast } = useToast()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [lookups, setLookups] = useState<Lookups>({ series: [], type: [], category: [], finish: [] })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [startEdit, setStartEdit] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [booting, setBooting] = useState(true)
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)

  // Form login ringkas di header
  const [lemail, setLemail] = useState('')
  const [lpass, setLpass] = useState('')
  const [logging, setLogging] = useState(false)

  const loadLookups = useCallback(() => {
    api<Lookups>('/api/lookups').then(setLookups).catch(() => {})
  }, [])

  useEffect(() => {
    api<{ user: SessionUser | null }>('/api/auth/session')
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setBooting(false))
    loadLookups()
    // Firebase Analytics (hanya di browser yang mendukung; gagal = diabaikan)
    initFirebaseAnalytics()
  }, [loadLookups])

  /** Segarkan daftar produk + daftar nama profile (dipakai setelah ada perubahan data). */
  const refreshAll = useCallback(() => {
    setReloadKey((k) => k + 1)
    loadLookups()
  }, [loadLookups])

  // Satu halaman: klik produk membuka dialog box (tanpa tab/window baru)
  const openProduct = (id: string, edit = false) => {
    setActiveId(id)
    setStartEdit(edit)
  }
  const closeProduct = () => {
    setActiveId(null)
    setStartEdit(false)
    refreshAll() // segarkan kartu & sidebar bila ada perubahan dari dialog
  }

  /** Login dari header: coba Firebase dulu, gagal → cadangan login lokal (DB katalog). */
  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lemail.trim() || !lpass) return
    setLogging(true)
    let fbErr = ''
    if (firebaseEnabled) {
      try {
        const cred = await signInWithEmailAndPassword(getAuth(), lemail.trim(), lpass)
        const r = await api<{ user: SessionUser }>('/api/auth/firebase', {
          method: 'POST',
          body: JSON.stringify({ idToken: await cred.user.getIdToken() }),
          headers: { 'Content-Type': 'application/json' },
        })
        setUser(r.user)
        setLpass('')
        toast({
          title: `Selamat datang, ${r.user.name}`,
          description: 'Login via Firebase — halaman kini dapat diedit.',
        })
        return
      } catch (err) {
        const msg = (err as Error).message || ''
        // Email Firebase valid tapi bukan admin katalog → jangan coba metode lokal.
        if (msg.includes('administrator')) {
          toast({ title: 'Login ditolak', description: msg, variant: 'destructive' })
          return
        }
        const code = msg.match(/auth\/[a-z-]+/)?.[0]
        fbErr = code ? pesanFirebase(code) : msg
      }
    }
    try {
      const r = await api<{ user: SessionUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: lemail.trim(), password: lpass }),
        headers: { 'Content-Type': 'application/json' },
      })
      setUser(r.user)
      setLpass('')
      toast({
        title: `Selamat datang, ${r.user.name}`,
        description: fbErr ? `Login lokal — ${fbErr}` : 'Login lokal — halaman dapat diedit.',
      })
    } catch (err) {
      const m = (err as Error).message
      toast({ title: 'Login gagal', description: fbErr ? `${fbErr} — Masuk Lokal: ${m}` : m, variant: 'destructive' })
    } finally {
      setLogging(false)
    }
  }

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    // Keluar juga dari Firebase bila sesi Firebase masih ada.
    if (firebaseEnabled) await signOut(getAuth()).catch(() => {})
    setUser(null)
    setStartEdit(false)
    toast({ title: 'Anda telah keluar', description: 'Katalog kembali hanya-baca (read-only).' })
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---------- Header: logo kiri, login/logout kanan atas ---------- */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => setSelectedSeries(null)}
            aria-label="Ke beranda katalog"
          >
            <span className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black text-sm tracking-tight shadow-sm">
              BR
            </span>
            <span>
              <span className="block font-bold leading-tight whitespace-nowrap text-sm sm:text-base">
                PT. BELGINDO RAYA
              </span>
              <span className="hidden sm:block text-xs text-muted-foreground leading-tight">
                Katalog Produk Digital
              </span>
            </span>
          </button>

          <div className="ms-auto flex items-center gap-2">
            {user ? (
              <>
                <Badge variant="outline" className="hidden sm:inline-flex gap-1.5 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Mode Edit — {user.name}
                </Badge>
                <Button variant="outline" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Keluar</span>
                </Button>
              </>
            ) : (
              <form onSubmit={login} className="flex items-center gap-1.5" aria-label="Login administrator di header">
                <Input
                  type="email"
                  value={lemail}
                  onChange={(e) => setLemail(e.target.value)}
                  placeholder="Email admin"
                  aria-label="Email admin"
                  autoComplete="username"
                  required
                  className="h-9 w-32 sm:w-40 lg:w-48 text-xs sm:text-sm"
                />
                <Input
                  type="password"
                  value={lpass}
                  onChange={(e) => setLpass(e.target.value)}
                  placeholder="Password"
                  aria-label="Password admin"
                  autoComplete="current-password"
                  required
                  className="h-9 w-24 sm:w-32 lg:w-40 text-xs sm:text-sm"
                />
                <Button type="submit" size="sm" disabled={logging}>
                  <LogIn className="h-4 w-4" /> {logging ? '…' : 'Masuk'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Sidebar kiri + konten kanan ---------- */}
      <div className="flex-1 flex w-full">
        <aside className="hidden md:block w-60 lg:w-64 shrink-0 border-r bg-muted/20">
          <SidebarMenu
            lookups={lookups}
            user={user}
            selectedSeries={selectedSeries}
            onSelectSeries={(id) => setSelectedSeries(id)}
            openProduct={openProduct}
            onDataChanged={refreshAll}
          />
        </aside>

        <main className="flex-1 min-w-0">
          {booting ? (
            <div className="px-6 py-10 space-y-4">
              <Skeleton className="h-10 w-64 rounded-full" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <CatalogView
              lookups={lookups}
              user={user}
              reloadKey={reloadKey}
              openProduct={openProduct}
              seriesId={selectedSeries}
              onSeriesChange={setSelectedSeries}
            />
          )}
        </main>
      </div>

      {/* ---------- Dialog produk (foto slide kiri, rincian kanan, tombol X) ---------- */}
      <ProductDialog
        id={activeId}
        open={!!activeId}
        onOpenChange={(o) => { if (!o) closeProduct() }}
        user={user}
        lookups={lookups}
        reloadLookups={loadLookups}
        startInEdit={startEdit}
        openProduct={openProduct}
      />

      {/* ---------- Footer (menempel di bawah) ---------- */}
      <footer className="mt-auto border-t bg-muted/40">
        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} PT. Belgindo Raya — Katalog Produk Internal</p>
          <p>Akses karyawan: baca saja (read-only) · Pengelolaan: administrator</p>
        </div>
      </footer>
    </div>
  )
}
