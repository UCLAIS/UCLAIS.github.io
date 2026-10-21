import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const previewDirectory = 'preview/website-redesign'

// Verify the rest of the published website byte-for-byte before and after staging.
export function productionSnapshot(directory) {
  const files = {}
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      const name = relative(directory, path).split('\\').join('/')
      if (name === '.git' || name === previewDirectory) continue
      if (entry.isDirectory()) visit(path)
      else files[name] = createHash('sha256').update(readFileSync(path)).digest('hex')
    }
  }
  visit(directory)
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
}

export function stagePreview(source, published) {
  source = resolve(source)
  published = resolve(published)
  const destination = join(published, previewDirectory)
  if (!existsSync(join(source, 'index.html'))) throw new Error('The preview build has no index.html')
  if (!existsSync(join(published, 'index.html')) || !existsSync(join(published, 'CNAME'))) throw new Error('Expected the existing published website')
  const before = productionSnapshot(published)
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })
  cpSync(source, destination, { recursive: true })
  rmSync(join(destination, 'CNAME'), { force: true })
  const after = productionSnapshot(published)
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Production files changed while staging the preview')
  return destination
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(stagePreview(process.argv[2] || 'build', process.argv[3] || 'published'))
}
