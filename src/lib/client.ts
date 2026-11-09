/** Pembungkus fetch JSON dengan penanganan error berbahasa Indonesia. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* respons bukan JSON */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error || `Permintaan gagal (${res.status})`
    throw new Error(msg)
  }
  return data as T
}
