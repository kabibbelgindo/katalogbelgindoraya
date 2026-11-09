export interface LookupItem {
  id: string
  name: string
  slug: string
  active: boolean
}

export interface Lookups {
  series: LookupItem[]
  type: LookupItem[]
  category: LookupItem[]
  finish: LookupItem[]
}

export type AssetType = 'PHOTO' | 'TECHNICAL'

export interface AssetMeta {
  id: string
  fileName: string
  thumbName: string | null
  mimeType: string
  width: number | null
  height: number | null
  assetType: AssetType
  caption: string | null
  isPrimary: boolean
  sortOrder: number
}

export interface SpecRow {
  id?: string
  groupName: string
  attributeName: string
  attributeValue: string
  unit?: string | null
  sortOrder?: number
}

export interface LookupLite {
  id: string
  name: string
}

export interface ProductCore {
  id: string
  sku: string
  name: string
  description: string | null
  material: string | null
}

export interface ProductListItem extends ProductCore {
  series?: LookupLite | null
  type?: LookupLite | null
  category?: LookupLite | null
  finish?: LookupLite | null
  assets: Pick<AssetMeta, 'id' | 'thumbName' | 'fileName' | 'caption'>[]
  specs: Pick<SpecRow, 'attributeName' | 'attributeValue' | 'unit'>[]
  updatedAt?: string
}

export interface ProductDetail extends ProductCore {
  note: string | null
  status: string
  brand: string | null
  logoName: string | null
  series: LookupLite | null
  type: LookupLite | null
  category: LookupLite | null
  finish: LookupLite | null
  specs: SpecRow[]
  assets: AssetMeta[]
}

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
}

export function assetUrl(fileName: string, thumb = false): string {
  return `/api/files/${encodeURIComponent(fileName)}${thumb ? '?thumb=1' : ''}`
}
