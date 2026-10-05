import { readdir, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const assetsPath = new URL('../dist/assets/', import.meta.url)
const assetNames = await readdir(assetsPath)
const assets = await Promise.all(assetNames.map(async (name) => {
  const path = new URL(name, assetsPath)
  const content = await readFile(path)
  return { name, bytes: content.byteLength, compressedBytes: gzipSync(content).byteLength }
}))
const javascript = assets.filter(({ name }) => name.endsWith('.js'))
const totalCompressedBytes = javascript.reduce((total, asset) => total + asset.compressedBytes, 0)
const budgetBytes = 150 * 1024

console.table(assets.map(({ name, bytes, compressedBytes }) => ({ name, bytes, gzip: compressedBytes })))
console.log(`JavaScript total (gzip): ${totalCompressedBytes} bytes; budget: ${budgetBytes} bytes`)

if (totalCompressedBytes > budgetBytes) {
  console.error('JavaScript bundle exceeded the landing page budget.')
  process.exitCode = 1
}
