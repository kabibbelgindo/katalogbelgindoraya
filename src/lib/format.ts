const MM_PER_IN = 25.4

/** Parsing angka gaya Indonesia (koma) maupun internasional (titik). */
export function parseNum(s: string): number | null {
  if (!s) return null
  const n = parseFloat(String(s).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Konversi ke mm dari satuan input. */
export function toMm(v: number, unit?: string | null): number | null {
  const u = (unit || 'mm').toLowerCase()
  if (u === 'mm') return v
  if (u === 'cm') return v * 10
  if (u === 'in' || u === 'inch' || u === '"') return v * MM_PER_IN
  return null
}

function fmtNum(n: number, decimals = 1): string {
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals
  return r.toString().replace('.', ',')
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Inch pecahan gaya industri moulding (sesuai lembar spesifikasi,
 * mis. W: 2-5/8" × H: 1-5/16"). Akurasi 1/16 inch.
 */
export function fmtFractionalInch(mm: number): string {
  const sixteenth = Math.round((mm / MM_PER_IN) * 16)
  if (sixteenth <= 0) return fmtNum(mm / MM_PER_IN, 2)
  const whole = Math.floor(sixteenth / 16)
  const num = sixteenth % 16
  if (num === 0) return `${whole}`
  const g = gcd(num, 16)
  const frac = `${num / g}/${16 / g}`
  return whole > 0 ? `${whole}-${frac}` : frac
}

/**
 * Tampilan ganda mm + inch pecahan (keputusan pengguna):
 * "66,7 mm (2-5/8 in)". Bila nilai bukan angka, tampilkan apa adanya.
 */
export function fmtDual(value: string, unit?: string | null): string {
  const v = parseNum(value)
  if (v === null) return unit ? `${value} ${unit}` : value
  const mm = toMm(v, unit)
  if (mm === null) return unit ? `${value} ${unit}` : value
  return `${fmtNum(mm)} mm (${fmtFractionalInch(mm)} in)`
}

/** Ringkasan pendek untuk kartu produk: "66,7 mm × 33,3 mm". */
export function fmtShort(value: string, unit?: string | null): string {
  const v = parseNum(value)
  if (v === null) return `${value}${unit ? ` ${unit}` : ''}`
  const mm = toMm(v, unit)
  if (mm === null) return `${value} ${unit ?? ''}`.trim()
  return `${fmtNum(mm)} mm`
}
