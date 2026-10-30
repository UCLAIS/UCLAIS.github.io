const { lstat, readFile, realpath } = require('node:fs/promises')
const path = require('node:path')

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key))
}

// Presentation files are reviewed static assets, never arbitrary embeds or URLs.
async function loadPresentation(siteDir, sourcePath) {
  if (!/^knowledge\/(tutorials|nexus)\/[^\x00-\x1f\x7f\\?#%:]+\.(mdx?|pdf|ipynb|py)$/i.test(sourcePath) || sourcePath.split('/').some(part => part === '.' || part === '..')) throw new Error('Invalid presentation source path.')
  const root = path.resolve(siteDir, 'static')
  let realRoot
  const directory = `/materials/${sourcePath.slice('knowledge/'.length).replace(/\.[^.]+$/, '')}`
  async function asset(url, extensions, maximum = 25 * 1024 * 1024) {
    if (typeof url !== 'string' || url.length > 500 || !/^\/materials\/[A-Za-z0-9_./-]+$/.test(url)) throw new Error('Invalid presentation asset path.')
    const parts = url.slice(1).split('/')
    if (parts.some(part => !part || part === '.' || part === '..') || !extensions.includes(path.extname(url).toLowerCase())) throw new Error('Invalid presentation asset type or path.')
    let filename = root
    for (const part of ['', ...parts]) {
      if (part) filename = path.join(filename, part)
      if ((await lstat(filename)).isSymbolicLink()) throw new Error('Symlinked presentation assets are refused.')
    }
    const info = await lstat(filename)
    realRoot ??= await realpath(root)
    if (!info.isFile() || info.size > maximum || !(await realpath(filename)).startsWith(realRoot + path.sep)) throw new Error('Invalid or oversized presentation asset.')
    return filename
  }
  let filename
  try {
    await lstat(path.join(root, directory.slice(1), 'presentation.json'))
    filename = await asset(`${directory}/presentation.json`, ['.json'], 1024 * 1024)
  }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
  let data
  try { data = JSON.parse(await readFile(filename, 'utf8')) } catch { throw new Error('Invalid presentation JSON; file contents were not logged.') }
  if (!exactKeys(data, ['schemaVersion', 'pdf', 'slides', 'files']) || data.schemaVersion !== 1 || !Array.isArray(data.slides) || !data.slides.length || data.slides.length > 300 || !Array.isArray(data.files) || data.files.length > 20) throw new Error('Invalid presentation record.')
  await asset(data.pdf, ['.pdf'])
  for (const slide of data.slides) {
    if (!exactKeys(slide, ['src', 'width', 'height', 'text']) || ![slide.width, slide.height].every(value => Number.isInteger(value) && value > 0 && value <= 10000) || typeof slide.text !== 'string' || slide.text.length > 20000) throw new Error('Invalid presentation slide.')
    const image = await readFile(await asset(slide.src, ['.webp', '.png', '.jpg', '.jpeg'], 5 * 1024 * 1024))
    const valid = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || (image[0] === 255 && image[1] === 216 && image[2] === 255) || (image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP')
    if (!valid) throw new Error('Presentation slides must be raster images.')
  }
  for (const file of data.files) {
    if (!exactKeys(file, ['label', 'url']) || typeof file.label !== 'string' || !file.label.trim() || file.label.length > 200) throw new Error('Invalid additional file.')
    await asset(file.url, ['.pdf', '.ipynb', '.pptx', '.zip', '.py', '.csv', '.txt', '.r', '.jl', '.json', '.md', '.xlsx'])
  }
  return data
}

module.exports = { loadPresentation }
