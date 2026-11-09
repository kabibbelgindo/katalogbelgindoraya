/**
 * Seed awal Katalog Produk PT. Belgindo Raya
 * - 1 akun administrator
 * - nilai lookup dasar (seri/tipe/kategori/finishing)
 * - 2 produk contoh dari foto.zip (84270, Pilastri) beserta asetnya
 * Jalankan: bun scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { copyFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { hashPassword } from '../src/lib/hash'

const db = new PrismaClient()
const UPLOAD_DIR = path.join(process.cwd(), 'db', 'uploads')
const SRC = path.join(process.cwd(), 'upload', 'foto_extracted')

async function copyAsset(srcFile: string, base: string, caption: string, ext = 'jpg') {
  const fileName = `${base}.${ext}`
  await copyFile(path.join(SRC, srcFile), path.join(UPLOAD_DIR, fileName))
  const img = sharp(path.join(UPLOAD_DIR, fileName), { failOn: 'none' })
  const meta = await img.metadata()
  const thumb = await img
    .clone()
    .rotate()
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()
  const thumbName = `${base}_thumb.jpg`
  await sharp(thumb).toFile(path.join(UPLOAD_DIR, thumbName))
  return {
    fileName,
    thumbName,
    mimeType: 'image/jpeg',
    fileSize: 0,
    width: meta.width ?? null,
    height: meta.height ?? null,
    caption,
  }
}

async function main() {
  await mkdir(UPLOAD_DIR, { recursive: true })

  // 1. Admin tunggal
  const email = 'admin@belgindo.co.id'
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Administrator Katalog',
      passwordHash: hashPassword('belgindo2026'),
      role: 'ADMIN',
    },
  })
  console.log('✔ admin siap:', email)

  // 2. Lookup dasar
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const mk = async (model: 'series' | 'productType' | 'category' | 'finish', name: string) => {
    const m = { series: db.series, productType: db.productType, category: db.category, finish: db.finish }[model]
    return m.upsert({ where: { name }, update: {}, create: { name, slug: slug(name) } })
  }
  const seriPilastri = await mk('series', 'Pilastri')
  const tipeProfil = await mk('productType', 'Profil / Moulding')
  const katMoulding = await mk('category', 'Moulding')
  const finishGold = await mk('finish', 'Gold Leaf')
  await mk('finish', 'Matte Black')
  console.log('✔ lookup dasar siap')

  // 3. Produk 84270 — foto sudut + foto face (spesifikasi menunggu input admin)
  const p1 = await db.product.upsert({
    where: { sku: '84270' },
    update: {},
    create: {
      sku: '84270',
      name: 'Produk 84270',
      description: 'Profil moulding gold leaf dengan sentuhan silver — data final menunggu konfirmasi tim.',
      typeId: tipeProfil.id,
      categoryId: katMoulding.id,
      finishId: finishGold.id,
      note: 'Foto: tampak sudut & tampak face/profil. Spesifikasi ukuran menunggu pengukuran aktual oleh admin.',
    },
  })
  if ((await db.productAsset.count({ where: { productId: p1.id } })) === 0) {
    const a1 = await copyAsset('84270.jpg', '84270-sudut', 'Tampak sudut profil')
    const a2 = await copyAsset('84270_face.jpg', '84270-face', 'Tampak face / penampang profil')
    await db.productAsset.create({ data: { ...a1, productId: p1.id, assetType: 'PHOTO', isPrimary: true, sortOrder: 0 } })
    await db.productAsset.create({ data: { ...a2, productId: p1.id, assetType: 'PHOTO', sortOrder: 1 } })
  }

  // 4. Produk Pilastri — lembar teknis + 2 ukuran yang terbaca jelas di lembar
  const p2 = await db.product.upsert({
    where: { sku: 'PILASTRI' },
    update: {},
    create: {
      sku: 'PILASTRI',
      name: 'Pilastri',
      description: 'Profil pilastri bersirip — rujukan ukuran dari lembar spesifikasi teknis.',
      seriesId: seriPilastri.id,
      typeId: tipeProfil.id,
      categoryId: katMoulding.id,
      note: 'Spesifikasi ditranskripsi dari lembar teknis (W: 2-5/8" × H: 1-5/16") — perlu verifikasi admin sebelum dipakai.',
    },
  })
  if ((await db.productSpecification.count({ where: { productId: p2.id } })) === 0) {
    await db.productSpecification.createMany({
      data: [
        { productId: p2.id, groupName: 'Ukuran', attributeName: 'Lebar tampak', attributeValue: '66,7', unit: 'mm', sortOrder: 0 },
        { productId: p2.id, groupName: 'Ukuran', attributeName: 'Tinggi profil', attributeValue: '33,3', unit: 'mm', sortOrder: 1 },
      ],
    })
  }
  if ((await db.productAsset.count({ where: { productId: p2.id } })) === 0) {
    const t = await copyAsset('Pilastri.jpg', 'pilastri-lembar-teknis', 'Lembar spesifikasi teknis Pilastri')
    await db.productAsset.create({ data: { ...t, productId: p2.id, assetType: 'TECHNICAL', isPrimary: true, sortOrder: 0 } })
  }
  console.log('✔ 2 produk contoh siap (84270, PILASTRI)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
