'use client'

import { useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { AssetMeta, assetUrl } from '@/lib/types'

interface LightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assets: AssetMeta[]
  index: number
  onIndexChange: (i: number) => void
}

/** Perbesar gambar: klik thumbnail → dialog besar, navigasi panah/keyboard + unduh. */
export function Lightbox({ open, onOpenChange, assets, index, onIndexChange }: LightboxProps) {
  const total = assets.length
  const go = useCallback(
    (d: number) => total > 0 && onIndexChange((index + d + total) % total),
    [index, total, onIndexChange]
  )

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, go])

  const asset = total > 0 ? assets[Math.min(index, total - 1)] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-2 sm:p-3" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Gambar produk diperbesar</DialogTitle>
        {asset && (
          <div className="relative select-none">
            <img
              src={assetUrl(asset.fileName)}
              alt={asset.caption || 'Gambar produk'}
              className="w-full max-h-[75vh] object-contain rounded-md bg-white"
            />
            {total > 1 && (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Gambar sebelumnya"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-md"
                  onClick={() => go(-1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Gambar berikutnya"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow-md"
                  onClick={() => go(1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
            <div className="flex items-center justify-between gap-3 px-2 pt-2">
              <p className="text-sm text-muted-foreground truncate">
                {asset.caption || `Gambar ${index + 1} dari ${total}`}
                {asset.assetType === 'TECHNICAL' && ' · Gambar teknis'}
              </p>
              <a href={assetUrl(asset.fileName)} download={asset.fileName} tabIndex={-1}>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" /> Unduh
                </Button>
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
